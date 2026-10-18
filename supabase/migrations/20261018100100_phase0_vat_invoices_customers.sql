-- =====================================================================
-- Phase 0 · VAT data fix, lock-safe document numbers, customer links,
--           split-tender table, sale line snapshots
-- =====================================================================
--
-- Pricing convention (applies to the whole system from now on)
-- -------------------------------------------------------------
-- Every shelf/catalog price (devices.price, accessories.price, shipping
-- cost) is VAT-INCLUSIVE (KSA 15%). For a POS sale:
--   total_amount    = Σ(unit_price × qty) − discount_amount   (what the customer pays)
--   tax_amount      = round(total_amount × 15 / 115, 2)       (VAT contained in total)
--   subtotal        = total_amount − tax_amount               (net, excl. VAT)
-- This is exactly what CartPanel and the printed invoice already show.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. D1 · Repair sales rows inflated by the old VAT-exclusive formula
-- ---------------------------------------------------------------------
-- The old useSales.createSale stored:
--   subtotal = Σ(unit_price × qty)          (gross, VAT already inside)
--   tax      = subtotal × 0.15              (VAT added a second time)
--   total    = subtotal + tax − discount    (≈ 15% more than was paid)
-- Correct rows (and every seeded row) have subtotal = gross / 1.15, so the
-- signature "subtotal = Σ line gross AND tax = 15% of subtotal" only matches
-- rows written by the buggy code path.
--
-- Old values are preserved in a backup table for audit/rollback. The
-- table has RLS enabled and no policies, so it is not reachable from the API.

CREATE TABLE IF NOT EXISTS public._vat_fix_sales_backup (
    sale_id           uuid PRIMARY KEY,
    merchant_id       uuid NOT NULL,
    branch_id         uuid,
    sale_date         timestamptz,
    payment_method    text,
    old_subtotal      numeric,
    old_tax           numeric,
    old_discount      numeric,
    old_total         numeric,
    new_subtotal      numeric,
    new_tax           numeric,
    new_total         numeric,
    closing_adjusted  boolean NOT NULL DEFAULT false,
    fixed_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._vat_fix_sales_backup ENABLE ROW LEVEL SECURITY;

WITH line_gross AS (
    SELECT sale_id, SUM(unit_price * quantity) AS gross
    FROM public.sale_items
    GROUP BY sale_id
), candidates AS (
    SELECT s.*,
           GREATEST(s.subtotal - COALESCE(s.discount_amount, 0), 0) AS fixed_total
    FROM public.sales s
    JOIN line_gross g ON g.sale_id = s.id
    WHERE s.subtotal > 0
      AND ABS(s.subtotal - g.gross) <= 0.01
      AND ABS(COALESCE(s.tax_amount, 0) - s.subtotal * 0.15) <= 0.01
)
INSERT INTO public._vat_fix_sales_backup
    (sale_id, merchant_id, branch_id, sale_date, payment_method,
     old_subtotal, old_tax, old_discount, old_total,
     new_subtotal, new_tax, new_total)
SELECT id, merchant_id, branch_id, sale_date, payment_method::text,
       subtotal, tax_amount, discount_amount, total_amount,
       fixed_total - ROUND(fixed_total * 15 / 115, 2),
       ROUND(fixed_total * 15 / 115, 2),
       fixed_total
FROM candidates
ON CONFLICT (sale_id) DO NOTHING;

UPDATE public.sales s
SET subtotal     = b.new_subtotal,
    tax_amount   = b.new_tax,
    total_amount = b.new_total
FROM public._vat_fix_sales_backup b
WHERE b.sale_id = s.id
  AND ABS(s.total_amount - b.old_total) < 0.005;   -- idempotent: only rows not yet fixed

-- Daily closings snapshot the day's totals, so shift them by the same deltas
-- (useDailyClosings buckets by payment_method, 'mixed' split 50/50, UTC days).
WITH d AS (
    SELECT branch_id,
           (sale_date AT TIME ZONE 'UTC')::date AS day,
           SUM(CASE payment_method WHEN 'cash' THEN old_total - new_total
                                   WHEN 'mixed' THEN (old_total - new_total) / 2 ELSE 0 END) AS cash_d,
           SUM(CASE payment_method WHEN 'card' THEN old_total - new_total
                                   WHEN 'mixed' THEN (old_total - new_total) / 2 ELSE 0 END) AS card_d,
           SUM(CASE payment_method WHEN 'bank_transfer' THEN old_total - new_total ELSE 0 END) AS bank_d,
           SUM(old_total - new_total) AS total_d,
           SUM(COALESCE(old_tax, 0) - new_tax) AS tax_d
    FROM public._vat_fix_sales_backup
    WHERE NOT closing_adjusted
    GROUP BY 1, 2
)
UPDATE public.daily_closings c
SET cash_sales          = ROUND(c.cash_sales - d.cash_d, 2),
    card_sales          = ROUND(c.card_sales - d.card_d, 2),
    bank_transfer_sales = ROUND(c.bank_transfer_sales - d.bank_d, 2),
    total_sales         = ROUND(c.total_sales - d.total_d, 2),
    total_tax           = ROUND(c.total_tax - d.tax_d, 2),
    cash_difference     = CASE WHEN c.cash_counted IS NULL THEN c.cash_difference
                               ELSE ROUND(c.cash_counted - (c.cash_sales - d.cash_d), 2) END
FROM d
WHERE c.branch_id = d.branch_id AND c.closing_date = d.day;

UPDATE public._vat_fix_sales_backup SET closing_adjusted = true WHERE NOT closing_adjusted;


-- ---------------------------------------------------------------------
-- 2. D7 · Lock-safe, sequential document numbers
-- ---------------------------------------------------------------------
-- One counter row per (merchant, document type, branch). Taking the next
-- number is a single UPDATE ... RETURNING, so concurrent tills serialize on
-- that row and can never receive the same number. The row lock is held
-- until the surrounding transaction commits; a rolled-back checkout also
-- rolls back its number, so numbering stays gap-free.
--
--   sales_invoice : per branch,   e.g. INV-B1-000001
--   online_order  : per merchant, e.g. ORD-000001
-- The new formats can't collide with the legacy INV-YYYYMMDD-NNNN numbers.

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    branch_id   uuid REFERENCES public.branches(id) ON DELETE CASCADE,
    doc_type    text NOT NULL CHECK (doc_type IN ('sales_invoice', 'online_order')),
    prefix      text NOT NULL,
    last_value  bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_sequences_scope_key
    ON public.invoice_sequences (merchant_id, doc_type,
                                 COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view their sequences" ON public.invoice_sequences
    FOR SELECT TO authenticated
    USING (merchant_id = get_user_merchant_id());

-- Owners/admins may rename a prefix; the counter itself is only moved by
-- next_document_number().
CREATE POLICY "Owners update sequence prefix" ON public.invoice_sequences
    FOR UPDATE TO authenticated
    USING (merchant_id = get_user_merchant_id() AND is_owner_or_admin())
    WITH CHECK (merchant_id = get_user_merchant_id() AND is_owner_or_admin());
REVOKE INSERT, UPDATE, DELETE ON public.invoice_sequences FROM anon, authenticated;
GRANT UPDATE (prefix) ON public.invoice_sequences TO authenticated;

-- Duplicates must go before the UNIQUE constraints can be added. Keep the
-- earliest row's number and suffix the rest (-D2, -D3, ...).
WITH dups AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY merchant_id, invoice_number
                                  ORDER BY created_at, id) AS rn
    FROM public.sales
)
UPDATE public.sales s SET invoice_number = s.invoice_number || '-D' || d.rn
FROM dups d WHERE d.id = s.id AND d.rn > 1;

WITH dups AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY merchant_id, order_number
                                  ORDER BY created_at, id) AS rn
    FROM public.online_orders
)
UPDATE public.online_orders o SET order_number = o.order_number || '-D' || d.rn
FROM dups d WHERE d.id = o.id AND d.rn > 1;

ALTER TABLE public.sales
    ADD CONSTRAINT sales_merchant_invoice_number_key UNIQUE (merchant_id, invoice_number);
ALTER TABLE public.online_orders
    ADD CONSTRAINT online_orders_merchant_order_number_key UNIQUE (merchant_id, order_number);

-- Internal helper. Not callable from the API; used by the checkout RPCs.
CREATE OR REPLACE FUNCTION public.next_document_number(
    _merchant_id uuid,
    _doc_type    text,
    _branch_id   uuid DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _prefix text;
    _value  bigint;
    _number text;
BEGIN
    IF _doc_type NOT IN ('sales_invoice', 'online_order') THEN
        RAISE EXCEPTION 'Unknown document type %', _doc_type;
    END IF;
    IF _doc_type = 'online_order' THEN
        _branch_id := NULL;               -- online orders are numbered per merchant
    END IF;

    LOOP
        UPDATE public.invoice_sequences
        SET last_value = last_value + 1, updated_at = now()
        WHERE merchant_id = _merchant_id
          AND doc_type = _doc_type
          AND branch_id IS NOT DISTINCT FROM _branch_id
        RETURNING prefix, last_value INTO _prefix, _value;

        IF NOT FOUND THEN
            -- First document of this scope: serialize creation per merchant,
            -- then re-check in case a concurrent transaction just created it.
            PERFORM pg_advisory_xact_lock(hashtext('wasel_doc_seq:' || _merchant_id::text));

            UPDATE public.invoice_sequences
            SET last_value = last_value + 1, updated_at = now()
            WHERE merchant_id = _merchant_id
              AND doc_type = _doc_type
              AND branch_id IS NOT DISTINCT FROM _branch_id
            RETURNING prefix, last_value INTO _prefix, _value;

            IF NOT FOUND THEN
                IF _doc_type = 'online_order' THEN
                    _prefix := 'ORD';
                ELSE
                    -- Branch ordinal B1, B2, ... in order of first sale. Branches
                    -- holding sales can't be deleted (sales.branch_id RESTRICT),
                    -- so this count only grows.
                    SELECT 'INV-B' || (COUNT(*) + 1) INTO _prefix
                    FROM public.invoice_sequences
                    WHERE merchant_id = _merchant_id AND doc_type = 'sales_invoice';
                END IF;

                INSERT INTO public.invoice_sequences (merchant_id, branch_id, doc_type, prefix, last_value)
                VALUES (_merchant_id, _branch_id, _doc_type, _prefix, 1)
                RETURNING prefix, last_value INTO _prefix, _value;
            END IF;
        END IF;

        _number := _prefix || '-' || LPAD(_value::text, 6, '0');

        -- A renamed prefix could point at numbers already used; skip them.
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.sales
            WHERE _doc_type = 'sales_invoice' AND merchant_id = _merchant_id AND invoice_number = _number
            UNION ALL
            SELECT 1 FROM public.online_orders
            WHERE _doc_type = 'online_order' AND merchant_id = _merchant_id AND order_number = _number
        );
    END LOOP;

    RETURN _number;
END;
$$;
REVOKE ALL ON FUNCTION public.next_document_number(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

-- Legacy RPCs: keep the signatures for older clients and scripts, but
-- delegate to the lock-safe counter, and refuse other merchants' ids.
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_merchant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _branch uuid;
BEGIN
    IF _merchant_id IS DISTINCT FROM get_user_merchant_id() THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    SELECT id INTO _branch FROM public.branches
    WHERE merchant_id = _merchant_id ORDER BY created_at, id LIMIT 1;
    RETURN public.next_document_number(_merchant_id, 'sales_invoice', _branch);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_online_order_number(_merchant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF _merchant_id IS DISTINCT FROM get_user_merchant_id() THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    RETURN public.next_document_number(_merchant_id, 'online_order', NULL);
END;
$$;


-- ---------------------------------------------------------------------
-- 3. Customer foreign keys (sales, repair_orders)
-- ---------------------------------------------------------------------
-- phone_key(): comparable form of a phone number, made of its last 9 digits.
-- Arabic-Indic digits are converted to ASCII, so '+966 5x', '05x' and '٠٥x'
-- all match.
CREATE OR REPLACE FUNCTION public.phone_key(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN length(d) >= 7 THEN right(d, 9)
    END
    FROM (SELECT regexp_replace(translate(COALESCE(_phone, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'),
                                '[^0-9]', '', 'g') AS d) x
$$;

CREATE INDEX IF NOT EXISTS customers_merchant_phone_key_idx
    ON public.customers (merchant_id, public.phone_key(phone));

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.repair_orders
    ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sales_customer_id_idx ON public.sales (customer_id);
CREATE INDEX IF NOT EXISTS repair_orders_customer_id_idx ON public.repair_orders (customer_id);

-- Backfill only when the phone matches exactly one customer of the merchant.
WITH unique_phones AS (
    SELECT merchant_id, public.phone_key(phone) AS k, (array_agg(id))[1] AS customer_id
    FROM public.customers
    WHERE public.phone_key(phone) IS NOT NULL
    GROUP BY 1, 2
    HAVING COUNT(*) = 1
)
UPDATE public.sales s SET customer_id = u.customer_id
FROM unique_phones u
WHERE s.customer_id IS NULL
  AND u.merchant_id = s.merchant_id
  AND u.k = public.phone_key(s.customer_phone);

WITH unique_phones AS (
    SELECT merchant_id, public.phone_key(phone) AS k, (array_agg(id))[1] AS customer_id
    FROM public.customers
    WHERE public.phone_key(phone) IS NOT NULL
    GROUP BY 1, 2
    HAVING COUNT(*) = 1
)
UPDATE public.repair_orders r SET customer_id = u.customer_id
FROM unique_phones u
WHERE r.customer_id IS NULL
  AND u.merchant_id = r.merchant_id
  AND u.k = public.phone_key(r.customer_phone);


-- ---------------------------------------------------------------------
-- 4. Split tender: sale_payments
-- ---------------------------------------------------------------------
-- One row per tender line, e.g. Cash 500 + Mada 650. sales.payment_method
-- keeps the single method, or 'mixed' when there are several lines.
CREATE TABLE IF NOT EXISTS public.sale_payments (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id    uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    method     public.payment_method NOT NULL CHECK (method <> 'mixed'),
    amount     numeric(12, 2) NOT NULL CHECK (amount > 0),
    reference  text,                         -- terminal approval code, transfer ref, ...
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sale_payments_sale_id_idx ON public.sale_payments (sale_id);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

-- Read-only from the API; rows are written by pos_checkout().
CREATE POLICY "Merchants view their sale payments" ON public.sale_payments
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.sales s
                   WHERE s.id = sale_payments.sale_id
                     AND s.merchant_id = get_user_merchant_id()));

-- Backfill one tender line per legacy single-method sale. Legacy 'mixed'
-- sales have no recorded split, so they are left without lines.
INSERT INTO public.sale_payments (sale_id, method, amount, created_at)
SELECT s.id, s.payment_method, s.total_amount, s.created_at
FROM public.sales s
WHERE s.payment_method <> 'mixed'
  AND s.total_amount > 0
  AND NOT EXISTS (SELECT 1 FROM public.sale_payments p WHERE p.sale_id = s.id);


-- ---------------------------------------------------------------------
-- 5. Sale line snapshots
-- ---------------------------------------------------------------------
-- History must survive later edits or deletion of the device/accessory row.
ALTER TABLE public.sale_items
    ADD COLUMN IF NOT EXISTS item_name     text,
    ADD COLUMN IF NOT EXISTS imei_snapshot text,
    ADD COLUMN IF NOT EXISTS sku_snapshot  text,
    ADD COLUMN IF NOT EXISTS line_discount numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vat_amount    numeric(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS line_total    numeric(12, 2);

UPDATE public.sale_items si
SET item_name     = COALESCE(si.item_name, NULLIF(TRIM(CONCAT_WS(' ', d.brand, d.model, d.storage, d.color)), '')),
    imei_snapshot = COALESCE(si.imei_snapshot, d.imei)
FROM public.devices d
WHERE si.device_id = d.id AND (si.item_name IS NULL OR si.imei_snapshot IS NULL);

UPDATE public.sale_items si
SET item_name    = COALESCE(si.item_name, a.name),
    sku_snapshot = COALESCE(si.sku_snapshot, a.sku)
FROM public.accessories a
WHERE si.accessory_id = a.id AND (si.item_name IS NULL OR si.sku_snapshot IS NULL);

UPDATE public.sale_items
SET line_total = unit_price * quantity
WHERE line_total IS NULL;
