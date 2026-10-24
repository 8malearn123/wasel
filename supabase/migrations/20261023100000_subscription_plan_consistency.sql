-- One plan per subscription.
--
-- A subscription carries its plan three times: plan_id (the plans row), plan
-- (that row's name as text) and max_branches / max_users (its limits). The
-- server functions write them together, but older rows drifted: a shop on Pro
-- by plan_id still read 'Basic' in `plan` with Basic's single branch, so the
-- app showed «باقة لايت» and «2/1» while granting Pro's reports.
--
-- plan_id is what plans are applied by, so it is the reference here. Nothing is
-- deleted, and no limit is lowered: a limit below the plan's is raised to it, a
-- larger allowance granted on the subscription is kept. Trials keep 'trial'.
-- Safe to run more than once.

-- 1. Rows that name a plan but have no plan_id get the matching row
UPDATE public.subscriptions s
SET plan_id = p.id, updated_at = now()
FROM public.plans p
WHERE s.plan_id IS NULL
  AND s.plan <> 'trial'
  AND p.name = s.plan;

-- 2. The name and the limits follow plan_id
UPDATE public.subscriptions s
SET plan         = p.name,
    max_branches = GREATEST(COALESCE(s.max_branches, 0), p.branch_limit),
    max_users    = GREATEST(COALESCE(s.max_users, 0), p.user_limit),
    updated_at   = now()
FROM public.plans p
WHERE p.id = s.plan_id
  AND s.plan <> 'trial'
  AND (s.plan IS DISTINCT FROM p.name
       OR COALESCE(s.max_branches, 0) < p.branch_limit
       OR COALESCE(s.max_users, 0) < p.user_limit);

-- 3. And keep following it. When plan_id changes and the same statement does
--    not set the limits itself, the limits become the new plan's (a downgrade
--    lowers them); otherwise they are never left below the plan's.
CREATE OR REPLACE FUNCTION public.sync_subscription_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _p public.plans%ROWTYPE;
  _plan_changed boolean;
BEGIN
  IF NEW.plan_id IS NULL OR NEW.plan = 'trial' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _p FROM public.plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _plan_changed := TG_OP = 'INSERT' OR OLD.plan_id IS DISTINCT FROM NEW.plan_id;
  NEW.plan := _p.name;

  IF _plan_changed AND TG_OP = 'UPDATE'
     AND NEW.max_branches IS NOT DISTINCT FROM OLD.max_branches
     AND NEW.max_users IS NOT DISTINCT FROM OLD.max_users THEN
    NEW.max_branches := _p.branch_limit;
    NEW.max_users    := _p.user_limit;
  ELSE
    NEW.max_branches := GREATEST(COALESCE(NEW.max_branches, 0), _p.branch_limit);
    NEW.max_users    := GREATEST(COALESCE(NEW.max_users, 0), _p.user_limit);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_sync_plan ON public.subscriptions;
CREATE TRIGGER subscriptions_sync_plan
  BEFORE INSERT OR UPDATE OF plan_id, plan, max_branches, max_users
  ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_subscription_plan();
