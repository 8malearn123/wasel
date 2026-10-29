-- The plan's limits hold when the plan changes, and wholesale follows the plan.
--
-- Live (regression of 2026-10-29): the Lite demo has 2 active branches on a
-- 1-branch plan, and opens the wholesale section although its plan has
-- has_wholesale = false.
--
-- 1 · Branches. 20261027090100 refuses a new branch, or one switched back on,
--     past the limit. A shop could still get past it the other way round: by
--     moving to a smaller plan (an activation code, a plan change, the demo
--     switch) while it had more active branches than the new plan allows.
--     A change of plan or limit that would leave more active branches than
--     the new limit is now refused, with the numbers, so the shop first
--     switches a branch off itself. Nothing is switched off for them, and
--     server jobs without a signed-in user are not affected.
--
-- 2 · Wholesale. The app opens wholesale (market, buying, supplying) only on
--     a plan with has_wholesale (src/lib/planFeatures.ts); the database let
--     any live subscription place orders (can_buy_wholesale). Buying now
--     needs the same flag. Orders already placed are not touched, and a
--     buyer can still read and cancel their pending orders.
--     DECISION TO CONFIRM: if a plan without has_wholesale should be able to
--     buy, set has_wholesale on it or keep the old can_buy_wholesale.
--
-- Existing rows are not read into changes: no branch, subscription or order
-- is modified by this migration.

CREATE OR REPLACE FUNCTION public.effective_branch_limit(_max_branches integer, _plan_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN l = 0 THEN 1 ELSE l END
    FROM (SELECT GREATEST(COALESCE(_max_branches, 0),
                          COALESCE((SELECT p.branch_limit FROM public.plans p WHERE p.id = _plan_id), 0)) AS l) x
$$;
REVOKE ALL ON FUNCTION public.effective_branch_limit(integer, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_plan_branch_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_limit integer;
  _old_limit integer;
  _active    integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  _new_limit := public.effective_branch_limit(NEW.max_branches, NEW.plan_id);
  _old_limit := public.effective_branch_limit(OLD.max_branches, OLD.plan_id);
  IF _new_limit >= 9999 OR _new_limit >= _old_limit THEN
    RETURN NEW;  -- the limit did not shrink
  END IF;

  SELECT count(*) INTO _active
    FROM public.branches b
   WHERE b.merchant_id = NEW.merchant_id AND COALESCE(b.is_active, true);

  IF _active > _new_limit THEN
    RAISE EXCEPTION 'لا يمكن الانتقال لهذه الباقة: لديك % فروع نشطة وحدّها %. أوقف الفروع الزائدة أولًا.',
      _active, _new_limit
      USING ERRCODE = 'P0001', HINT = 'branch_limit_reached';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_plan_branch_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS subscriptions_guard_branch_limit ON public.subscriptions;
CREATE TRIGGER subscriptions_guard_branch_limit
  BEFORE UPDATE OF plan_id, max_branches ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_plan_branch_limit();

-- Shops over their limit today, for the owner of the platform to look at;
-- nothing acts on it. Platform admins only.
CREATE OR REPLACE FUNCTION public.shops_over_branch_limit()
RETURNS TABLE (merchant_id uuid, merchant_name text, plan text, branch_limit integer, active_branches bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.merchant_id, m.name, s.plan, public.effective_branch_limit(s.max_branches, s.plan_id),
         (SELECT count(*) FROM public.branches b WHERE b.merchant_id = s.merchant_id AND COALESCE(b.is_active, true))
    FROM public.subscriptions s
    JOIN public.merchants m ON m.id = s.merchant_id
   WHERE public.is_platform_admin()
     AND public.effective_branch_limit(s.max_branches, s.plan_id) < 9999
     AND (SELECT count(*) FROM public.branches b WHERE b.merchant_id = s.merchant_id AND COALESCE(b.is_active, true))
         > public.effective_branch_limit(s.max_branches, s.plan_id)
$$;
REVOKE ALL ON FUNCTION public.shops_over_branch_limit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shops_over_branch_limit() TO authenticated;

-- ---------------------------------------------------------------------------
-- Wholesale buying follows the plan flag, like supplying
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_buy_wholesale()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.merchant_id = public.get_user_merchant_id()
      AND s.status IN ('trial', 'active')
      AND p.has_wholesale = true
  )
$$;
