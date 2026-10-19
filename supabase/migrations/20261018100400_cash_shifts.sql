-- =====================================================================
-- Cash shifts (فتح / إغلاق الوردية) and the cash drawer
-- ---------------------------------------------------------------------
-- Business rules (agreed with the shop owner):
--   * One shift per BRANCH: at most one open shift per branch at a time,
--     and every POS sale is attached to it. No open shift, no sale.
--   * Opening: the opening cash in the drawer is entered.
--   * During the shift: cash in / cash out / expense movements, each with
--     a reason and who did it.
--   * Closing: the counted TOTAL is entered (no denominations). The counted
--     amount is compared with
--       expected = opening + cash sales + cash in - cash out - expenses
--     and EVERY close then waits for a manager's approval, whatever the difference.
--   * Blind count: a cashier never sees the expected amount or the
--     difference before a manager has approved the shift.
--
-- Shifts are read and changed only through the RPCs below. The table has
-- no API policies, which is what keeps the count blind.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
CREATE TABLE public.cash_shifts (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id    uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    branch_id      uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    shift_no       integer NOT NULL,                        -- 1, 2, 3 ... per branch
    status         text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'pending_approval', 'closed')),
    opening_cash   numeric(12, 2) NOT NULL CHECK (opening_cash >= 0),
    opening_notes  text,
    opened_by      uuid NOT NULL,
    opened_at      timestamptz NOT NULL DEFAULT now(),
    -- Snapshot taken at close
    counted_cash   numeric(12, 2) CHECK (counted_cash >= 0),
    cash_sales     numeric(12, 2),
    cash_in        numeric(12, 2),
    cash_out       numeric(12, 2),
    expenses       numeric(12, 2),
    expected_cash  numeric(12, 2),
    difference     numeric(12, 2),                          -- counted - expected (negative = shortage)
    closing_notes  text,
    closed_by      uuid,
    closed_at      timestamptz,
    -- Manager approval
    approved_by    uuid,
    approved_at    timestamptz,
    approval_notes text,
    -- Offline sales synced after the close (they were in the drawer when it was counted)
    late_sales_count integer NOT NULL DEFAULT 0,
    late_synced_at   timestamptz,
    -- Tills that hadn't synced when the shift was closed anyway (see check_tills_synced)
    unsynced_tills   jsonb,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (branch_id, shift_no)
);
CREATE UNIQUE INDEX cash_shifts_one_open_per_branch ON public.cash_shifts (branch_id) WHERE status = 'open';
CREATE INDEX cash_shifts_merchant_idx ON public.cash_shifts (merchant_id, opened_at DESC);

CREATE TABLE public.cash_movements (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id    uuid NOT NULL REFERENCES public.cash_shifts(id) ON DELETE CASCADE,
    merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    type        text NOT NULL CHECK (type IN ('cash_in', 'cash_out', 'expense')),
    amount      numeric(12, 2) NOT NULL CHECK (amount > 0),
    reason      text NOT NULL CHECK (length(trim(reason)) > 0),
    created_by  uuid NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cash_movements_shift_idx ON public.cash_movements (shift_id, created_at);

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.cash_shifts(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS sales_shift_id_idx ON public.sales (shift_id);

ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Platform admins may inspect shifts; merchants go through the RPCs.
CREATE POLICY "Platform admins view shifts" ON public.cash_shifts
    FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY "Platform admins view cash movements" ON public.cash_movements
    FOR SELECT TO authenticated USING (is_platform_admin());

CREATE TRIGGER update_cash_shifts_updated_at BEFORE UPDATE ON public.cash_shifts
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ---------------------------------------------------------------------
-- 2. Who is calling, and may they act on this branch?
-- ---------------------------------------------------------------------
-- Same membership rule as get_user_merchant_id(). A cashier or branch
-- manager bound to a branch may only act on that branch.
CREATE OR REPLACE FUNCTION public.shift_actor(
    _branch_id  uuid,
    OUT merchant_id uuid,
    OUT role        public.user_role,
    OUT is_manager  boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _user_branch uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'يجب تسجيل الدخول' USING ERRCODE = '42501', HINT = 'NOT_AUTHENTICATED';
    END IF;

    SELECT mu.merchant_id, mu.role, mu.branch_id
    INTO merchant_id, role, _user_branch
    FROM public.merchant_users mu
    WHERE mu.user_id = auth.uid() AND mu.is_active
    ORDER BY mu.created_at
    LIMIT 1;
    IF merchant_id IS NULL THEN
        RAISE EXCEPTION 'لا تملك صلاحية' USING ERRCODE = '42501', HINT = 'NOT_AUTHORIZED';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = _branch_id AND b.merchant_id = shift_actor.merchant_id) THEN
        RAISE EXCEPTION 'الفرع غير صالح' USING HINT = 'INVALID_BRANCH';
    END IF;

    IF role IN ('cashier', 'branch_manager') AND _user_branch IS NOT NULL AND _user_branch <> _branch_id THEN
        RAISE EXCEPTION 'لا يمكنك العمل على فرع آخر' USING ERRCODE = '42501', HINT = 'WRONG_BRANCH';
    END IF;

    is_manager := role IN ('owner', 'admin', 'branch_manager');
END;
$$;
REVOKE ALL ON FUNCTION public.shift_actor(uuid) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Every sale belongs to the branch's open shift
-- ---------------------------------------------------------------------
-- A trigger rather than a pos_checkout change, so every insert path is
-- covered. FOR SHARE makes close_shift (FOR UPDATE) wait for in-flight
-- sales, so they are in the shift's totals. Inserts without a signed-in
-- user (service role: imports, seed scripts) are left unattached.
CREATE OR REPLACE FUNCTION public.attach_sale_to_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- sync_offline_sale() attaches a sale made offline to the shift that was open when
    -- it was made (passed through a transaction-local setting the API can't set).
    IF NULLIF(current_setting('wasel.sale_shift', true), '') IS NOT NULL THEN
        SELECT id INTO NEW.shift_id
        FROM public.cash_shifts
        WHERE id = current_setting('wasel.sale_shift', true)::uuid AND branch_id = NEW.branch_id
        FOR SHARE;
        IF NEW.shift_id IS NULL THEN
            RAISE EXCEPTION 'الوردية غير موجودة' USING HINT = 'SHIFT_NOT_FOUND';
        END IF;
        RETURN NEW;
    END IF;

    SELECT id INTO NEW.shift_id
    FROM public.cash_shifts
    WHERE branch_id = NEW.branch_id AND status = 'open'
    FOR SHARE;

    IF NEW.shift_id IS NULL THEN
        RAISE EXCEPTION 'لا توجد وردية مفتوحة في هذا الفرع، افتح الوردية أولاً' USING HINT = 'NO_OPEN_SHIFT';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_attach_shift
    BEFORE INSERT ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.attach_sale_to_shift();


-- ---------------------------------------------------------------------
-- 3b. Helpers for offline tills (filled in by the offline-selling migration)
-- ---------------------------------------------------------------------
-- check_tills_synced(): called by close_shift(). Returns the tills that may still
-- hold unsynced sales for this shift (empty here); raises TILLS_NOT_SYNCED unless
-- the closer confirms with _force. 20261018100600_offline_sales.sql replaces it.
CREATE OR REPLACE FUNCTION public.check_tills_synced(_branch_id uuid, _since timestamptz, _force boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$ SELECT '[]'::jsonb $$;
REVOKE ALL ON FUNCTION public.check_tills_synced(uuid, timestamptz, boolean) FROM PUBLIC, anon, authenticated;

-- recompute_shift_totals(): refreshes the snapshot of a counted shift after sales were
-- added to it late (offline sales synced after the close). The counted cash stays:
-- that cash was in the drawer when it was counted.
CREATE OR REPLACE FUNCTION public.recompute_shift_totals(_shift_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _cash     numeric;
    _cash_in  numeric;
    _cash_out numeric;
    _expenses numeric;
BEGIN
    SELECT COALESCE(SUM(p.amount), 0) INTO _cash
    FROM public.sales s JOIN public.sale_payments p ON p.sale_id = s.id
    WHERE s.shift_id = _shift_id AND p.method = 'cash';

    SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'cash_in'), 0),
           COALESCE(SUM(amount) FILTER (WHERE type = 'cash_out'), 0),
           COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
    INTO _cash_in, _cash_out, _expenses
    FROM public.cash_movements WHERE shift_id = _shift_id;

    UPDATE public.cash_shifts
    SET cash_sales    = _cash,
        cash_in       = _cash_in,
        cash_out      = _cash_out,
        expenses      = _expenses,
        expected_cash = opening_cash + _cash + _cash_in - _cash_out - _expenses,
        difference    = counted_cash - (opening_cash + _cash + _cash_in - _cash_out - _expenses)
    WHERE id = _shift_id AND status <> 'open';
END;
$$;
REVOKE ALL ON FUNCTION public.recompute_shift_totals(uuid) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. shift_report(): the X/Z report, blind for cashiers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shift_report(_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _s         public.cash_shifts%ROWTYPE;
    _actor     record;
    _show      boolean;
    _sales     jsonb;
    _by_method jsonb;
    _moves     record;
    _cash      numeric;
BEGIN
    SELECT * INTO _s FROM public.cash_shifts WHERE id = _shift_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الوردية غير موجودة' USING HINT = 'SHIFT_NOT_FOUND';
    END IF;
    SELECT * INTO _actor FROM public.shift_actor(_s.branch_id);
    IF _actor.merchant_id <> _s.merchant_id THEN
        RAISE EXCEPTION 'الوردية غير موجودة' USING HINT = 'SHIFT_NOT_FOUND';
    END IF;

    -- Blind count: cashiers see expected / difference only once approved.
    _show := _actor.is_manager OR _s.status = 'closed';

    SELECT jsonb_build_object('count', COUNT(*), 'total', COALESCE(SUM(total_amount), 0))
    INTO _sales
    FROM public.sales WHERE shift_id = _shift_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('method', method, 'amount', amount) ORDER BY method), '[]'::jsonb)
    INTO _by_method
    FROM (SELECT p.method::text AS method, SUM(p.amount) AS amount
          FROM public.sales s JOIN public.sale_payments p ON p.sale_id = s.id
          WHERE s.shift_id = _shift_id
          GROUP BY p.method) m;

    SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'cash_in'), 0)  AS cash_in,
           COALESCE(SUM(amount) FILTER (WHERE type = 'cash_out'), 0) AS cash_out,
           COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)  AS expenses
    INTO _moves
    FROM public.cash_movements WHERE shift_id = _shift_id;

    SELECT COALESCE(SUM(p.amount), 0) INTO _cash
    FROM public.sales s JOIN public.sale_payments p ON p.sale_id = s.id
    WHERE s.shift_id = _shift_id AND p.method = 'cash';

    RETURN jsonb_build_object(
        'shift', jsonb_build_object(
            'id', _s.id, 'shift_no', _s.shift_no, 'branch_id', _s.branch_id,
            'branch_name', (SELECT name FROM public.branches WHERE id = _s.branch_id),
            'status', _s.status,
            'opening_cash', _s.opening_cash, 'opening_notes', _s.opening_notes,
            'opened_by', _s.opened_by, 'opened_by_name', (SELECT full_name FROM public.profiles WHERE id = _s.opened_by),
            'opened_at', _s.opened_at,
            'counted_cash', _s.counted_cash, 'closing_notes', _s.closing_notes,
            'closed_by', _s.closed_by, 'closed_by_name', (SELECT full_name FROM public.profiles WHERE id = _s.closed_by),
            'closed_at', _s.closed_at,
            'expected_cash', CASE WHEN _show THEN _s.expected_cash END,
            'difference',    CASE WHEN _show THEN _s.difference END,
            'approved_by', _s.approved_by, 'approved_by_name', (SELECT full_name FROM public.profiles WHERE id = _s.approved_by),
            'approved_at', _s.approved_at, 'approval_notes', _s.approval_notes,
            'late_sales_count', _s.late_sales_count, 'late_synced_at', _s.late_synced_at,
            'unsynced_tills', _s.unsynced_tills
        ),
        'sales', _sales || jsonb_build_object('by_method', _by_method),
        'cash', jsonb_build_object(
            'opening',  _s.opening_cash,
            'sales',    COALESCE(_s.cash_sales, _cash),
            'cash_in',  COALESCE(_s.cash_in,  _moves.cash_in),
            'cash_out', COALESCE(_s.cash_out, _moves.cash_out),
            'expenses', COALESCE(_s.expenses, _moves.expenses),
            'expected', CASE WHEN _show THEN
                            COALESCE(_s.expected_cash,
                                     _s.opening_cash + _cash + _moves.cash_in - _moves.cash_out - _moves.expenses)
                        END
        ),
        'movements', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                             'id', m.id, 'type', m.type, 'amount', m.amount, 'reason', m.reason,
                             'created_by_name', pr.full_name, 'created_at', m.created_at)
                             ORDER BY m.created_at), '[]'::jsonb)
                      FROM public.cash_movements m
                      LEFT JOIN public.profiles pr ON pr.id = m.created_by
                      WHERE m.shift_id = _shift_id),
        'can_approve', _actor.is_manager AND _s.status = 'pending_approval'
    );
END;
$$;


-- ---------------------------------------------------------------------
-- 5. open_shift()
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
    _id    uuid;
BEGIN
    SELECT * INTO _actor FROM public.shift_actor(_branch_id);

    IF _opening_cash IS NULL OR _opening_cash < 0 THEN
        RAISE EXCEPTION 'رصيد الدرج الافتتاحي غير صالح' USING HINT = 'INVALID_AMOUNT';
    END IF;

    -- Serialize shift opening per branch (also makes shift_no gap-free).
    PERFORM 1 FROM public.branches WHERE id = _branch_id FOR UPDATE;

    IF EXISTS (SELECT 1 FROM public.cash_shifts WHERE branch_id = _branch_id AND status = 'open') THEN
        RAISE EXCEPTION 'توجد وردية مفتوحة في هذا الفرع' USING HINT = 'SHIFT_ALREADY_OPEN';
    END IF;

    INSERT INTO public.cash_shifts (merchant_id, branch_id, shift_no, opening_cash, opening_notes, opened_by)
    VALUES (_actor.merchant_id, _branch_id,
            (SELECT COALESCE(MAX(shift_no), 0) + 1 FROM public.cash_shifts WHERE branch_id = _branch_id),
            ROUND(_opening_cash, 2), NULLIF(TRIM(_notes), ''), auth.uid())
    RETURNING id INTO _id;

    RETURN public.shift_report(_id);
END;
$$;


-- ---------------------------------------------------------------------
-- 6. current_shift(): the branch's open shift, or NULL
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_shift(_branch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _actor record;
    _id    uuid;
BEGIN
    SELECT * INTO _actor FROM public.shift_actor(_branch_id);
    SELECT id INTO _id FROM public.cash_shifts WHERE branch_id = _branch_id AND status = 'open';
    RETURN CASE WHEN _id IS NULL THEN NULL ELSE public.shift_report(_id) END;
END;
$$;


-- ---------------------------------------------------------------------
-- 7. record_cash_movement(): cash in / cash out / expense
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_cash_movement(
    _shift_id uuid,
    _type     text,
    _amount   numeric,
    _reason   text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _s     public.cash_shifts%ROWTYPE;
    _actor record;
BEGIN
    SELECT * INTO _s FROM public.cash_shifts WHERE id = _shift_id FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الوردية غير موجودة' USING HINT = 'SHIFT_NOT_FOUND';
    END IF;
    SELECT * INTO _actor FROM public.shift_actor(_s.branch_id);
    IF _actor.merchant_id <> _s.merchant_id THEN
        RAISE EXCEPTION 'الوردية غير موجودة' USING HINT = 'SHIFT_NOT_FOUND';
    END IF;
    IF _s.status <> 'open' THEN
        RAISE EXCEPTION 'الوردية مغلقة' USING HINT = 'SHIFT_NOT_OPEN';
    END IF;
    IF COALESCE(_type, '') NOT IN ('cash_in', 'cash_out', 'expense') THEN
        RAISE EXCEPTION 'نوع الحركة غير صالح' USING HINT = 'INVALID_MOVEMENT_TYPE';
    END IF;
    IF _amount IS NULL OR ROUND(_amount, 2) <= 0 THEN
        RAISE EXCEPTION 'المبلغ غير صالح' USING HINT = 'INVALID_AMOUNT';
    END IF;
    IF NULLIF(TRIM(_reason), '') IS NULL THEN
        RAISE EXCEPTION 'اكتب سبب الحركة' USING HINT = 'REASON_REQUIRED';
    END IF;

    INSERT INTO public.cash_movements (shift_id, merchant_id, type, amount, reason, created_by)
    VALUES (_shift_id, _s.merchant_id, _type, ROUND(_amount, 2), TRIM(_reason), auth.uid());

    RETURN public.shift_report(_shift_id);
END;
$$;


-- ---------------------------------------------------------------------
-- 8. close_shift(): counted total in, waits for a manager
-- ---------------------------------------------------------------------
-- _force: close even though a till may still hold unsynced offline sales for this
-- shift (they'll be added to it when they sync; see check_tills_synced).
CREATE OR REPLACE FUNCTION public.close_shift(
    _shift_id     uuid,
    _counted_cash numeric,
    _notes        text DEFAULT NULL,
    _force        boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _s        public.cash_shifts%ROWTYPE;
    _actor    record;
    _cash     numeric;
    _cash_in  numeric;
    _cash_out numeric;
    _expenses numeric;
    _expected numeric;
    _unsynced jsonb;
BEGIN
    -- FOR UPDATE waits for in-flight sales (they hold FOR SHARE) and blocks
    -- new ones until this transaction ends, so the totals are final.
    SELECT * INTO _s FROM public.cash_shifts WHERE id = _shift_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الوردية غير موجودة' USING HINT = 'SHIFT_NOT_FOUND';
    END IF;
    SELECT * INTO _actor FROM public.shift_actor(_s.branch_id);
    IF _actor.merchant_id <> _s.merchant_id THEN
        RAISE EXCEPTION 'الوردية غير موجودة' USING HINT = 'SHIFT_NOT_FOUND';
    END IF;
    IF _s.status <> 'open' THEN
        RAISE EXCEPTION 'الوردية مغلقة بالفعل' USING HINT = 'SHIFT_NOT_OPEN';
    END IF;
    IF _counted_cash IS NULL OR _counted_cash < 0 THEN
        RAISE EXCEPTION 'المبلغ المعدود غير صالح' USING HINT = 'INVALID_AMOUNT';
    END IF;

    _unsynced := public.check_tills_synced(_s.branch_id, _s.opened_at, COALESCE(_force, false));

    SELECT COALESCE(SUM(p.amount), 0) INTO _cash
    FROM public.sales s JOIN public.sale_payments p ON p.sale_id = s.id
    WHERE s.shift_id = _shift_id AND p.method = 'cash';

    SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'cash_in'), 0),
           COALESCE(SUM(amount) FILTER (WHERE type = 'cash_out'), 0),
           COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
    INTO _cash_in, _cash_out, _expenses
    FROM public.cash_movements WHERE shift_id = _shift_id;

    _expected := _s.opening_cash + _cash + _cash_in - _cash_out - _expenses;

    UPDATE public.cash_shifts
    SET status        = 'pending_approval',
        counted_cash  = ROUND(_counted_cash, 2),
        cash_sales    = _cash,
        cash_in       = _cash_in,
        cash_out      = _cash_out,
        expenses      = _expenses,
        expected_cash = _expected,
        difference    = ROUND(_counted_cash, 2) - _expected,
        closing_notes = NULLIF(TRIM(_notes), ''),
        unsynced_tills = NULLIF(_unsynced, '[]'::jsonb),
        closed_by     = auth.uid(),
        closed_at     = now()
    WHERE id = _shift_id;

    RETURN public.shift_report(_shift_id);
END;
$$;


-- ---------------------------------------------------------------------
-- 9. approve_shift(): every close needs a manager
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_shift(
    _shift_id uuid,
    _notes    text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _s     public.cash_shifts%ROWTYPE;
    _actor record;
BEGIN
    SELECT * INTO _s FROM public.cash_shifts WHERE id = _shift_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الوردية غير موجودة' USING HINT = 'SHIFT_NOT_FOUND';
    END IF;
    SELECT * INTO _actor FROM public.shift_actor(_s.branch_id);
    IF _actor.merchant_id <> _s.merchant_id THEN
        RAISE EXCEPTION 'الوردية غير موجودة' USING HINT = 'SHIFT_NOT_FOUND';
    END IF;
    IF NOT _actor.is_manager THEN
        RAISE EXCEPTION 'اعتماد الوردية للمدير فقط' USING ERRCODE = '42501', HINT = 'MANAGER_REQUIRED';
    END IF;
    IF _s.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'الوردية ليست بانتظار الاعتماد' USING HINT = 'SHIFT_NOT_PENDING';
    END IF;

    UPDATE public.cash_shifts
    SET status = 'closed', approved_by = auth.uid(), approved_at = now(),
        approval_notes = NULLIF(TRIM(_notes), '')
    WHERE id = _shift_id;

    RETURN public.shift_report(_shift_id);
END;
$$;


-- ---------------------------------------------------------------------
-- 10. list_shifts(): history for the shifts page
-- ---------------------------------------------------------------------
-- Managers see every branch (or only their own if bound to one); cashiers
-- see their branch. Expected / difference follow the blind-count rule.
CREATE OR REPLACE FUNCTION public.list_shifts(
    _status text DEFAULT NULL,
    _limit  integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _merchant_id uuid;
    _role        public.user_role;
    _user_branch uuid;
    _is_manager  boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'يجب تسجيل الدخول' USING ERRCODE = '42501', HINT = 'NOT_AUTHENTICATED';
    END IF;
    SELECT mu.merchant_id, mu.role, mu.branch_id INTO _merchant_id, _role, _user_branch
    FROM public.merchant_users mu
    WHERE mu.user_id = auth.uid() AND mu.is_active
    ORDER BY mu.created_at LIMIT 1;
    IF _merchant_id IS NULL THEN
        RAISE EXCEPTION 'لا تملك صلاحية' USING ERRCODE = '42501', HINT = 'NOT_AUTHORIZED';
    END IF;
    _is_manager := _role IN ('owner', 'admin', 'branch_manager');

    RETURN (
        SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'opened_at') DESC), '[]'::jsonb)
        FROM (
            SELECT jsonb_build_object(
                'id', s.id, 'shift_no', s.shift_no, 'branch_id', s.branch_id, 'branch_name', b.name,
                'status', s.status, 'opening_cash', s.opening_cash,
                'opened_at', s.opened_at, 'opened_by_name', po.full_name,
                'closed_at', s.closed_at, 'closed_by_name', pc.full_name,
                'counted_cash', s.counted_cash,
                'expected_cash', CASE WHEN _is_manager OR s.status = 'closed' THEN s.expected_cash END,
                'difference',    CASE WHEN _is_manager OR s.status = 'closed' THEN s.difference END,
                'approved_at', s.approved_at, 'approved_by_name', pa.full_name,
                'late_sales_count', s.late_sales_count,
                'sales_total', (SELECT COALESCE(SUM(total_amount), 0) FROM public.sales WHERE shift_id = s.id)
            ) AS row
            FROM public.cash_shifts s
            JOIN public.branches b ON b.id = s.branch_id
            LEFT JOIN public.profiles po ON po.id = s.opened_by
            LEFT JOIN public.profiles pc ON pc.id = s.closed_by
            LEFT JOIN public.profiles pa ON pa.id = s.approved_by
            WHERE s.merchant_id = _merchant_id
              AND (_user_branch IS NULL OR _role NOT IN ('cashier', 'branch_manager') OR s.branch_id = _user_branch)
              AND (_status IS NULL OR s.status = _status)
            ORDER BY s.opened_at DESC
            LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 500)
        ) x
    );
END;
$$;


-- ---------------------------------------------------------------------
-- 11. Grants: signed-in staff only
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.attach_sale_to_shift() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shift_report(uuid)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_shift(uuid, numeric, text)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_shift(uuid)                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_cash_movement(uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_shift(uuid, numeric, text, boolean)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_shift(uuid, text)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_shifts(text, integer)                  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shift_report(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_shift(uuid, numeric, text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_shift(uuid)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_cash_movement(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_shift(uuid, numeric, text, boolean)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_shift(uuid, text)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_shifts(text, integer)                  TO authenticated;
