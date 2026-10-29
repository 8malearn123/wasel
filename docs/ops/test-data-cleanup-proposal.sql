-- =============================================================================
-- Demo shop test data — PROPOSAL, nothing here runs until approved.
--
-- Shop: «متجر ديمو - باقة الموزع» (6245ba37-9e68-4e5e-9e68-46ffee192fb4), the
-- Max demo used by demo-distributor / demo-admin / demo-cashier / demo-employee.
-- Found by a read-only probe on 2026-10-29 (GitHub Actions run 40942899985).
--
-- | # | Table               | Row                                   | Now                                   | Why                                   |
-- |---|---------------------|---------------------------------------|---------------------------------------|---------------------------------------|
-- | 1 | devices             | 3611ca02-30a9-43de-baa5-580bad6a735e  | model «ipo», price 8,689,090, cost     | a typed test; 99.6% of the unsold     |
-- |   |                     |                                       | 99,897, status transferred (15/08)    | devices' value (8,723,880)            |
-- | 2 | accessories         | dd8cb3ae-c51f-4196-a4de-b1d3b0aa03d6  | «عاع8ل8هع» sku «ارلغبغ», price 888,888,| keyboard noise; 68,444,376 of the     |
-- |   |                     |                                       | cost 888, qty 77 (10/09)              | accessories' value (68,487,208)       |
-- | 3 | wholesale_listings  | 828cbf4e-bb2a-4b7e-b13c-01ce89039f2d  | iPhone 14 Pro 256GB at 6 SAR, min 1   | a buyer could order a phone for 6 SAR |
-- | 4 | wholesale_listings  | 020b04c6-3314-42c7-ab1d-9b72d17f5a69  | Galaxy S24 Ultra 512GB at 1 SAR,      | 1 SAR a phone; min 1000 for a single  |
-- |   |                     |                                       | min 1000                              | device                                |
--
-- Effect on the shop's stock value (products page and reports, 77,211,088):
-- without rows 1 and 2 it is 77,622 (devices 34,790 + accessories 42,832).
-- The listings do not count in stock value; they are offered to buyers.
--
-- Proposed action, reversible where possible (choose per row):
--   1 · device «ipo»       → delete if nothing references it (STEP 1 shows); if a transfer or an
--                            invoice references it, keep it and set its price and cost to 0 instead
--   2 · accessory          → delete if nothing references it, else quantity 0
--   3, 4 · listings        → is_active = false (hidden from the market, kept, reversible)
-- =============================================================================

-- STEP 1 · Preview and references (reads only)
SELECT 'device ipo' AS row, d.id, d.model, d.price, d.cost, d.status,
       (SELECT count(*) FROM public.sale_items si WHERE si.device_id = d.id) AS on_invoices,
       (SELECT count(*) FROM public.stock_transfer_items t WHERE t.device_id = d.id) AS on_transfers,
       (SELECT count(*) FROM public.wholesale_listings l WHERE l.device_id = d.id) AS on_listings
  FROM public.devices d WHERE d.id = '3611ca02-30a9-43de-baa5-580bad6a735e';
SELECT 'accessory' AS row, a.id, a.name, a.price, a.cost, a.quantity,
       (SELECT count(*) FROM public.sale_items si WHERE si.accessory_id = a.id) AS on_invoices,
       (SELECT count(*) FROM public.purchase_order_items p WHERE p.accessory_id = a.id) AS on_purchases,
       (SELECT count(*) FROM public.stock_transfer_items t WHERE t.accessory_id = a.id) AS on_transfers
  FROM public.accessories a WHERE a.id = 'dd8cb3ae-c51f-4196-a4de-b1d3b0aa03d6';
SELECT 'listing' AS row, l.id, l.wholesale_price, l.min_quantity, l.is_active,
       (SELECT count(*) FROM public.wholesale_order_items oi WHERE oi.listing_id = l.id) AS ordered
  FROM public.wholesale_listings l
 WHERE l.id IN ('828cbf4e-bb2a-4b7e-b13c-01ce89039f2d', '020b04c6-3314-42c7-ab1d-9b72d17f5a69');

-- STEP 2 · Only after approval, per row (uncomment what was approved)
-- BEGIN;
-- UPDATE public.wholesale_listings SET is_active = false, updated_at = now()
--  WHERE id IN ('828cbf4e-bb2a-4b7e-b13c-01ce89039f2d', '020b04c6-3314-42c7-ab1d-9b72d17f5a69')
--    AND merchant_id = '6245ba37-9e68-4e5e-9e68-46ffee192fb4';
-- DELETE FROM public.accessories
--  WHERE id = 'dd8cb3ae-c51f-4196-a4de-b1d3b0aa03d6' AND merchant_id = '6245ba37-9e68-4e5e-9e68-46ffee192fb4';
-- DELETE FROM public.devices
--  WHERE id = '3611ca02-30a9-43de-baa5-580bad6a735e' AND merchant_id = '6245ba37-9e68-4e5e-9e68-46ffee192fb4';
-- -- expect 2, 1, 1 rows; otherwise ROLLBACK
-- COMMIT;

-- ROLLBACK of the listings step: SET is_active = true on the same two ids.
-- A deleted row cannot be undone here: copy STEP 1's output before deleting.
