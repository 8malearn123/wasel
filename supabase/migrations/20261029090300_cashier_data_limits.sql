-- A cashier reads their own invoices only, and none of the shop's buying side.
--
-- Live (regression of 2026-10-29): signed in as a cashier, the REST API
-- returned all 43 invoices of the shop — every one sold by someone else —
-- their lines with cost_at_sale, the suppliers, and the reports page added
-- them up. The policies on sales / sale_items / suppliers are scoped by shop
-- only, and the custom-role limits (20261020100100) leave the legacy
-- cashier role exactly as it was. The app hides those screens; the database
-- did not refuse the reads.
--
-- For an active member whose role is 'cashier' at their shop (others are not
-- touched — every policy here is RESTRICTIVE and passes for them):
-- * sales: only invoices they sold (sold_by = them); a new invoice is always
--   filed under them
-- * sale_items: only lines of those invoices, and lines are written only on them
-- * suppliers, purchase orders and their lines, payouts and wholesale: none
-- * closing the day still needs the whole branch's totals for that day: they
--   come from day_sales_summary(), which returns the totals and the sold lines
--   without cost, to members allowed to close the day or read reports
-- Nothing in the data is read or changed by this migration.

CREATE OR REPLACE FUNCTION public.is_cashier_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_users mu
     WHERE mu.user_id = auth.uid()
       AND mu.is_active = true
       AND mu.merchant_id = public.get_user_merchant_id()
       AND mu.role::text = 'cashier'
  )
$$;
REVOKE ALL ON FUNCTION public.is_cashier_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_cashier_member() TO authenticated;

-- ---------------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Cashiers read own sales" ON public.sales;
CREATE POLICY "Cashiers read own sales"
  ON public.sales AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT (SELECT public.is_cashier_member()) OR sold_by = auth.uid());

DROP POLICY IF EXISTS "Cashiers write own sales" ON public.sales;
CREATE POLICY "Cashiers write own sales"
  ON public.sales AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT (SELECT public.is_cashier_member()) OR sold_by = auth.uid())
  WITH CHECK (NOT (SELECT public.is_cashier_member()) OR sold_by = auth.uid());

DROP POLICY IF EXISTS "Cashiers delete own sales" ON public.sales;
CREATE POLICY "Cashiers delete own sales"
  ON public.sales AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT (SELECT public.is_cashier_member()) OR sold_by = auth.uid());

-- The till sends sold_by itself; a cashier cannot file a sale under a colleague
CREATE OR REPLACE FUNCTION public.sale_sold_by_cashier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_cashier_member() THEN
    NEW.sold_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sale_sold_by_cashier() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sales_sold_by_cashier ON public.sales;
CREATE TRIGGER sales_sold_by_cashier
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sale_sold_by_cashier();

-- ---------------------------------------------------------------------------
-- sale_items: the lines of the cashier's own invoices
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_own_sale(_sale_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.sales s WHERE s.id = _sale_id AND s.sold_by = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_own_sale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_own_sale(uuid) TO authenticated;

DROP POLICY IF EXISTS "Cashiers read own sale lines" ON public.sale_items;
CREATE POLICY "Cashiers read own sale lines"
  ON public.sale_items AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT (SELECT public.is_cashier_member()) OR public.is_own_sale(sale_id));

DROP POLICY IF EXISTS "Cashiers add lines to own sales" ON public.sale_items;
CREATE POLICY "Cashiers add lines to own sales"
  ON public.sale_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT (SELECT public.is_cashier_member()) OR public.is_own_sale(sale_id));

DROP POLICY IF EXISTS "Cashiers change lines of own sales" ON public.sale_items;
CREATE POLICY "Cashiers change lines of own sales"
  ON public.sale_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT (SELECT public.is_cashier_member()) OR public.is_own_sale(sale_id))
  WITH CHECK (NOT (SELECT public.is_cashier_member()) OR public.is_own_sale(sale_id));

DROP POLICY IF EXISTS "Cashiers remove lines of own sales" ON public.sale_items;
CREATE POLICY "Cashiers remove lines of own sales"
  ON public.sale_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT (SELECT public.is_cashier_member()) OR public.is_own_sale(sale_id));

-- ---------------------------------------------------------------------------
-- The buying side: nothing for a cashier
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['suppliers', 'purchase_orders', 'purchase_order_items', 'merchant_payouts',
                            'wholesale_listings', 'wholesale_orders', 'wholesale_order_items',
                            'wholesale_credit_transactions'] LOOP
    CONTINUE WHEN to_regclass('public.' || _t) IS NULL;
    EXECUTE format('DROP POLICY IF EXISTS "Not for cashiers %s" ON public.%I', _t, _t);
    EXECUTE format(
      'CREATE POLICY "Not for cashiers %s" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (NOT (SELECT public.is_cashier_member()))
         WITH CHECK (NOT (SELECT public.is_cashier_member()))',
      _t, _t);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Closing the day: the branch's totals for one day, without cost
-- ---------------------------------------------------------------------------
-- Returns the same shape the closing screen read from sales directly
-- (the sale's own columns, and items with device brand/model or accessory
-- name), minus cost_at_sale and the device/accessory purchase price.
CREATE OR REPLACE FUNCTION public.day_sales_summary(_branch_id uuid, _from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant uuid := public.get_user_merchant_id();
BEGIN
  IF _merchant IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = _branch_id AND b.merchant_id = _merchant)
     OR NOT (public.has_permission('closings.manage') OR public.has_permission('reports.view')) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إغلاق اليوم لهذا الفرع.' USING ERRCODE = '42501';
  END IF;

  -- a cashier closes a recent day, not reads the shop's history through here
  IF public.is_cashier_member()
     AND (_to - _from > interval '25 hours' OR _from < now() - interval '3 days') THEN
    RAISE EXCEPTION 'يمكن إغلاق يوم حديث فقط (آخر ثلاثة أيام).' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', s.id,
             'invoice_number', s.invoice_number,
             'sale_date', s.sale_date,
             'customer_name', s.customer_name,
             'payment_method', s.payment_method,
             'total_amount', s.total_amount,
             'tax_amount', s.tax_amount,
             'discount_amount', s.discount_amount,
             'items', COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                        'device_id', si.device_id,
                        'accessory_id', si.accessory_id,
                        'quantity', si.quantity,
                        'unit_price', si.unit_price,
                        'device', CASE WHEN d.id IS NULL THEN NULL
                                       ELSE jsonb_build_object('brand', d.brand, 'model', d.model) END,
                        'accessory', CASE WHEN a.id IS NULL THEN NULL
                                          ELSE jsonb_build_object('name', a.name) END))
                 FROM public.sale_items si
                 LEFT JOIN public.devices d     ON d.id = si.device_id
                 LEFT JOIN public.accessories a ON a.id = si.accessory_id
                WHERE si.sale_id = s.id), '[]'::jsonb))
           ORDER BY s.sale_date)
      FROM public.sales s
     WHERE s.merchant_id = _merchant
       AND s.branch_id = _branch_id
       AND s.sale_date >= _from
       AND s.sale_date <= _to
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.day_sales_summary(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.day_sales_summary(uuid, timestamptz, timestamptz) TO authenticated;
