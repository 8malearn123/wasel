-- =====================================================================
-- Daily closing = the sum of the day's shifts (الإغلاق اليومي من الورديات)
-- ---------------------------------------------------------------------
--   * A shift belongs to the business day (Asia/Riyadh) on which it was
--     opened, even if it runs past midnight. The old closing page split
--     days at midnight UTC (03:00 in KSA).
--   * daily_summary() aggregates the branch's shifts for a day, plus any
--     sales of that day that belong to no shift (imports, pre-shift data).
--   * close_day() is for managers only. It requires every shift of the day
--     to be approved, writes the daily_closings row from the shifts, and
--     after that no shift can be opened on that day.
--   * daily_closings is written only by close_day(): the client-side
--     INSERT/UPDATE policies are removed.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Business day
-- ---------------------------------------------------------------------
-- All merchants are in KSA today; make this a merchant setting if that changes.
CREATE OR REPLACE FUNCTION public.shop_date(_ts timestamptz)
RETURNS date
LANGUAGE sql
STABLE
AS $$ SELECT (_ts AT TIME ZONE 'Asia/Riyadh')::date $$;

ALTER TABLE public.cash_shifts
    ADD COLUMN business_date date NOT NULL DEFAULT public.shop_date(now());
UPDATE public.cash_shifts SET business_date = public.shop_date(opened_at);
CREATE INDEX cash_shifts_branch_day_idx ON public.cash_shifts (branch_id, business_date);

ALTER TABLE public.daily_closings
    ADD COLUMN IF NOT EXISTS source        text NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'shifts')),    -- 'manual' = closed by the old page
    ADD COLUMN IF NOT EXISTS shifts_count  integer,
    ADD COLUMN IF NOT EXISTS opening_cash  numeric(12, 2),
    ADD COLUMN IF NOT EXISTS cash_in       numeric(12, 2),
    ADD COLUMN IF NOT EXISTS cash_out      numeric(12, 2),
    ADD COLUMN IF NOT EXISTS expenses      numeric(12, 2),
    ADD COLUMN IF NOT EXISTS expected_cash numeric(12, 2),
    ADD COLUMN IF NOT EXISTS closed_at     timestamptz;

-- Only close_day() writes closings from now on.
DROP POLICY IF EXISTS "Users can create closings" ON public.daily_closings;
DROP POLICY IF EXISTS "Users can update own closings" ON public.daily_closings;


-- ---------------------------------------------------------------------
-- 2. daily_figures(): raw figures for a branch and day (internal, not blind)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_figures(_branch_id uuid, _date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _result jsonb;
BEGIN
    WITH day_shifts AS (
        SELECT s.*,
               COALESCE((SELECT SUM(p.amount) FROM public.sales x
                         JOIN public.sale_payments p ON p.sale_id = x.id
                         WHERE x.shift_id = s.id AND p.method = 'cash'), 0)                          AS live_cash_sales,
               COALESCE((SELECT SUM(amount) FROM public.cash_movements m WHERE m.shift_id = s.id AND m.type = 'cash_in'), 0)  AS live_in,
               COALESCE((SELECT SUM(amount) FROM public.cash_movements m WHERE m.shift_id = s.id AND m.type = 'cash_out'), 0) AS live_out,
               COALESCE((SELECT SUM(amount) FROM public.cash_movements m WHERE m.shift_id = s.id AND m.type = 'expense'), 0)  AS live_exp
        FROM public.cash_shifts s
        WHERE s.branch_id = _branch_id AND s.business_date = _date
    ),
    shifts AS (
        SELECT *, opening_cash + live_cash_sales + live_in - live_out - live_exp AS live_expected
        FROM day_shifts
    ),
    day_sales AS (
        SELECT x.*
        FROM public.sales x
        WHERE x.branch_id = _branch_id
          AND (x.shift_id IN (SELECT id FROM shifts)
               OR (x.shift_id IS NULL AND public.shop_date(x.sale_date) = _date))
    ),
    -- Tender lines; legacy sales without lines fall back to the header method.
    tenders AS (
        SELECT p.method::text AS method, p.amount
        FROM public.sale_payments p JOIN day_sales d ON d.id = p.sale_id
        UNION ALL
        SELECT d.payment_method::text, d.total_amount
        FROM day_sales d
        WHERE NOT EXISTS (SELECT 1 FROM public.sale_payments p WHERE p.sale_id = d.id)
    ),
    items AS (
        SELECT si.quantity, si.unit_price, si.line_total, si.item_name, si.imei_snapshot, si.device_id,
               d.invoice_number, d.customer_name, d.sale_date, d.payment_method::text AS sale_method,
               dv.brand, dv.model, a.name AS accessory_name
        FROM public.sale_items si
        JOIN day_sales d ON d.id = si.sale_id
        LEFT JOIN public.devices dv ON dv.id = si.device_id
        LEFT JOIN public.accessories a ON a.id = si.accessory_id
    )
    SELECT jsonb_build_object(
        'shifts', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'id', id, 'shift_no', shift_no, 'status', status,
                       'opened_at', opened_at, 'closed_at', closed_at,
                       'opened_by_name', (SELECT full_name FROM public.profiles WHERE id = opened_by),
                       'opening_cash', opening_cash, 'cash_sales', live_cash_sales,
                       'cash_in', live_in, 'cash_out', live_out, 'expenses', live_exp,
                       'expected_cash', live_expected, 'counted_cash', counted_cash, 'difference', difference
                   ) ORDER BY shift_no), '[]'::jsonb) FROM shifts),
        'shift_counts', (SELECT jsonb_build_object(
                       'total', COUNT(*),
                       'open', COUNT(*) FILTER (WHERE status = 'open'),
                       'pending', COUNT(*) FILTER (WHERE status = 'pending_approval'),
                       'closed', COUNT(*) FILTER (WHERE status = 'closed')) FROM shifts),
        'cash', (SELECT jsonb_build_object(
                       'opening',    COALESCE(SUM(opening_cash), 0),
                       'sales',      COALESCE(SUM(live_cash_sales), 0),
                       'cash_in',    COALESCE(SUM(live_in), 0),
                       'cash_out',   COALESCE(SUM(live_out), 0),
                       'expenses',   COALESCE(SUM(live_exp), 0),
                       'expected',   COALESCE(SUM(live_expected), 0),
                       'counted',    SUM(counted_cash),
                       'difference', SUM(difference)) FROM shifts),
        'sales', (SELECT jsonb_build_object(
                       'count',    COUNT(*),
                       'total',    COALESCE(SUM(total_amount), 0),
                       'tax',      COALESCE(SUM(tax_amount), 0),
                       'discount', COALESCE(SUM(discount_amount), 0),
                       'outside_shifts', COUNT(*) FILTER (WHERE shift_id IS NULL)) FROM day_sales),
        'tenders', (SELECT jsonb_build_object(
                       'cash', COALESCE(SUM(CASE WHEN method = 'cash' THEN amount WHEN method = 'mixed' THEN amount / 2 END), 0),
                       'card', COALESCE(SUM(CASE WHEN method IN ('card', 'mada', 'apple_pay', 'stc_pay') THEN amount
                                                 WHEN method = 'mixed' THEN amount / 2 END), 0),
                       'bank_transfer', COALESCE(SUM(CASE WHEN method = 'bank_transfer' THEN amount END), 0)) FROM tenders),
        'by_method', (SELECT COALESCE(jsonb_agg(jsonb_build_object('method', method, 'amount', amount) ORDER BY method), '[]'::jsonb)
                      FROM (SELECT method, SUM(amount) AS amount FROM tenders GROUP BY method) m),
        'devices_sold', (SELECT COALESCE(SUM(quantity), 0) FROM items WHERE device_id IS NOT NULL OR imei_snapshot IS NOT NULL),
        'accessories_sold', (SELECT COALESCE(SUM(quantity), 0) FROM items WHERE device_id IS NULL AND imei_snapshot IS NULL),
        'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'name', COALESCE(item_name, NULLIF(TRIM(CONCAT_WS(' ', brand, model)), ''), accessory_name, '-'),
                       'type', CASE WHEN device_id IS NOT NULL OR imei_snapshot IS NOT NULL THEN 'device' ELSE 'accessory' END,
                       'quantity', quantity, 'unit_price', unit_price,
                       'total', COALESCE(line_total, unit_price * quantity),
                       'payment_method', sale_method, 'invoice_number', invoice_number,
                       'customer_name', customer_name, 'sale_time', sale_date
                   ) ORDER BY sale_date), '[]'::jsonb) FROM items)
    ) INTO _result;

    RETURN _result;
END;
$$;
REVOKE ALL ON FUNCTION public.daily_figures(uuid, date) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. daily_summary(): what the closing page shows
-- ---------------------------------------------------------------------
-- Same blind-count rule as shifts: cashiers don't see expected cash or
-- differences of shifts that a manager hasn't approved yet.
CREATE OR REPLACE FUNCTION public.daily_summary(_branch_id uuid, _date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _actor    record;
    _f        jsonb;
    _counts   jsonb;
    _closing  public.daily_closings%ROWTYPE;
    _closed   boolean;
    _all_ok   boolean;
    _blockers text[] := '{}';
BEGIN
    SELECT * INTO _actor FROM public.shift_actor(_branch_id);
    IF _date IS NULL THEN
        RAISE EXCEPTION 'التاريخ غير صالح' USING HINT = 'INVALID_DATE';
    END IF;

    _f := public.daily_figures(_branch_id, _date);
    _counts := _f->'shift_counts';
    SELECT * INTO _closing FROM public.daily_closings WHERE branch_id = _branch_id AND closing_date = _date;
    _closed := FOUND AND _closing.status = 'closed';
    _all_ok := (_counts->>'open')::int = 0 AND (_counts->>'pending')::int = 0;

    IF NOT _actor.is_manager THEN
        -- Blind count for cashiers.
        _f := jsonb_set(_f, '{shifts}', (
            SELECT COALESCE(jsonb_agg(CASE WHEN s->>'status' = 'closed' THEN s
                                           ELSE s || '{"expected_cash": null, "difference": null}'::jsonb END), '[]'::jsonb)
            FROM jsonb_array_elements(_f->'shifts') s));
        IF NOT _all_ok THEN
            _f := jsonb_set(_f, '{cash}', (_f->'cash') || '{"expected": null, "difference": null}'::jsonb);
        END IF;
    END IF;

    IF _closed THEN
        _blockers := array_append(_blockers, 'ALREADY_CLOSED');
    ELSE
        IF (_counts->>'total')::int = 0 THEN _blockers := array_append(_blockers, 'NO_SHIFTS'); END IF;
        IF (_counts->>'open')::int > 0 THEN _blockers := array_append(_blockers, 'OPEN_SHIFTS'); END IF;
        IF (_counts->>'pending')::int > 0 THEN _blockers := array_append(_blockers, 'PENDING_SHIFTS'); END IF;
        IF NOT _actor.is_manager THEN _blockers := array_append(_blockers, 'MANAGER_REQUIRED'); END IF;
    END IF;

    RETURN _f - 'shift_counts' || jsonb_build_object(
        'date', _date,
        'branch_id', _branch_id,
        'shift_counts', _counts,
        'closing', CASE WHEN _closing.id IS NULL THEN NULL ELSE jsonb_build_object(
                       'status', _closing.status, 'source', _closing.source,
                       'closed_at', COALESCE(_closing.closed_at, _closing.updated_at),
                       'closed_by_name', (SELECT full_name FROM public.profiles WHERE id = _closing.closed_by),
                       'cash_counted', _closing.cash_counted, 'cash_difference', _closing.cash_difference,
                       'notes', _closing.notes) END,
        'blockers', to_jsonb(_blockers),
        'can_close', cardinality(_blockers) = 0
    );
END;
$$;


-- ---------------------------------------------------------------------
-- 4. close_day(): managers only, after every shift is approved
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_day(
    _branch_id uuid,
    _date      date,
    _notes     text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _actor  record;
    _f      jsonb;
    _counts jsonb;
BEGIN
    SELECT * INTO _actor FROM public.shift_actor(_branch_id);
    IF NOT _actor.is_manager THEN
        RAISE EXCEPTION 'إغلاق اليوم للمدير فقط' USING ERRCODE = '42501', HINT = 'MANAGER_REQUIRED';
    END IF;
    IF _date IS NULL OR _date > public.shop_date(now()) THEN
        RAISE EXCEPTION 'التاريخ غير صالح' USING HINT = 'INVALID_DATE';
    END IF;

    -- Same lock as open_shift(): no shift can open while the day is being closed.
    PERFORM 1 FROM public.branches WHERE id = _branch_id FOR UPDATE;

    IF EXISTS (SELECT 1 FROM public.daily_closings
               WHERE branch_id = _branch_id AND closing_date = _date AND status = 'closed') THEN
        RAISE EXCEPTION 'تم إغلاق هذا اليوم مسبقاً' USING HINT = 'DAY_ALREADY_CLOSED';
    END IF;

    _f := public.daily_figures(_branch_id, _date);
    _counts := _f->'shift_counts';

    IF (_counts->>'total')::int = 0 THEN
        RAISE EXCEPTION 'لا توجد ورديات في هذا اليوم' USING HINT = 'NO_SHIFTS';
    ELSIF (_counts->>'open')::int > 0 THEN
        RAISE EXCEPTION 'يوجد ورديات مفتوحة، أغلقها أولاً' USING HINT = 'OPEN_SHIFTS';
    ELSIF (_counts->>'pending')::int > 0 THEN
        RAISE EXCEPTION 'يوجد ورديات بانتظار اعتماد المدير' USING HINT = 'PENDING_SHIFTS';
    END IF;

    INSERT INTO public.daily_closings (
        merchant_id, branch_id, closing_date, source, status,
        cash_sales, card_sales, bank_transfer_sales, total_sales, total_tax, total_discount,
        transactions_count, devices_sold, accessories_sold,
        shifts_count, opening_cash, cash_in, cash_out, expenses, expected_cash,
        cash_counted, cash_difference, notes, closed_by, closed_at
    ) VALUES (
        _actor.merchant_id, _branch_id, _date, 'shifts', 'closed',
        (_f->'tenders'->>'cash')::numeric, (_f->'tenders'->>'card')::numeric, (_f->'tenders'->>'bank_transfer')::numeric,
        (_f->'sales'->>'total')::numeric, (_f->'sales'->>'tax')::numeric, (_f->'sales'->>'discount')::numeric,
        (_f->'sales'->>'count')::int, (_f->>'devices_sold')::int, (_f->>'accessories_sold')::int,
        (_counts->>'total')::int, (_f->'cash'->>'opening')::numeric, (_f->'cash'->>'cash_in')::numeric,
        (_f->'cash'->>'cash_out')::numeric, (_f->'cash'->>'expenses')::numeric, (_f->'cash'->>'expected')::numeric,
        (_f->'cash'->>'counted')::numeric, (_f->'cash'->>'difference')::numeric,
        NULLIF(TRIM(_notes), ''), auth.uid(), now()
    )
    ON CONFLICT (branch_id, closing_date) DO UPDATE SET
        source = EXCLUDED.source, status = EXCLUDED.status,
        cash_sales = EXCLUDED.cash_sales, card_sales = EXCLUDED.card_sales,
        bank_transfer_sales = EXCLUDED.bank_transfer_sales, total_sales = EXCLUDED.total_sales,
        total_tax = EXCLUDED.total_tax, total_discount = EXCLUDED.total_discount,
        transactions_count = EXCLUDED.transactions_count, devices_sold = EXCLUDED.devices_sold,
        accessories_sold = EXCLUDED.accessories_sold, shifts_count = EXCLUDED.shifts_count,
        opening_cash = EXCLUDED.opening_cash, cash_in = EXCLUDED.cash_in, cash_out = EXCLUDED.cash_out,
        expenses = EXCLUDED.expenses, expected_cash = EXCLUDED.expected_cash,
        cash_counted = EXCLUDED.cash_counted, cash_difference = EXCLUDED.cash_difference,
        notes = EXCLUDED.notes, closed_by = EXCLUDED.closed_by, closed_at = EXCLUDED.closed_at,
        updated_at = now();

    RETURN public.daily_summary(_branch_id, _date);
END;
$$;


-- ---------------------------------------------------------------------
-- 5. open_shift(): refuse once the business day is closed
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_shift(
    _branch_id    uuid,
    _opening_cash numeric,
    _notes        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _actor record;
    _today date := public.shop_date(now());
    _id    uuid;
BEGIN
    SELECT * INTO _actor FROM public.shift_actor(_branch_id);

    IF _opening_cash IS NULL OR _opening_cash < 0 THEN
        RAISE EXCEPTION 'رصيد الدرج الافتتاحي غير صالح' USING HINT = 'INVALID_AMOUNT';
    END IF;

    -- Serializes shift opening and day closing per branch (also keeps shift_no gap-free).
    PERFORM 1 FROM public.branches WHERE id = _branch_id FOR UPDATE;

    IF EXISTS (SELECT 1 FROM public.cash_shifts WHERE branch_id = _branch_id AND status = 'open') THEN
        RAISE EXCEPTION 'توجد وردية مفتوحة في هذا الفرع' USING HINT = 'SHIFT_ALREADY_OPEN';
    END IF;
    IF EXISTS (SELECT 1 FROM public.daily_closings
               WHERE branch_id = _branch_id AND closing_date = _today AND status = 'closed') THEN
        RAISE EXCEPTION 'تم إغلاق يوم العمل لهذا الفرع' USING HINT = 'DAY_CLOSED';
    END IF;

    INSERT INTO public.cash_shifts (merchant_id, branch_id, shift_no, business_date, opening_cash, opening_notes, opened_by)
    VALUES (_actor.merchant_id, _branch_id,
            (SELECT COALESCE(MAX(shift_no), 0) + 1 FROM public.cash_shifts WHERE branch_id = _branch_id),
            _today, ROUND(_opening_cash, 2), NULLIF(TRIM(_notes), ''), auth.uid())
    RETURNING id INTO _id;

    RETURN public.shift_report(_id);
END;
$$;


-- ---------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.daily_summary(uuid, date)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_day(uuid, date, text)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_summary(uuid, date)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_day(uuid, date, text) TO authenticated;
