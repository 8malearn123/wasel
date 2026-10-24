-- demo_switch_plan() is for the demo accounts only.
--
-- As created in 20260507070812 it is SECURITY DEFINER and granted to every
-- signed-in user: any shop owner could call it from the browser console and
-- put their shop on the Max plan with Max's limits, for free. The demo
-- accounts' plans had been switched that way too (the Lite demo was on Max,
-- the Pro demo on Basic).
--
-- Same behaviour for the demo accounts (emails @wasil.demo); everyone else
-- gets an error. Plans for real shops change through activation codes and
-- the platform admin, not this function.

CREATE OR REPLACE FUNCTION public.demo_switch_plan(_plan_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant_id uuid;
  _plan plans%ROWTYPE;
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF _email NOT LIKE '%@wasil.demo' THEN
    RAISE EXCEPTION 'demo_switch_plan is only available to demo accounts'
      USING ERRCODE = '42501';
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
END;
$$;

REVOKE ALL ON FUNCTION public.demo_switch_plan(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_switch_plan(text) TO authenticated;
