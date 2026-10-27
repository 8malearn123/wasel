-- The plan's branch limit, enforced by the database.
--
-- Only the screen checked it (usePlanEnforcement): branches.insert and
-- is_active = true went through for any owner, from the console or the API,
-- whatever the plan. The Lite demo has two active branches on a one-branch
-- plan (2/1).
--
-- Adding a branch, or switching one back on, is refused when the shop's
-- active branches already reach its limit: the larger of the subscription's
-- max_branches and its plan's branch_limit, as the app reads it (9999 =
-- unlimited). Platform admins are not limited, so a branch they approve as an
-- extra still goes in.
--
-- Existing branches are not touched: nothing is switched off or deleted, and
-- editing a branch that is already active is allowed.

CREATE OR REPLACE FUNCTION public.enforce_branch_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit integer;
  _active integer;
BEGIN
  IF NOT COALESCE(NEW.is_active, true) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_active, true) THEN
    RETURN NEW;  -- already active: an edit, not a new branch
  END IF;
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  SELECT GREATEST(COALESCE(s.max_branches, 0), COALESCE(p.branch_limit, 0))
    INTO _limit
    FROM public.subscriptions s
    LEFT JOIN public.plans p ON p.id = s.plan_id
   WHERE s.merchant_id = NEW.merchant_id
   LIMIT 1;

  IF _limit IS NULL OR _limit = 0 THEN
    _limit := 1;  -- no subscription row: the app's own fallback
  END IF;
  IF _limit >= 9999 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _active
    FROM public.branches
   WHERE merchant_id = NEW.merchant_id
     AND COALESCE(is_active, true)
     AND id <> NEW.id;

  IF _active >= _limit THEN
    RAISE EXCEPTION 'تم بلوغ حد الفروع في باقتك (%)', _limit
      USING ERRCODE = 'P0001', HINT = 'branch_limit_reached';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_branch_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS branches_enforce_limit ON public.branches;
CREATE TRIGGER branches_enforce_limit
  BEFORE INSERT OR UPDATE OF is_active ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_limit();
