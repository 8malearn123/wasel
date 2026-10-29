-- =============================================================================
-- Stored rows that break the money/stock rules — READ ONLY.
--
-- Run in Supabase → SQL Editor before applying 20261004100000 (whose product
-- checks are validated on apply and fail if a row breaks them) and before
-- VALIDATE CONSTRAINT on the rules of 20261029090600. It changes nothing.
-- Each row found needs a decision by the shop or the owner; nothing is
-- corrected automatically.
-- =============================================================================
SELECT 'devices' AS tbl, id::text, merchant_id::text, concat_ws(' ', brand, model) AS item,
       price::text, cost::text, NULL::text AS quantity
  FROM public.devices WHERE price < 0 OR cost < 0
UNION ALL
SELECT 'accessories', id::text, merchant_id::text, name, price::text, cost::text, quantity::text
  FROM public.accessories WHERE price < 0 OR cost < 0 OR quantity < 0
UNION ALL
SELECT 'repair_parts', id::text, merchant_id::text, name, price::text, cost::text, quantity::text
  FROM public.repair_parts WHERE price < 0 OR cost < 0 OR quantity < 0
UNION ALL
SELECT 'sale_items', id::text, NULL, sale_id::text, unit_price::text, cost_at_sale::text, quantity::text
  FROM public.sale_items WHERE quantity < 1 OR unit_price < 0 OR COALESCE(cost_at_sale, 0) < 0
UNION ALL
SELECT 'purchase_order_items', id::text, NULL, purchase_order_id::text, unit_cost::text, NULL, quantity::text
  FROM public.purchase_order_items WHERE quantity < 1 OR unit_cost < 0
UNION ALL
SELECT 'wholesale_listings', id::text, merchant_id::text, item_type, wholesale_price::text, NULL, min_quantity::text
  FROM public.wholesale_listings WHERE wholesale_price <= 0 OR min_quantity < 1
UNION ALL
SELECT 'coupons', id::text, merchant_id::text, code, discount_value::text, discount_type, NULL
  FROM public.coupons
 WHERE discount_value <= 0 OR (discount_type = 'percentage' AND discount_value > 100)
    OR COALESCE(max_discount_amount, 0) < 0 OR COALESCE(min_order_amount, 0) < 0
ORDER BY 1, 3;
