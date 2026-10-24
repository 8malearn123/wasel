-- Wholesale: the other party's name and the listed product, for the parties only.
--
-- merchants, devices and accessories are readable only by their own shop, so
-- every wholesale screen that joins the other side — the supplier of a
-- listing, the buyer of an order, the product being sold — received null and
-- showed «—». These two functions return just what a party to the deal needs:
-- a shop's name (and phone, for a shop that publishes listings), and a listed
-- product's description. No IMEI, no cost, nothing for shops the caller has no
-- dealings with. Read only; no table or policy is changed.

CREATE OR REPLACE FUNCTION public.wholesale_parties()
RETURNS TABLE (merchant_id uuid, name text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT public.get_user_merchant_id() AS id),
  listing_shops AS (
    SELECT DISTINCT l.merchant_id AS id FROM public.wholesale_listings l WHERE l.is_active
  ),
  dealing_shops AS (
    SELECT o.supplier_merchant_id AS id FROM public.wholesale_orders o, me WHERE o.buyer_merchant_id = me.id
    UNION SELECT o.buyer_merchant_id FROM public.wholesale_orders o, me WHERE o.supplier_merchant_id = me.id
    UNION SELECT c.supplier_merchant_id FROM public.wholesale_credit_transactions c, me WHERE c.buyer_merchant_id = me.id
    UNION SELECT c.buyer_merchant_id FROM public.wholesale_credit_transactions c, me WHERE c.supplier_merchant_id = me.id
  )
  SELECT m.id, m.name,
         CASE WHEN m.id IN (SELECT id FROM listing_shops) THEN m.phone END
  FROM public.merchants m, me
  WHERE me.id IS NOT NULL
    AND (m.id IN (SELECT id FROM listing_shops) OR m.id IN (SELECT id FROM dealing_shops));
$$;

CREATE OR REPLACE FUNCTION public.wholesale_listing_items()
RETURNS TABLE (listing_id uuid, item_type text, name text, brand text, model text, sku text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT public.get_user_merchant_id() AS id)
  SELECT l.id, l.item_type,
         COALESCE(a.name, NULLIF(trim(concat_ws(' ', d.brand, d.model)), '')),
         COALESCE(d.brand, a.brand), d.model, a.sku
  FROM public.wholesale_listings l
  CROSS JOIN me
  LEFT JOIN public.devices d ON d.id = l.device_id
  LEFT JOIN public.accessories a ON a.id = l.accessory_id
  WHERE me.id IS NOT NULL
    AND (l.is_active
         OR l.merchant_id = me.id
         OR l.id IN (
           SELECT oi.listing_id
           FROM public.wholesale_order_items oi
           JOIN public.wholesale_orders o ON o.id = oi.order_id
           WHERE me.id IN (o.buyer_merchant_id, o.supplier_merchant_id)));
$$;

REVOKE ALL ON FUNCTION public.wholesale_parties() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wholesale_listing_items() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wholesale_parties() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wholesale_listing_items() TO authenticated;
