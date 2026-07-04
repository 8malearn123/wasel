
-- =============================================
-- PLATFORM ADMINS TABLE (must be created first)
-- =============================================
CREATE TABLE public.platform_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view"
ON public.platform_admins FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Security definer function
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_admins
        WHERE user_id = auth.uid() AND is_active = true
    )
$$;

-- =============================================
-- PLANS TABLE
-- =============================================
CREATE TABLE public.plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    name_ar text NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    branch_limit integer NOT NULL DEFAULT 1,
    user_limit integer NOT NULL DEFAULT 3,
    has_online_store boolean NOT NULL DEFAULT false,
    advanced_reports boolean NOT NULL DEFAULT false,
    priority_support boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON public.plans FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Platform admins can manage plans"
ON public.plans FOR ALL
TO authenticated
USING (is_platform_admin());

-- =============================================
-- UPDATE SUBSCRIPTIONS TABLE
-- =============================================
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
    ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS admin_notes text;

-- =============================================
-- BRANCH REQUESTS TABLE
-- =============================================
CREATE TYPE public.branch_request_status AS ENUM (
    'pending_review',
    'pending_payment',
    'activated',
    'rejected'
);

CREATE TABLE public.branch_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES public.merchants(id),
    requested_by uuid NOT NULL,
    branch_name text NOT NULL,
    city text,
    notes text,
    status public.branch_request_status NOT NULL DEFAULT 'pending_review',
    admin_notes text,
    invoice_amount numeric,
    payment_confirmed boolean NOT NULL DEFAULT false,
    branch_id uuid REFERENCES public.branches(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own branch requests"
ON public.branch_requests FOR SELECT
TO authenticated
USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Owners can create branch requests"
ON public.branch_requests FOR INSERT
TO authenticated
WITH CHECK (merchant_id = get_user_merchant_id() AND has_merchant_role('owner'::user_role));

CREATE POLICY "Platform admins manage branch requests"
ON public.branch_requests FOR ALL
TO authenticated
USING (is_platform_admin());

-- =============================================
-- PLATFORM ADMIN POLICIES FOR OTHER TABLES
-- =============================================
CREATE POLICY "Platform admins can view all merchants"
ON public.merchants FOR SELECT
TO authenticated
USING (is_platform_admin());

CREATE POLICY "Platform admins can update merchants"
ON public.merchants FOR UPDATE
TO authenticated
USING (is_platform_admin());

CREATE POLICY "Platform admins can view all subscriptions"
ON public.subscriptions FOR SELECT
TO authenticated
USING (is_platform_admin());

CREATE POLICY "Platform admins manage subscriptions"
ON public.subscriptions FOR ALL
TO authenticated
USING (is_platform_admin());

CREATE POLICY "Platform admins can view all branches"
ON public.branches FOR SELECT
TO authenticated
USING (is_platform_admin());

CREATE POLICY "Platform admins manage branches"
ON public.branches FOR ALL
TO authenticated
USING (is_platform_admin());

CREATE POLICY "Platform admins can view all merchant_users"
ON public.merchant_users FOR SELECT
TO authenticated
USING (is_platform_admin());

-- =============================================
-- SEED DEFAULT PLANS
-- =============================================
INSERT INTO public.plans (name, name_ar, price, branch_limit, user_limit, has_online_store, advanced_reports, priority_support, sort_order) VALUES
('Basic', 'باقة أ', 99, 1, 3, false, false, false, 1),
('Professional', 'باقة ب', 199, 3, 10, true, true, false, 2),
('Enterprise', 'باقة ج', 399, 10, 50, true, true, true, 3);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_branch_requests_updated_at
BEFORE UPDATE ON public.branch_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
