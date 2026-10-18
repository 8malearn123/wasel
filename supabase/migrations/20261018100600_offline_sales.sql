-- =====================================================================
-- Offline selling (البيع بدون إنترنت)
-- ---------------------------------------------------------------------
-- When the connection drops, the till keeps selling from its cached branch
-- stock, under its own invoice series, and queues each sale on the device.
-- Back online, each queued sale is replayed through pos_checkout(), so every
-- check runs again: unit still free, enough stock, same price, open shift.
--
--   * Terminals: each till registers once per branch (T1, T2 ... per merchant).
--     Its offline invoices are numbered OFF-T1-000001, OFF-T1-000002, ...
--     The number printed for the customer is the one stored, and the
--     branch's INV- series is never consumed by offline sales.
--   * Idempotent: each queued sale carries a client-generated UUID
--     (sales.client_ref), so a replay after a lost response does nothing twice.
--   * A sale the server refuses (unit sold elsewhere meanwhile, price
--     changed, no open shift, ...) is not lost: it lands in
--     offline_sale_conflicts for a manager to review.
--   * Offline restrictions (also enforced here): cash / standalone card
--     terminal (mada, card) only, and no discount.
-- =====================================================================


-- (sales.client_ref, the idempotency key, is created with pos_checkout.)

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
CREATE TABLE public.pos_terminals (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    branch_id    uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    code         text NOT NULL,                 -- T1, T2 ... unique per merchant
    name         text,
    registered_by uuid,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (merchant_id, code)
);
ALTER TABLE public.pos_terminals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view their terminals" ON public.pos_terminals
    FOR SELECT TO authenticated USING (merchant_id = get_user_merchant_id());

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS terminal_id        uuid REFERENCES public.pos_terminals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS offline_created_at timestamptz;     -- when the till made the sale

CREATE TABLE public.offline_sale_conflicts (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id    uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    branch_id      uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    terminal_id    uuid REFERENCES public.pos_terminals(id) ON DELETE SET NULL,
    client_ref     uuid NOT NULL UNIQUE,
    invoice_number text NOT NULL,               -- printed on the customer's receipt
    sold_at        timestamptz NOT NULL,
    payload        jsonb NOT NULL,              -- items, payments, customer, offline totals
    reason         text NOT NULL,
    hint           text,
    submitted_by   uuid,
    created_at     timestamptz NOT NULL DEFAULT now(),
    resolved_at    timestamptz,
    resolved_by    uuid,
    resolution     text
);
CREATE INDEX offline_sale_conflicts_open_idx ON public.offline_sale_conflicts (merchant_id) WHERE resolved_at IS NULL;
ALTER TABLE public.offline_sale_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view their offline conflicts" ON public.offline_sale_conflicts
    FOR SELECT TO authenticated USING (merchant_id = get_user_merchant_id());


-- ---------------------------------------------------------------------
-- 2. register_terminal(): once per till and branch
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_terminal(_branch_id uuid, _name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _actor record;
    _code  text;
    _id    uuid;
BEGIN
    SELECT * INTO _actor FROM public.shift_actor(_branch_id);

    -- Serialize code allocation per merchant.
    PERFORM pg_advisory_xact_lock(hashtext('wasel_terminal:' || _actor.merchant_id::text));
    SELECT 'T' || (COUNT(*) + 1) INTO _code FROM public.pos_terminals WHERE merchant_id = _actor.merchant_id;

    INSERT INTO public.pos_terminals (merchant_id, branch_id, code, name, registered_by)
    VALUES (_actor.merchant_id, _branch_id, _code, NULLIF(TRIM(_name), ''), auth.uid())
    RETURNING id INTO _id;

    RETURN public.terminal_state(_id);
END;
$$;

-- What a till needs to resume its offline series: the highest offline number
-- the server already holds for it (synced sales and conflicts).
CREATE OR REPLACE FUNCTION public.terminal_state(_terminal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _t     public.pos_terminals%ROWTYPE;
    _actor record;
    _last  integer;
BEGIN
    SELECT * INTO _t FROM public.pos_terminals WHERE id = _terminal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الصندوق غير مسجّل' USING HINT = 'TERMINAL_NOT_FOUND';
    END IF;
    SELECT * INTO _actor FROM public.shift_actor(_t.branch_id);
    IF _actor.merchant_id <> _t.merchant_id THEN
        RAISE EXCEPTION 'الصندوق غير مسجّل' USING HINT = 'TERMINAL_NOT_FOUND';
    END IF;

    UPDATE public.pos_terminals SET last_seen_at = now() WHERE id = _terminal_id;

    SELECT COALESCE(MAX(substring(n FROM '(\d+)$')::integer), 0) INTO _last
    FROM (SELECT invoice_number AS n FROM public.sales WHERE terminal_id = _terminal_id
          UNION ALL
          SELECT invoice_number FROM public.offline_sale_conflicts WHERE terminal_id = _terminal_id) x;

    RETURN jsonb_build_object(
        'id', _t.id, 'code', _t.code, 'branch_id', _t.branch_id, 'name', _t.name,
        'invoice_prefix', 'OFF-' || _t.code, 'last_offline_number', _last
    );
END;
$$;


-- ---------------------------------------------------------------------
-- 3. sync_offline_sale(): replay one queued sale (idempotent)
-- ---------------------------------------------------------------------
-- Returns {status: 'synced' | 'conflict', ...}. Authorization and malformed
-- input still raise; business refusals become a conflict for review.
CREATE OR REPLACE FUNCTION public.sync_offline_sale(
    _terminal_id    uuid,
    _client_ref     uuid,
    _invoice_number text,
    _sold_at        timestamptz,
    _items          jsonb,
    _payments       jsonb,
    _customer_name  text DEFAULT NULL,
    _customer_phone text DEFAULT NULL,
    _offline_total  numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _t      public.pos_terminals%ROWTYPE;
    _actor  record;
    _sale   record;
    _c      record;
    _result jsonb;
    _msg    text;
    _hint   text;
BEGIN
    SELECT * INTO _t FROM public.pos_terminals WHERE id = _terminal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الصندوق غير مسجّل' USING HINT = 'TERMINAL_NOT_FOUND';
    END IF;
    SELECT * INTO _actor FROM public.shift_actor(_t.branch_id);
    IF _actor.merchant_id <> _t.merchant_id THEN
        RAISE EXCEPTION 'الصندوق غير مسجّل' USING HINT = 'TERMINAL_NOT_FOUND';
    END IF;

    -- Already handled? (the response of an earlier attempt may have been lost)
    SELECT id, invoice_number INTO _sale FROM public.sales WHERE client_ref = _client_ref;
    IF FOUND THEN
        RETURN jsonb_build_object('status', 'synced', 'sale_id', _sale.id, 'invoice_number', _sale.invoice_number, 'replayed', true);
    END IF;
    SELECT id, reason, hint INTO _c FROM public.offline_sale_conflicts WHERE client_ref = _client_ref;
    IF FOUND THEN
        RETURN jsonb_build_object('status', 'conflict', 'conflict_id', _c.id, 'reason', _c.reason, 'hint', _c.hint, 'replayed', true);
    END IF;

    IF _client_ref IS NULL OR _sold_at IS NULL
       OR _invoice_number IS NULL OR _invoice_number !~ ('^OFF-' || _t.code || '-[0-9]{6}$') THEN
        RAISE EXCEPTION 'بيانات البيع بدون إنترنت غير صالحة' USING HINT = 'INVALID_OFFLINE_SALE';
    END IF;
    IF _payments IS NULL OR jsonb_typeof(_payments) <> 'array' OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(_payments) e WHERE e->>'method' NOT IN ('cash', 'mada', 'card')) THEN
        RAISE EXCEPTION 'طريقة الدفع غير مسموحة بدون إنترنت' USING HINT = 'OFFLINE_PAYMENT_NOT_ALLOWED';
    END IF;

    BEGIN
        IF EXISTS (SELECT 1 FROM public.sales WHERE merchant_id = _t.merchant_id AND invoice_number = _invoice_number) THEN
            RAISE EXCEPTION 'رقم الفاتورة مستخدم مسبقاً' USING HINT = 'DUPLICATE_INVOICE_NUMBER';
        END IF;

        PERFORM set_config('wasel.offline_invoice', _invoice_number, true);
        _result := public.pos_checkout(
            _t.branch_id, _items, _payments, 0, NULL,
            _customer_name, _customer_phone, 'بيع بدون إنترنت', _client_ref);
        PERFORM set_config('wasel.offline_invoice', '', true);

        UPDATE public.sales
        SET terminal_id = _t.id, offline_created_at = _sold_at, sale_date = _sold_at
        WHERE id = (_result->>'sale_id')::uuid;

        RETURN jsonb_build_object('status', 'synced', 'sale_id', _result->>'sale_id',
                                  'invoice_number', _invoice_number, 'total_amount', _result->'total_amount');
    EXCEPTION WHEN OTHERS THEN
        -- Everything above is rolled back (stock, sale, the offline number setting).
        GET STACKED DIAGNOSTICS _msg = MESSAGE_TEXT, _hint = PG_EXCEPTION_HINT;
    END;

    INSERT INTO public.offline_sale_conflicts (
        merchant_id, branch_id, terminal_id, client_ref, invoice_number, sold_at,
        payload, reason, hint, submitted_by
    ) VALUES (
        _t.merchant_id, _t.branch_id, _t.id, _client_ref, _invoice_number, _sold_at,
        jsonb_build_object('items', _items, 'payments', _payments, 'customer_name', _customer_name,
                           'customer_phone', _customer_phone, 'offline_total', _offline_total),
        _msg, NULLIF(_hint, ''), auth.uid()
    )
    RETURNING id INTO _c;

    RETURN jsonb_build_object('status', 'conflict', 'conflict_id', _c.id, 'reason', _msg, 'hint', NULLIF(_hint, ''));
END;
$$;


-- ---------------------------------------------------------------------
-- 4. resolve_offline_conflict(): a manager records how it was settled
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_offline_conflict(_conflict_id uuid, _resolution text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _c     public.offline_sale_conflicts%ROWTYPE;
    _actor record;
BEGIN
    SELECT * INTO _c FROM public.offline_sale_conflicts WHERE id = _conflict_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'السجل غير موجود' USING HINT = 'CONFLICT_NOT_FOUND';
    END IF;
    SELECT * INTO _actor FROM public.shift_actor(_c.branch_id);
    IF _actor.merchant_id <> _c.merchant_id THEN
        RAISE EXCEPTION 'السجل غير موجود' USING HINT = 'CONFLICT_NOT_FOUND';
    END IF;
    IF NOT _actor.is_manager THEN
        RAISE EXCEPTION 'للمدير فقط' USING ERRCODE = '42501', HINT = 'MANAGER_REQUIRED';
    END IF;
    IF _c.resolved_at IS NOT NULL THEN
        RAISE EXCEPTION 'تمت معالجته مسبقاً' USING HINT = 'ALREADY_RESOLVED';
    END IF;
    IF NULLIF(TRIM(_resolution), '') IS NULL THEN
        RAISE EXCEPTION 'اكتب كيف تمت المعالجة' USING HINT = 'RESOLUTION_REQUIRED';
    END IF;

    UPDATE public.offline_sale_conflicts
    SET resolved_at = now(), resolved_by = auth.uid(), resolution = TRIM(_resolution)
    WHERE id = _conflict_id;
END;
$$;


-- ---------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.register_terminal(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.terminal_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_offline_sale(uuid, uuid, text, timestamptz, jsonb, jsonb, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_offline_conflict(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_terminal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.terminal_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_offline_sale(uuid, uuid, text, timestamptz, jsonb, jsonb, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_offline_conflict(uuid, text) TO authenticated;
