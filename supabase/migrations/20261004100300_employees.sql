-- =============================================================================
-- Phase 1 · Employees
--
-- The audit's second finding: there is no employees table. HRPage keeps staff
-- records in localStorage, so they live in one browser, vanish on a new device
-- and nobody else can see them.
--
-- This is the record of a person who works at the shop. It is NOT the HR
-- module: no attendance, no shifts, no payroll, no salary history — those are
-- Phase 3. An employee may be linked to a login account, and need not be.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  branch_id       uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  -- the login account, when this person has one. Null is normal: a warehouse
  -- hand who never signs in is still an employee.
  merchant_user_id uuid REFERENCES public.merchant_users(id) ON DELETE SET NULL,
  employee_number text,
  full_name       text NOT NULL,
  email           text,
  phone           text,
  job_title       text,
  department      text,
  hire_date       date,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  notes           text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT employees_full_name_not_blank CHECK (btrim(full_name) <> '')
);

-- Numbers are per shop and optional; two shops may both have an employee "1".
CREATE UNIQUE INDEX IF NOT EXISTS employees_number_per_merchant
  ON public.employees (merchant_id, employee_number)
  WHERE employee_number IS NOT NULL;

-- One employee record per login account.
CREATE UNIQUE INDEX IF NOT EXISTS employees_one_per_account
  ON public.employees (merchant_user_id)
  WHERE merchant_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employees_merchant_idx ON public.employees (merchant_id, status);

DROP TRIGGER IF EXISTS employees_updated_at ON public.employees;
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- The linked account must belong to the same shop, or an employee row becomes
-- a window into another tenant's user list.
CREATE OR REPLACE FUNCTION public.check_employee_account_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.merchant_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.merchant_users mu
    WHERE mu.id = NEW.merchant_user_id AND mu.merchant_id = NEW.merchant_id
  ) THEN
    RAISE EXCEPTION 'account_belongs_to_another_merchant' USING ERRCODE = '42501';
  END IF;

  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id AND b.merchant_id = NEW.merchant_id
  ) THEN
    RAISE EXCEPTION 'branch_belongs_to_another_merchant' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_tenant_check ON public.employees;
CREATE TRIGGER employees_tenant_check
  BEFORE INSERT OR UPDATE OF merchant_user_id, branch_id, merchant_id ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.check_employee_account_tenant();

-- ---------------------------------------------------------------------------
-- RLS — staff records are not readable by whoever happens to be signed in
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read employees with permission" ON public.employees;
CREATE POLICY "Read employees with permission"
  ON public.employees FOR SELECT TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND public.has_permission('employees.view'));

-- Everyone may read their own record even without employees.view — a cashier
-- should be able to see their own job title.
DROP POLICY IF EXISTS "Read my own employee record" ON public.employees;
CREATE POLICY "Read my own employee record"
  ON public.employees FOR SELECT TO authenticated
  USING (merchant_user_id IN (
    SELECT id FROM public.merchant_users WHERE user_id = auth.uid() AND is_active = true
  ));

DROP POLICY IF EXISTS "Create employees with permission" ON public.employees;
CREATE POLICY "Create employees with permission"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (merchant_id = public.get_user_merchant_id()
              AND public.has_permission('employees.create'));

DROP POLICY IF EXISTS "Update employees with permission" ON public.employees;
CREATE POLICY "Update employees with permission"
  ON public.employees FOR UPDATE TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND public.has_permission('employees.update'))
  WITH CHECK (merchant_id = public.get_user_merchant_id()
         AND public.has_permission('employees.update'));

-- Archiving is an UPDATE of status; a hard delete needs its own permission.
DROP POLICY IF EXISTS "Delete employees with permission" ON public.employees;
CREATE POLICY "Delete employees with permission"
  ON public.employees FOR DELETE TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND public.has_permission('employees.delete'));

DROP POLICY IF EXISTS "Platform admins read employees" ON public.employees;
CREATE POLICY "Platform admins read employees"
  ON public.employees FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- The unified product read, for the screens and for later phases
-- ---------------------------------------------------------------------------
-- Defined here because it is the last migration of the four and can see every
-- column the others added. security_invoker keeps each caller's RLS, so this
-- view grants nothing — it only saves three queries and a merge.
DROP VIEW IF EXISTS public.products_v;
CREATE VIEW public.products_v AS
  SELECT d.id, d.merchant_id, d.branch_id, 'device'::text AS item_type,
         btrim(coalesce(d.brand, '') || ' ' || d.model) AS name,
         d.imei AS sku, d.slug, d.description, d.category_id,
         d.price, d.compare_at_price, d.cost,
         CASE WHEN d.status = 'available' THEN 1 ELSE 0 END AS stock_quantity,
         d.status::text AS status,
         (d.status = 'available') AS is_active,
         d.created_at, d.updated_at
    FROM public.devices d
  UNION ALL
  SELECT a.id, a.merchant_id, a.branch_id, 'accessory',
         a.name, a.sku, a.slug, a.description, a.category_id,
         a.price, a.compare_at_price, a.cost,
         a.quantity, a.status, (a.status = 'active' AND a.quantity > 0),
         a.created_at, a.updated_at
    FROM public.accessories a
  UNION ALL
  SELECT rp.id, rp.merchant_id, rp.branch_id, 'repair_part',
         rp.name, rp.sku, rp.slug, rp.description, rp.category_id,
         rp.price, NULL::numeric, rp.cost,
         rp.quantity, rp.status, (rp.status = 'active' AND rp.quantity > 0),
         rp.created_at, rp.updated_at
    FROM public.repair_parts rp;

ALTER VIEW public.products_v SET (security_invoker = on);
GRANT SELECT ON public.products_v TO authenticated;
