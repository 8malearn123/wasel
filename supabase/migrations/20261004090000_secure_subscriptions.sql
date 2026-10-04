-- =============================================================================
-- Phase 0 · Security — subscriptions, activation codes, trial clock
--
-- What this fixes:
--   1. Any merchant owner could UPDATE their own subscription row (set the plan,
--      the status and the end date) straight from the browser console.
--   2. Activation codes were validated by a regex in the browser; the plaintext
--      code was then written into the subscription. Any string matching
--      ACTIVATE-<n> granted n days, for ever, to anyone, as often as they liked.
--   3. The trial end date was computed from the *browser* clock at signup.
--   4. demo_switch_plan() was granted to every authenticated user.
--
-- Nothing is deleted. Existing rows keep their values; the only behaviour that
-- changes is who is allowed to write them.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1 · Audit trail for everything that touches a subscription
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  -- trial_started | code_redeemed | plan_change_requested | plan_applied | status_changed
  event_type      text NOT NULL,
  from_status     text,
  to_status       text,
  from_plan       text,
  to_plan         text,
  actor_user_id   uuid,
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_events_merchant_idx
  ON public.subscription_events (merchant_id, created_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their subscription events" ON public.subscription_events;
CREATE POLICY "Merchants view their subscription events"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (merchant_id = public.get_user_merchant_id());

DROP POLICY IF EXISTS "Platform admins manage subscription events" ON public.subscription_events;
CREATE POLICY "Platform admins manage subscription events"
  ON public.subscription_events FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Merchants get SELECT only. Rows are written by the SECURITY DEFINER functions
-- below, which bypass RLS, so there is no INSERT policy to abuse.

-- ---------------------------------------------------------------------------
-- 2 · Activation codes — stored hashed, never in plaintext
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activation_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash   text NOT NULL UNIQUE,
  label       text,
  days        integer NOT NULL CHECK (days > 0 AND days <= 1095),
  plan_id     uuid REFERENCES public.plans(id),
  max_uses    integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count  integer NOT NULL DEFAULT 0,
  expires_at  timestamptz,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

-- Platform admins only. Merchants cannot even SELECT, so the table cannot be
-- enumerated and a hash cannot be lifted out of it.
DROP POLICY IF EXISTS "Platform admins manage activation codes" ON public.activation_codes;
CREATE POLICY "Platform admins manage activation codes"
  ON public.activation_codes FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.activation_code_redemptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id      uuid NOT NULL REFERENCES public.activation_codes(id) ON DELETE CASCADE,
  merchant_id  uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  redeemed_by  uuid,
  days_granted integer,
  redeemed_at  timestamptz NOT NULL DEFAULT now(),
  -- one redemption per merchant per code, enforced by the database
  UNIQUE (code_id, merchant_id)
);

ALTER TABLE public.activation_code_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their redemptions" ON public.activation_code_redemptions;
CREATE POLICY "Merchants view their redemptions"
  ON public.activation_code_redemptions FOR SELECT TO authenticated
  USING (merchant_id = public.get_user_merchant_id());

DROP POLICY IF EXISTS "Platform admins manage redemptions" ON public.activation_code_redemptions;
CREATE POLICY "Platform admins manage redemptions"
  ON public.activation_code_redemptions FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- The hash an admin stores and the hash a redemption computes must match, so
-- the rule lives in one place. Codes are compared case-insensitively.
CREATE OR REPLACE FUNCTION public.hash_activation_code(_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(upper(btrim(_code)), 'sha256'), 'hex')
$$;

REVOKE ALL ON FUNCTION public.hash_activation_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hash_activation_code(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3 · One subscription per merchant (the code has always assumed this)
-- ---------------------------------------------------------------------------
DO $$
DECLARE _dupes integer;
BEGIN
  SELECT count(*) INTO _dupes FROM (
    SELECT merchant_id FROM public.subscriptions GROUP BY merchant_id HAVING count(*) > 1
  ) d;
  IF _dupes > 0 THEN
    RAISE WARNING 'subscriptions: % merchant(s) have more than one row — unique index NOT created. Resolve the duplicates, then run: CREATE UNIQUE INDEX subscriptions_merchant_id_key ON public.subscriptions (merchant_id);', _dupes;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_merchant_id_key
      ON public.subscriptions (merchant_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4 · The trial is started by the database, on the database clock
-- ---------------------------------------------------------------------------
-- Length of a new trial. Change this one constant when the trial becomes
-- three months; nothing in the client decides it.
CREATE OR REPLACE FUNCTION public.default_trial_days()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 14 $$;

CREATE OR REPLACE FUNCTION public.start_merchant_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (merchant_id, plan, status, trial_ends_at, max_branches, max_users)
  VALUES (
    NEW.id,
    'trial',
    'trial',
    now() + make_interval(days => public.default_trial_days()),
    1,
    3
  )
  ON CONFLICT (merchant_id) DO NOTHING;

  INSERT INTO public.subscription_events (merchant_id, event_type, to_status, to_plan, actor_user_id, notes)
  VALUES (NEW.id, 'trial_started', 'trial', 'trial', auth.uid(),
          format('%s days, server clock', public.default_trial_days()));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchants_start_trial ON public.merchants;
CREATE TRIGGER merchants_start_trial
  AFTER INSERT ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.start_merchant_trial();

-- A client insert can no longer smuggle in a date: if the row arrives without
-- one, or with one in the past, the server sets it.
CREATE OR REPLACE FUNCTION public.enforce_server_trial_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'trial' AND (NEW.trial_ends_at IS NULL OR NEW.trial_ends_at <= now()) THEN
    NEW.trial_ends_at := now() + make_interval(days => public.default_trial_days());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_server_trial_dates ON public.subscriptions;
CREATE TRIGGER subscriptions_server_trial_dates
  BEFORE INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_server_trial_dates();

-- ---------------------------------------------------------------------------
-- 5 · Redeeming a code — the only way a merchant can extend a subscription
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_activation_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant_id uuid;
  _sub         public.subscriptions%ROWTYPE;
  _code_row    public.activation_codes%ROWTYPE;
  _plan        public.plans%ROWTYPE;
  _hash        text;
  _new_end     timestamptz;
BEGIN
  _merchant_id := public.get_user_merchant_id();
  IF _merchant_id IS NULL THEN
    RAISE EXCEPTION 'not_a_merchant_user' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_merchant_role('owner') THEN
    RAISE EXCEPTION 'owner_role_required' USING ERRCODE = '42501';
  END IF;
  IF _code IS NULL OR btrim(_code) = '' THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = '22023';
  END IF;

  _hash := public.hash_activation_code(_code);

  -- Locked for the length of the transaction: two tabs cannot spend the last use
  SELECT * INTO _code_row FROM public.activation_codes WHERE code_hash = _hash FOR UPDATE;

  IF NOT FOUND OR NOT _code_row.is_active THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = '22023';
  END IF;
  IF _code_row.expires_at IS NOT NULL AND _code_row.expires_at <= now() THEN
    RAISE EXCEPTION 'code_expired' USING ERRCODE = '22023';
  END IF;
  IF _code_row.used_count >= _code_row.max_uses THEN
    RAISE EXCEPTION 'code_already_used' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.activation_code_redemptions
    WHERE code_id = _code_row.id AND merchant_id = _merchant_id
  ) THEN
    RAISE EXCEPTION 'code_already_used' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _sub FROM public.subscriptions WHERE merchant_id = _merchant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_subscription' USING ERRCODE = '22023';
  END IF;

  IF _code_row.plan_id IS NOT NULL THEN
    SELECT * INTO _plan FROM public.plans WHERE id = _code_row.plan_id AND is_active = true;
  END IF;

  -- now() is the database clock. Time left on a paid subscription is kept.
  _new_end := GREATEST(now(), COALESCE(_sub.subscription_ends_at, now()))
              + make_interval(days => _code_row.days);

  UPDATE public.subscriptions
  SET status               = 'active',
      subscription_ends_at = _new_end,
      plan                 = COALESCE(_plan.name, plan),
      plan_id              = COALESCE(_plan.id, plan_id),
      max_branches         = COALESCE(_plan.branch_limit, max_branches),
      max_users            = COALESCE(_plan.user_limit, max_users),
      -- a fingerprint for support, never the code itself
      activation_code      = left(_hash, 12),
      updated_at           = now()
  WHERE id = _sub.id;

  UPDATE public.activation_codes
  SET used_count = used_count + 1
  WHERE id = _code_row.id;

  INSERT INTO public.activation_code_redemptions (code_id, merchant_id, redeemed_by, days_granted)
  VALUES (_code_row.id, _merchant_id, auth.uid(), _code_row.days);

  INSERT INTO public.subscription_events
    (merchant_id, subscription_id, event_type, from_status, to_status, from_plan, to_plan, actor_user_id, metadata)
  VALUES
    (_merchant_id, _sub.id, 'code_redeemed', _sub.status::text, 'active', _sub.plan,
     COALESCE(_plan.name, _sub.plan), auth.uid(),
     jsonb_build_object('days', _code_row.days, 'code_id', _code_row.id, 'ends_at', _new_end));

  RETURN jsonb_build_object(
    'status', 'active',
    'days', _code_row.days,
    'subscription_ends_at', _new_end,
    'plan', COALESCE(_plan.name_ar, _sub.plan)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_activation_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6 · Asking for a plan change records a request. It does not grant anything.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_plan_change(_plan_id uuid, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant_id uuid;
  _sub         public.subscriptions%ROWTYPE;
  _plan        public.plans%ROWTYPE;
BEGIN
  _merchant_id := public.get_user_merchant_id();
  IF _merchant_id IS NULL THEN
    RAISE EXCEPTION 'not_a_merchant_user' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_merchant_role('owner') THEN
    RAISE EXCEPTION 'owner_role_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE id = _plan_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _sub FROM public.subscriptions WHERE merchant_id = _merchant_id;

  INSERT INTO public.subscription_events
    (merchant_id, subscription_id, event_type, from_plan, to_plan, actor_user_id, notes, metadata)
  VALUES
    (_merchant_id, _sub.id, 'plan_change_requested', _sub.plan, _plan.name, auth.uid(),
     left(COALESCE(_note, ''), 500), jsonb_build_object('plan_id', _plan.id));

  -- Deliberately no UPDATE: a plan is applied by a platform admin after payment.
  RETURN jsonb_build_object('requested', true, 'plan', _plan.name_ar);
END;
$$;

REVOKE ALL ON FUNCTION public.request_plan_change(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_plan_change(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7 · The subscription state, decided by the server clock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_subscription_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant_id uuid;
  _sub         public.subscriptions%ROWTYPE;
  _ends_at     timestamptz;
  _expired     boolean;
BEGIN
  _merchant_id := public.get_user_merchant_id();
  IF _merchant_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'server_time', now());
  END IF;

  SELECT * INTO _sub FROM public.subscriptions WHERE merchant_id = _merchant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'server_time', now());
  END IF;

  _ends_at := CASE WHEN _sub.status = 'trial' THEN _sub.trial_ends_at
                   ELSE _sub.subscription_ends_at END;

  _expired := _sub.status = 'expired'
              OR (_sub.status IN ('trial', 'active') AND _ends_at IS NOT NULL AND _ends_at <= now());

  RETURN jsonb_build_object(
    'found', true,
    'status', _sub.status,
    'effective_status', CASE WHEN _sub.status = 'cancelled' THEN 'cancelled'
                             WHEN _expired THEN 'expired'
                             ELSE _sub.status::text END,
    'plan', _sub.plan,
    'plan_id', _sub.plan_id,
    'ends_at', _ends_at,
    'days_remaining', CASE WHEN _ends_at IS NULL THEN NULL
                           ELSE GREATEST(0, ceil(EXTRACT(epoch FROM (_ends_at - now())) / 86400)::int) END,
    'is_locked', _expired OR _sub.status = 'cancelled',
    'server_time', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_subscription_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_subscription_state() TO authenticated;

-- ---------------------------------------------------------------------------
-- 8 · Merchants may read their subscription. They may no longer write it.
-- ---------------------------------------------------------------------------
-- Was: FOR ALL USING (merchant_id = get_user_merchant_id() AND has_merchant_role('owner'))
-- which let an owner PATCH status, plan and dates from the browser.
DROP POLICY IF EXISTS "Owners can manage subscriptions" ON public.subscriptions;

-- "Users can view their subscription" (SELECT) and the two platform-admin
-- policies are unchanged, so the admin console keeps working. With no write
-- policy left for merchants, every merchant-side write is now refused by RLS
-- and has to go through the SECURITY DEFINER functions above.

-- ---------------------------------------------------------------------------
-- 9 · demo_switch_plan: platform admins only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demo_switch_plan(_plan_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant_id uuid;
  _plan plans%ROWTYPE;
BEGIN
  -- The demo switcher used to be open to every authenticated user, which made
  -- the whole plan system advisory.
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;

  _merchant_id := get_user_merchant_id();
  IF _merchant_id IS NULL THEN
    RAISE EXCEPTION 'No merchant for current user';
  END IF;

  SELECT * INTO _plan FROM public.plans WHERE name = _plan_name AND is_active = true LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found: %', _plan_name;
  END IF;

  UPDATE public.subscriptions
  SET plan = _plan.name,
      plan_id = _plan.id,
      max_branches = _plan.branch_limit,
      max_users = _plan.user_limit,
      updated_at = now()
  WHERE merchant_id = _merchant_id;

  INSERT INTO public.subscription_events
    (merchant_id, event_type, to_plan, actor_user_id, notes)
  VALUES (_merchant_id, 'plan_applied', _plan.name, auth.uid(), 'demo_switch_plan');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.demo_switch_plan(text) FROM PUBLIC, anon;
-- still granted to authenticated, but the body now refuses anyone who is not a
-- platform admin, so a leaked grant is not enough
GRANT EXECUTE ON FUNCTION public.demo_switch_plan(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10 · Issuing a code (platform admins)
--
-- The hash is computed inside the database so nobody has to handle it by hand
-- and the plaintext never has to be stored anywhere. Keep the code you pass in:
-- it cannot be recovered afterwards.
--
--   SELECT public.create_activation_code('WASEL-9F3K-22B', 365, NULL, 1, NULL);
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_activation_code(
  _code       text,
  _days       integer,
  _plan_id    uuid        DEFAULT NULL,
  _max_uses   integer     DEFAULT 1,
  _expires_at timestamptz DEFAULT NULL,
  _label      text        DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform_admin_required' USING ERRCODE = '42501';
  END IF;
  IF _code IS NULL OR length(btrim(_code)) < 8 THEN
    RAISE EXCEPTION 'code_too_short' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.activation_codes (code_hash, days, plan_id, max_uses, expires_at, label, created_by)
  VALUES (public.hash_activation_code(_code), _days, _plan_id, COALESCE(_max_uses, 1), _expires_at, _label, auth.uid())
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_activation_code(text, integer, uuid, integer, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_activation_code(text, integer, uuid, integer, timestamptz, text) TO authenticated;
