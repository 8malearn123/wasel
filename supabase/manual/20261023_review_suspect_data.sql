-- Review of data that looks like test input — run by hand in the SQL editor.
-- NOT a migration: nothing here runs on its own, and parts 1–3 only read.
--
-- Reported examples: a device named «ipo» priced 8,689,090 SAR; wholesale
-- listings at 1 or 6 SAR with a minimum order of 1000. Such rows inflate the
-- stock value (the «ipo» device alone is ~8.7M of the 77.2M shown).
--
-- Step 1–3: look. Step 4: only for rows confirmed as test data, and only in
-- the demo shops (owners with a @wasil.demo email). Real shops are never
-- touched by this file.

-- 1. Devices whose price is far outside the shop's normal range, or whose
--    name is too short to be a real model
SELECT m.name AS shop, d.id, d.model, d.brand, d.price, d.cost, d.status, d.created_at
FROM public.devices d
JOIN public.merchants m ON m.id = d.merchant_id
WHERE d.price >= 1000000
   OR d.price <= 0
   OR length(trim(d.model)) <= 3
   OR (d.cost > 0 AND d.price > d.cost * 20)
ORDER BY d.price DESC;

-- 2. Accessories with an implausible price or quantity
SELECT m.name AS shop, a.id, a.name, a.sku, a.price, a.cost, a.quantity
FROM public.accessories a
JOIN public.merchants m ON m.id = a.merchant_id
WHERE a.price >= 100000 OR a.price <= 0 OR a.quantity >= 100000
ORDER BY a.price DESC;

-- 3. Wholesale listings priced like a typo, or with a minimum no shop could meet
SELECT m.name AS shop, l.id, l.item_type, l.wholesale_price, l.min_quantity, l.is_active,
       COALESCE(a.name, d.model) AS product, COALESCE(a.price, d.price) AS retail_price
FROM public.wholesale_listings l
JOIN public.merchants m ON m.id = l.merchant_id
LEFT JOIN public.devices d ON d.id = l.device_id
LEFT JOIN public.accessories a ON a.id = l.accessory_id
WHERE l.wholesale_price < 10
   OR l.min_quantity >= 1000
   OR (COALESCE(a.price, d.price) > 0 AND l.wholesale_price < COALESCE(a.price, d.price) * 0.1)
ORDER BY l.wholesale_price;

-- Which of those shops are the demo shops
SELECT m.id, m.name, u.email
FROM public.merchants m
JOIN public.merchant_users mu ON mu.merchant_id = m.id AND mu.role = 'owner'
JOIN auth.users u ON u.id = mu.user_id
WHERE u.email LIKE '%@wasil.demo';

-- 4. Clean-up, demo shops only. Review the rows above first, then put the ids
--    you confirmed into the arrays and run the block. Wholesale listings are
--    switched off rather than deleted (orders may point at them); a device or
--    accessory that appears on a sale or an order is kept.
/*
BEGIN;

WITH demo AS (
  SELECT mu.merchant_id
  FROM public.merchant_users mu
  JOIN auth.users u ON u.id = mu.user_id
  WHERE mu.role = 'owner' AND u.email LIKE '%@wasil.demo'
)
UPDATE public.wholesale_listings
SET is_active = false, updated_at = now()
WHERE id = ANY (ARRAY[]::uuid[])                -- confirmed listing ids
  AND merchant_id IN (SELECT merchant_id FROM demo);

WITH demo AS (
  SELECT mu.merchant_id
  FROM public.merchant_users mu
  JOIN auth.users u ON u.id = mu.user_id
  WHERE mu.role = 'owner' AND u.email LIKE '%@wasil.demo'
)
DELETE FROM public.devices d
WHERE d.id = ANY (ARRAY[]::uuid[])              -- confirmed device ids
  AND d.merchant_id IN (SELECT merchant_id FROM demo)
  AND NOT EXISTS (SELECT 1 FROM public.sale_items si WHERE si.device_id = d.id)
  AND NOT EXISTS (SELECT 1 FROM public.online_order_items oi WHERE oi.device_id = d.id)
  AND NOT EXISTS (SELECT 1 FROM public.wholesale_listings wl WHERE wl.device_id = d.id);

-- check the counts reported above, then:
COMMIT;   -- or ROLLBACK;
*/
