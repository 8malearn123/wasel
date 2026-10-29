-- A paid invoice's money changes only by the owner or an admin, and never to
-- an impossible amount; only they delete invoices.
--
-- Live: a cashier opened «تعديل» on their own paid invoice, set the discount to
-- 115 and the invoice was saved with a total of 0 SAR; the delete button was
-- also shown to them. The till hides those controls for cashiers now, but the
-- policy on sales («Admins can manage sales») lets any member of the shop
-- update or delete any invoice through the API, so the database decides here.
--
-- Rules, for signed-in users (server-side jobs without a user are unaffected):
-- * amounts, discount, payment method/status, invoice number, shop and seller
--   of an existing invoice change only for the shop's owner/admin (or a
--   platform admin); a cashier can still correct the customer's name, phone
--   and the notes, and printing still marks the invoice printed
-- * when the money of an invoice changes (anyone): no negative discount or
--   total, the total is subtotal + VAT, and a discount never takes it to 0
-- * a new invoice (the till): no negative discount or total, total = subtotal + VAT
-- * deleting an invoice: owner/admin only — except the till taking back a sale
--   it has just made whose lines were refused (no lines, the seller's own,
--   within 10 minutes), which keeps a failed sale from staying as revenue
-- Existing invoices are not read or changed by this migration.

CREATE OR REPLACE FUNCTION public.is_shop_manager(_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.merchant_users mu
     WHERE mu.user_id = auth.uid()
       AND mu.merchant_id = _merchant_id
       AND mu.role IN ('owner', 'admin')
       AND COALESCE(mu.is_active, true)
  )
$$;
REVOKE ALL ON FUNCTION public.is_shop_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_manager(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_sale_money()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _money_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.discount_amount, 0) < 0 OR NEW.total_amount < 0
       OR abs(NEW.total_amount - (NEW.subtotal + COALESCE(NEW.tax_amount, 0))) > 0.05 THEN
      RAISE EXCEPTION 'مبالغ الفاتورة غير صحيحة (الخصم أو الإجمالي)، فلم تُحفظ.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  _money_changed :=
       NEW.total_amount    IS DISTINCT FROM OLD.total_amount
    OR NEW.subtotal        IS DISTINCT FROM OLD.subtotal
    OR NEW.tax_amount      IS DISTINCT FROM OLD.tax_amount
    OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount;

  IF auth.uid() IS NOT NULL AND NOT public.is_shop_manager(OLD.merchant_id) AND (
       _money_changed
    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
    OR NEW.merchant_id    IS DISTINCT FROM OLD.merchant_id
    OR NEW.sold_by        IS DISTINCT FROM OLD.sold_by
  ) THEN
    RAISE EXCEPTION 'لا يمكن للكاشير تعديل مبالغ الفاتورة المدفوعة أو طريقة دفعها. اطلب ذلك من المدير أو المالك.'
      USING ERRCODE = '42501';
  END IF;

  IF _money_changed AND (
       COALESCE(NEW.discount_amount, 0) < 0
    OR NEW.total_amount <= 0
    OR abs(NEW.total_amount - (NEW.subtotal + COALESCE(NEW.tax_amount, 0))) > 0.05
  ) THEN
    RAISE EXCEPTION 'الخصم يجب أن يكون بين 0 وأقل من قيمة الفاتورة، والإجمالي يساوي المجموع مع الضريبة.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_sale_money() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sales_guard_money ON public.sales;
CREATE TRIGGER sales_guard_money
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.guard_sale_money();

CREATE OR REPLACE FUNCTION public.guard_sale_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_shop_manager(OLD.merchant_id) THEN
    RETURN OLD;
  END IF;
  -- the till withdrawing its own sale whose lines were refused a moment ago
  IF OLD.sold_by = auth.uid()
     AND OLD.created_at > now() - interval '10 minutes'
     AND NOT EXISTS (SELECT 1 FROM public.sale_items si WHERE si.sale_id = OLD.id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'حذف الفواتير من صلاحية المدير أو المالك فقط.' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.guard_sale_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sales_guard_delete ON public.sales;
CREATE TRIGGER sales_guard_delete
  BEFORE DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.guard_sale_delete();
