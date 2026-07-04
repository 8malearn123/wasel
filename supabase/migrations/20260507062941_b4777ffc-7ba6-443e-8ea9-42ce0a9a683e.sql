
CREATE OR REPLACE FUNCTION public.has_merchant_role(_role user_role, _merchant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_users
    WHERE user_id = auth.uid()
      AND merchant_id = _merchant_id
      AND role = _role
      AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_admin(_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_users
    WHERE user_id = auth.uid()
      AND merchant_id = _merchant_id
      AND role IN ('owner', 'admin')
      AND is_active = true
  )
$$;
