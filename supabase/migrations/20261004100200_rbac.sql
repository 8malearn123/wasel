-- =============================================================================
-- Phase 1 · RBAC
--
-- Today authorisation is a single enum column, merchant_users.role, read by
-- `if (role === 'cashier')` in the UI and by has_merchant_role() in a handful of
-- policies. Adding a role means an ALTER TYPE; granting one screen to one
-- person is impossible.
--
-- This adds roles, permissions and the two join tables, plus has_permission(),
-- the one function every policy and every screen asks.
--
-- COMPATIBILITY: has_permission() answers yes if EITHER the new tables grant the
-- permission OR the legacy enum role implies it. Nothing that works today stops
-- working, including for a user who has not been assigned a role row yet.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1 · The catalogue of permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
  key         text PRIMARY KEY,
  module      text NOT NULL,
  name_ar     text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- The catalogue is not secret; the grants are.
DROP POLICY IF EXISTS "Anyone signed in can read the permission catalogue" ON public.permissions;
CREATE POLICY "Anyone signed in can read the permission catalogue"
  ON public.permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Platform admins manage permissions" ON public.permissions;
CREATE POLICY "Platform admins manage permissions"
  ON public.permissions FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Only what Phase 1 actually enforces. More are added by the phase that needs
-- them; an unused permission is a lie about what the system checks.
INSERT INTO public.permissions (key, module, name_ar, description) VALUES
  ('products.view',          'products',  'عرض المنتجات',        'قراءة الأجهزة والإكسسوارات وقطع الغيار'),
  ('products.create',        'products',  'إضافة منتج',          null),
  ('products.update',        'products',  'تعديل منتج',          null),
  ('products.delete',        'products',  'حذف منتج',            null),
  ('products.media.upload',  'products',  'رفع صور المنتجات',    null),
  ('products.media.delete',  'products',  'حذف صور المنتجات',    null),
  ('categories.manage',      'products',  'إدارة التصنيفات',     null),
  ('employees.view',         'employees', 'عرض الموظفين',        null),
  ('employees.create',       'employees', 'إضافة موظف',          null),
  ('employees.update',       'employees', 'تعديل موظف',          null),
  ('employees.delete',       'employees', 'أرشفة موظف',          null),
  ('users.view',             'users',     'عرض المستخدمين',      null),
  ('users.create',           'users',     'إنشاء مستخدم',        null),
  ('users.update',           'users',     'تعديل مستخدم',        null),
  ('users.delete',           'users',     'تعطيل مستخدم',        null),
  ('roles.view',             'roles',     'عرض الأدوار',         null),
  ('roles.manage',           'roles',     'إدارة الأدوار والصلاحيات', null)
ON CONFLICT (key) DO UPDATE SET module = EXCLUDED.module, name_ar = EXCLUDED.name_ar;

-- ---------------------------------------------------------------------------
-- 2 · Roles — system roles are shared, a merchant may add their own
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = a system role every merchant uses; set = a role this merchant made
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  key         text NOT NULL,
  name_ar     text NOT NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT false,
  -- the merchant_users.role value this role stands in for, so the legacy enum
  -- and the new table agree while both exist
  legacy_role public.user_role,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_system_key   ON public.roles (key) WHERE merchant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS roles_merchant_key ON public.roles (merchant_id, key) WHERE merchant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id        uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

-- A role is given to a merchant_users row, not to an auth user: the same person
-- could hold accounts at two shops, and the grant belongs to the membership.
CREATE TABLE IF NOT EXISTS public.user_roles (
  merchant_user_id uuid NOT NULL REFERENCES public.merchant_users(id) ON DELETE CASCADE,
  role_id          uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_by       uuid,
  granted_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_user_id, role_id)
);

ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3 · has_permission() — the one question every policy asks
-- ---------------------------------------------------------------------------
-- What each legacy enum role may do, until roles are assigned explicitly. This
-- mirrors what the app allows today; it does not widen anything.
CREATE OR REPLACE FUNCTION public.legacy_role_permissions(_role public.user_role)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN ARRAY[
      'products.view','products.create','products.update','products.delete',
      'products.media.upload','products.media.delete','categories.manage',
      'employees.view','employees.create','employees.update','employees.delete',
      'users.view','users.create','users.update','users.delete',
      'roles.view','roles.manage']
    WHEN 'admin' THEN ARRAY[
      'products.view','products.create','products.update','products.delete',
      'products.media.upload','products.media.delete','categories.manage',
      'employees.view','employees.create','employees.update','employees.delete',
      'users.view','users.create','users.update','users.delete',
      'roles.view']
    WHEN 'inventory_manager' THEN ARRAY[
      'products.view','products.create','products.update','products.delete',
      'products.media.upload','products.media.delete','categories.manage']
    WHEN 'branch_manager' THEN ARRAY[
      'products.view','products.create','products.update',
      'products.media.upload','products.media.delete','employees.view']
    -- a cashier sells; they do not edit the catalogue
    WHEN 'cashier' THEN ARRAY['products.view']
    ELSE ARRAY[]::text[]
  END
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.merchant_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.is_active = true
      AND (
        -- granted by a role
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.role_permissions rp ON rp.role_id = ur.role_id
          WHERE ur.merchant_user_id = mu.id
            AND rp.permission_key = _permission
        )
        -- or implied by the enum role this account already has
        OR _permission = ANY (public.legacy_role_permissions(mu.role))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- Everything the current user may do, for the UI to read in one call rather
-- than one round trip per button.
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT k), ARRAY[]::text[])
  FROM public.merchant_users mu
  CROSS JOIN LATERAL (
    SELECT rp.permission_key AS k
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
     WHERE ur.merchant_user_id = mu.id
    UNION
    SELECT unnest(public.legacy_role_permissions(mu.role))
  ) perms
  WHERE mu.user_id = auth.uid() AND mu.is_active = true
$$;

REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4 · RLS on the RBAC tables themselves
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Read system roles and own roles" ON public.roles;
CREATE POLICY "Read system roles and own roles"
  ON public.roles FOR SELECT TO authenticated
  USING (merchant_id IS NULL OR merchant_id = public.get_user_merchant_id());

-- A merchant may define their own roles; nobody may edit a system role.
DROP POLICY IF EXISTS "Manage own roles" ON public.roles;
CREATE POLICY "Manage own roles"
  ON public.roles FOR ALL TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND is_system = false
         AND public.has_permission('roles.manage'))
  WITH CHECK (merchant_id = public.get_user_merchant_id()
         AND is_system = false
         AND public.has_permission('roles.manage'));

DROP POLICY IF EXISTS "Platform admins manage roles" ON public.roles;
CREATE POLICY "Platform admins manage roles"
  ON public.roles FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Read role permissions" ON public.role_permissions;
CREATE POLICY "Read role permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_permissions.role_id
                   AND (r.merchant_id IS NULL OR r.merchant_id = public.get_user_merchant_id())));

DROP POLICY IF EXISTS "Manage own role permissions" ON public.role_permissions;
CREATE POLICY "Manage own role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_permission('roles.manage') AND EXISTS (
          SELECT 1 FROM public.roles r WHERE r.id = role_permissions.role_id
            AND r.merchant_id = public.get_user_merchant_id() AND r.is_system = false))
  WITH CHECK (public.has_permission('roles.manage') AND EXISTS (
          SELECT 1 FROM public.roles r WHERE r.id = role_permissions.role_id
            AND r.merchant_id = public.get_user_merchant_id() AND r.is_system = false));

DROP POLICY IF EXISTS "Platform admins manage role permissions" ON public.role_permissions;
CREATE POLICY "Platform admins manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Everyone may see which roles their colleagues hold; only roles.manage may
-- change them, and only inside their own merchant — this is the escalation path
-- that matters, so the WITH CHECK pins both sides.
DROP POLICY IF EXISTS "Read user roles in my merchant" ON public.user_roles;
CREATE POLICY "Read user roles in my merchant"
  ON public.user_roles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchant_users mu
                  WHERE mu.id = user_roles.merchant_user_id
                    AND mu.merchant_id = public.get_user_merchant_id()));

DROP POLICY IF EXISTS "Assign roles in my merchant" ON public.user_roles;
CREATE POLICY "Assign roles in my merchant"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_permission('roles.manage') AND EXISTS (
          SELECT 1 FROM public.merchant_users mu
           WHERE mu.id = user_roles.merchant_user_id
             AND mu.merchant_id = public.get_user_merchant_id()))
  WITH CHECK (public.has_permission('roles.manage')
          AND EXISTS (SELECT 1 FROM public.merchant_users mu
                       WHERE mu.id = user_roles.merchant_user_id
                         AND mu.merchant_id = public.get_user_merchant_id())
          -- and the role itself must be one this merchant may use
          AND EXISTS (SELECT 1 FROM public.roles r
                       WHERE r.id = user_roles.role_id
                         AND (r.merchant_id IS NULL OR r.merchant_id = public.get_user_merchant_id())));

DROP POLICY IF EXISTS "Platform admins manage user roles" ON public.user_roles;
CREATE POLICY "Platform admins manage user roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 5 · The system roles, matching the enum that exists
-- ---------------------------------------------------------------------------
INSERT INTO public.roles (merchant_id, key, name_ar, description, is_system, legacy_role) VALUES
  (NULL, 'owner',             'صاحب المتجر',    'صلاحيات كاملة',                     true, 'owner'),
  (NULL, 'admin',             'مدير',            'إدارة كاملة عدا إدارة الأدوار',      true, 'admin'),
  (NULL, 'branch_manager',    'مدير فرع',        'إدارة منتجات الفرع',                 true, 'branch_manager'),
  (NULL, 'inventory_manager', 'مسؤول المخزون',   'إدارة المنتجات والتصنيفات',          true, 'inventory_manager'),
  (NULL, 'cashier',           'كاشير',           'البيع وعرض المنتجات فقط',            true, 'cashier')
ON CONFLICT (key) WHERE merchant_id IS NULL DO UPDATE
  SET name_ar = EXCLUDED.name_ar, legacy_role = EXCLUDED.legacy_role, is_system = true;

-- Give each system role exactly the permissions its legacy enum implies, so the
-- two sources of truth cannot drift apart.
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
  FROM public.roles r
  CROSS JOIN LATERAL unnest(public.legacy_role_permissions(r.legacy_role)) AS p(key)
 WHERE r.merchant_id IS NULL AND r.legacy_role IS NOT NULL
ON CONFLICT DO NOTHING;

-- Everyone who already has an account gets the matching role row, so the new
-- tables describe reality from the first day rather than being empty.
INSERT INTO public.user_roles (merchant_user_id, role_id)
SELECT mu.id, r.id
  FROM public.merchant_users mu
  JOIN public.roles r ON r.merchant_id IS NULL AND r.legacy_role = mu.role
ON CONFLICT DO NOTHING;

-- A new account gets its role row the same way.
CREATE OR REPLACE FUNCTION public.sync_legacy_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    DELETE FROM public.user_roles ur
     USING public.roles r
     WHERE ur.merchant_user_id = NEW.id AND ur.role_id = r.id
       AND r.merchant_id IS NULL AND r.legacy_role = OLD.role;
  END IF;

  INSERT INTO public.user_roles (merchant_user_id, role_id)
  SELECT NEW.id, r.id FROM public.roles r
   WHERE r.merchant_id IS NULL AND r.legacy_role = NEW.role
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_users_sync_role ON public.merchant_users;
CREATE TRIGGER merchant_users_sync_role
  AFTER INSERT OR UPDATE OF role ON public.merchant_users
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_user_role();

-- ---------------------------------------------------------------------------
-- 6 · The write policies that were waiting for has_permission()
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permitted users write product media" ON public.product_media;
CREATE POLICY "Permitted users write product media"
  ON public.product_media FOR INSERT TO authenticated
  WITH CHECK (merchant_id = public.get_user_merchant_id()
              AND public.has_permission('products.media.upload'));

DROP POLICY IF EXISTS "Permitted users update product media" ON public.product_media;
CREATE POLICY "Permitted users update product media"
  ON public.product_media FOR UPDATE TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND public.has_permission('products.media.upload'))
  WITH CHECK (merchant_id = public.get_user_merchant_id()
         AND public.has_permission('products.media.upload'));

DROP POLICY IF EXISTS "Permitted users delete product media" ON public.product_media;
CREATE POLICY "Permitted users delete product media"
  ON public.product_media FOR DELETE TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND public.has_permission('products.media.delete'));

-- Storage: the first path segment is the merchant id.
DROP POLICY IF EXISTS "Permitted users upload product-media" ON storage.objects;
CREATE POLICY "Permitted users upload product-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-media'
              AND (storage.foldername(name))[1] = public.get_user_merchant_id()::text
              AND public.has_permission('products.media.upload'));

DROP POLICY IF EXISTS "Permitted users update product-media" ON storage.objects;
CREATE POLICY "Permitted users update product-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-media'
         AND (storage.foldername(name))[1] = public.get_user_merchant_id()::text
         AND public.has_permission('products.media.upload'));

DROP POLICY IF EXISTS "Permitted users delete product-media" ON storage.objects;
CREATE POLICY "Permitted users delete product-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-media'
         AND (storage.foldername(name))[1] = public.get_user_merchant_id()::text
         AND public.has_permission('products.media.delete'));

-- ---------------------------------------------------------------------------
-- 7 · Categories now need a permission to change
-- ---------------------------------------------------------------------------
-- The read policy is untouched; only writing is narrowed, from "anyone in the
-- merchant" to "anyone in the merchant with categories.manage" — which every
-- role that could already do it still has.
DROP POLICY IF EXISTS "Manage categories with permission" ON public.merchant_categories;
CREATE POLICY "Manage categories with permission"
  ON public.merchant_categories FOR ALL TO authenticated
  USING (merchant_id = public.get_user_merchant_id() AND public.has_permission('categories.manage'))
  WITH CHECK (merchant_id = public.get_user_merchant_id() AND public.has_permission('categories.manage'));
