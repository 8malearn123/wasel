-- The online store shows its products to visitors again.
--
-- Live: every store showed «0 منتج»; a visitor reading public_store_devices
-- and public_store_accessories got 0 rows, though the shops have products in
-- stock. Cause: 20260309021554 dropped the visitor policies on devices and
-- accessories (they exposed cost and IMEI), and 20260309021934 made both views
-- security_invoker — so a visitor reads them with their own rights, which no
-- longer reach any row. Since March the views return nothing to anyone but
-- signed-in members of the same shop.
--
-- The views now read the tables with their owner's rights (security_invoker
-- off) and are themselves the boundary: only shops whose store is published,
-- only devices for sale and accessories in stock, only the columns a shop
-- window needs. Cost, IMEI, supplier and purchase data are not in them, and the
-- tables stay closed to visitors. `notes` keeps its place in the view (the
-- app's types expect the column) but is empty: it holds the shop's internal
-- notes and the storefront does not use it.

CREATE OR REPLACE VIEW public.public_store_devices AS
SELECT d.id, d.merchant_id, d.branch_id, d.model, d.brand, d.color,
       d.storage, d.condition, d.price, d.status, NULL::text AS notes, d.created_at
  FROM public.devices d
 WHERE d.status = 'available'
   AND d.price >= 0
   AND EXISTS (SELECT 1 FROM public.store_settings ss
                WHERE ss.merchant_id = d.merchant_id AND ss.is_published = true);
ALTER VIEW public.public_store_devices SET (security_invoker = off);

CREATE OR REPLACE VIEW public.public_store_accessories AS
SELECT a.id, a.merchant_id, a.branch_id, a.sku, a.name, a.category, a.brand,
       a.price, a.quantity, a.min_quantity, a.created_at
  FROM public.accessories a
 WHERE a.quantity > 0
   AND a.price >= 0
   AND EXISTS (SELECT 1 FROM public.store_settings ss
                WHERE ss.merchant_id = a.merchant_id AND ss.is_published = true);
ALTER VIEW public.public_store_accessories SET (security_invoker = off);

REVOKE ALL ON public.public_store_devices, public.public_store_accessories FROM PUBLIC;
GRANT SELECT ON public.public_store_devices, public.public_store_accessories TO anon, authenticated;
