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
      max_users = _plan.user_limit
  WHERE merchant_id = _merchant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.demo_switch_plan(text) TO authenticated;