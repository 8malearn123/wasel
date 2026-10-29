-- No negative price, cost or quantity anywhere money or stock is written.
--
-- Live (QA of 2026-10-28): an accessory with quantity −3, cost −10 and price
-- −20 was saved («Accessory added successfully»), and a coupon of 120%.
-- 20261004100000 puts the checks on devices, accessories and repair parts.
-- This covers the other tables that carry money or stock: invoice lines,
-- purchase orders, wholesale, coupons, transfers, stocktakes, repairs and
-- store order lines.
--
-- Every constraint is added NOT VALID: new and changed rows are checked from
-- now on, rows already stored are not read, so applying this cannot fail on
-- old data and changes none of it. docs/ops/negative-values-report.sql lists
-- the stored rows that break a rule, for a decision row by row; once those
-- are settled, `ALTER TABLE … VALIDATE CONSTRAINT …` makes each rule cover
-- the old rows too.
--
-- Zero stays allowed where it means something (a free line, a gift, a
-- counted 0); quantities that move stock must be at least 1.

DO $$
DECLARE
  _r text[];
  _rules text[][] := ARRAY[
    -- table, constraint, condition, columns that must exist
    ['sale_items',            'sale_items_amounts_valid',            'quantity >= 1 AND unit_price >= 0 AND COALESCE(cost_at_sale, 0) >= 0', 'quantity,unit_price,cost_at_sale'],
    ['purchase_order_items',  'purchase_order_items_amounts_valid',  'quantity >= 1 AND unit_cost >= 0',                                     'quantity,unit_cost'],
    ['wholesale_listings',    'wholesale_listings_amounts_valid',    'wholesale_price > 0 AND min_quantity >= 1',                            'wholesale_price,min_quantity'],
    ['wholesale_order_items', 'wholesale_order_items_amounts_valid', 'quantity >= 1 AND unit_price >= 0',                                    'quantity,unit_price'],
    ['wholesale_orders',      'wholesale_orders_total_valid',        'total_amount >= 0',                                                    'total_amount'],
    ['coupons',               'coupons_amounts_valid',
       'discount_value > 0 AND (discount_type <> ''percentage'' OR discount_value <= 100)'
       || ' AND COALESCE(max_discount_amount, 0) >= 0 AND COALESCE(min_order_amount, 0) >= 0',
       'discount_value,discount_type,max_discount_amount,min_order_amount'],
    ['stock_transfer_items',  'stock_transfer_items_quantity_valid', 'quantity >= 1',                                                        'quantity'],
    ['stocktake_items',       'stocktake_items_quantity_valid',      'system_quantity >= 0 AND COALESCE(counted_quantity, 0) >= 0',          'system_quantity,counted_quantity'],
    ['repair_orders',         'repair_orders_amounts_valid',
       'COALESCE(estimated_cost, 0) >= 0 AND COALESCE(actual_cost, 0) >= 0 AND COALESCE(paid_amount, 0) >= 0',
       'estimated_cost,actual_cost,paid_amount'],
    ['repair_order_parts',    'repair_order_parts_amounts_valid',    'quantity >= 1 AND unit_cost >= 0',                                     'quantity,unit_cost'],
    ['online_order_items',    'online_order_items_amounts_valid',    'COALESCE(quantity, 1) >= 1 AND COALESCE(unit_price, 0) >= 0',          'quantity,unit_price']
  ];
  _missing int;
BEGIN
  FOREACH _r SLICE 1 IN ARRAY _rules LOOP
    CONTINUE WHEN to_regclass('public.' || _r[1]) IS NULL;
    SELECT count(*) INTO _missing
      FROM unnest(string_to_array(_r[4], ',')) c
     WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns ic
                        WHERE ic.table_schema = 'public' AND ic.table_name = _r[1] AND ic.column_name = c);
    IF _missing > 0 THEN
      RAISE NOTICE 'skipping % on %: a column is not there', _r[2], _r[1];
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', _r[1], _r[2]);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID', _r[1], _r[2], _r[3]);
  END LOOP;
END
$$;
