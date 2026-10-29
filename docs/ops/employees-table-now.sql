-- =============================================================================
-- Employees table — standalone, for the database as it is today.
--
-- The «إضافة موظف» screen writes to public.employees, which only exists
-- once 20261004100300_employees.sql runs; that file needs the RBAC
-- migration before it (has_permission). This file creates the same table,
-- indexes and checks, with access decided by the shop roles that exist
-- today, so the screen works now:
--   read:              owner, admin, branch manager (and each person their own record)
--   add/edit/delete:   owner, admin
-- When the full migrations run later, 20261004100300 keeps this table
-- (CREATE TABLE IF NOT EXISTS) and replaces these policies by name with its
-- permission-based ones. Nothing else is created or changed; no data is read.
--
-- Run once in Supabase → SQL Editor. Safe to run again.
-- =============================================================================
BEGIN;

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

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.employees_role_is(_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_users mu
     WHERE mu.user_id = auth.uid()
       AND mu.is_active = true
       AND mu.merchant_id = public.get_user_merchant_id()
       AND mu.role::text = ANY (_roles)
  )
$$;
REVOKE ALL ON FUNCTION public.employees_role_is(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employees_role_is(text[]) TO authenticated;

DROP POLICY IF EXISTS "Read employees with permission" ON public.employees;
CREATE POLICY "Read employees with permission"
  ON public.employees FOR SELECT TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND public.employees_role_is(ARRAY['owner', 'admin', 'branch_manager']));

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
              AND public.employees_role_is(ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Update employees with permission" ON public.employees;
CREATE POLICY "Update employees with permission"
  ON public.employees FOR UPDATE TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND public.employees_role_is(ARRAY['owner', 'admin']))
  WITH CHECK (merchant_id = public.get_user_merchant_id()
         AND public.employees_role_is(ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Delete employees with permission" ON public.employees;
CREATE POLICY "Delete employees with permission"
  ON public.employees FOR DELETE TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND public.employees_role_is(ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Platform admins read employees" ON public.employees;
CREATE POLICY "Platform admins read employees"
  ON public.employees FOR SELECT TO authenticated
  USING (public.is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;

-- PostgREST reads the new table without waiting for its schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Check (expect: employees | t):
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employees';
