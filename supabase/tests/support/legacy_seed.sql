-- =====================================================================
-- TEST ONLY: legacy data as it existed BEFORE the Phase 0/1 migrations.
-- The runner inserts it right before 20261018100000, so the data-fix and
-- backfill steps of those migrations run against realistic old rows.
-- IDs are mirrored in supabase/tests/db/fixtures.ts.
-- =====================================================================
INSERT INTO auth.users (id, email) VALUES
 ('a1000000-0000-0000-0000-000000000001','owner@test'),('a1000000-0000-0000-0000-000000000002','cashier@test'),('a1000000-0000-0000-0000-000000000003','other@test');
INSERT INTO merchants (id, name) VALUES ('11111111-1111-1111-1111-111111111111','Demo Mobiles'),('22222222-2222-2222-2222-222222222222','Other Shop');
INSERT INTO branches (id, merchant_id, name, created_at) VALUES
 ('b1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Main','2026-01-01'),
 ('b1000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Mall','2026-01-02'),
 ('b2000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Other','2026-01-01');
INSERT INTO merchant_users (merchant_id, user_id, role, branch_id) VALUES
 ('11111111-1111-1111-1111-111111111111','a1000000-0000-0000-0000-000000000001','owner',NULL),
 ('11111111-1111-1111-1111-111111111111','a1000000-0000-0000-0000-000000000002','cashier','b1000000-0000-0000-0000-000000000001'),
 ('22222222-2222-2222-2222-222222222222','a1000000-0000-0000-0000-000000000003','owner',NULL);
INSERT INTO store_settings (merchant_id, slug, is_published, shipping_cost, free_shipping_threshold) VALUES ('11111111-1111-1111-1111-111111111111','demo',true,25,500);
INSERT INTO devices (id, merchant_id, branch_id, imei, model, brand, storage, color, cost, price, status) VALUES
 ('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','356000000000011','iPhone 13','Apple','128GB','Blue',900,1150,'available'),
 ('d0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','356000000000029','iPhone 15 Pro','Apple','256GB','Black',4000,4600,'available'),
 ('d0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000002','356000000000037','Galaxy S24','Samsung','256GB','Gray',2500,3000,'available'),
 ('d0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','356000000000045','Pixel 8','Google','128GB','White',1800,2300,'available'),
 ('d0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','356000000000052','iPhone 12','Apple','64GB','Red',800,1150,'sold');
INSERT INTO accessories (id, merchant_id, branch_id, sku, name, cost, price, quantity) VALUES
 ('ac000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','ACC-1','USB-C Charger',50,115,5),
 ('ac000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','ACC-2','Screen Guard',10,57.5,1);
INSERT INTO customers (id, merchant_id, name, phone) VALUES ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Sara','0551234567');
-- S1: written by the buggy createSale (VAT added on top)
INSERT INTO sales (id, merchant_id, branch_id, invoice_number, customer_phone, subtotal, tax_amount, discount_amount, total_amount, payment_method, sale_date, created_at)
VALUES ('51000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','INV-20260301-0001',NULL,1150,172.5,0,1322.5,'cash','2026-03-01 10:00Z','2026-03-01 10:00Z');
INSERT INTO sale_items (sale_id, device_id, quantity, unit_price, cost_at_sale) VALUES ('51000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000005',1,1150,800);
-- S2: correct VAT-inclusive (seed style), DUPLICATE invoice number
INSERT INTO sales (id, merchant_id, branch_id, invoice_number, customer_phone, subtotal, tax_amount, discount_amount, total_amount, payment_method, sale_date, created_at)
VALUES ('51000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','INV-20260301-0001','+966 55 123 4567',1000,150,0,1150,'card','2026-03-01 11:00Z','2026-03-01 11:00Z');
INSERT INTO sale_items (sale_id, accessory_id, quantity, unit_price, cost_at_sale) VALUES ('51000000-0000-0000-0000-000000000002','ac000000-0000-0000-0000-000000000001',10,115,50);
-- S3: buggy with discount, mixed
INSERT INTO sales (id, merchant_id, branch_id, invoice_number, subtotal, tax_amount, discount_amount, total_amount, payment_method, sale_date, created_at)
VALUES ('51000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','INV-20260301-0002',230,34.5,30,234.5,'mixed','2026-03-01 12:00Z','2026-03-01 12:00Z');
INSERT INTO sale_items (sale_id, accessory_id, quantity, unit_price, cost_at_sale) VALUES ('51000000-0000-0000-0000-000000000003','ac000000-0000-0000-0000-000000000001',2,115,50);
INSERT INTO daily_closings (merchant_id, branch_id, closing_date, cash_sales, card_sales, bank_transfer_sales, total_sales, total_tax, total_discount, transactions_count, cash_counted, cash_difference, status)
VALUES ('11111111-1111-1111-1111-111111111111','b1000000-0000-0000-0000-000000000001','2026-03-01',1439.75,1267.25,0,2707,357,30,3,1350,-89.75,'closed');
INSERT INTO online_orders (id, merchant_id, order_number, customer_name, customer_phone, shipping_address, shipping_city, created_at) VALUES
 ('0e000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','ORD-20260301-0001','Ali','0500000001','x','Riyadh','2026-03-01'),
 ('0e000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','ORD-20260301-0001','Omar','0500000002','x','Riyadh','2026-03-02');
INSERT INTO repair_orders (merchant_id, repair_number, customer_name, customer_phone, device_type, issue_description, status, warranty_ends_at)
VALUES ('11111111-1111-1111-1111-111111111111','REP-1','Sara','0551234567','phone','screen','delivered','2026-01-01');
