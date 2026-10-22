-- =============================================================================
-- Custom roles · 2/2
--
-- The RBAC tables (20261004100200_rbac.sql) already let a merchant own roles;
-- nothing could create one, assign one, or make one mean anything, because
-- the catalogue only covered products, employees, users and roles while every
-- other screen and table was gated by the legacy enum alone.
--
-- This migration:
--   1 · adds a permission for each area of the app, and teaches the legacy
--       roles the ones they already have, so their behaviour does not move
--   2 · lists what a custom role may never hold (owner/admin territory)
--   3 · adds save/delete/assign functions — the only way roles change
--   4 · enforces custom roles in the database: RESTRICTIVE policies that bite
--       only members whose role is 'custom', so owner/admin/cashier and the
--       other system roles run on exactly the policies they ran on before
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1 · The catalogue — one permission per screen/area that exists
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (key, module, name_ar, description) VALUES
  ('dashboard.view',        'dashboard', 'عرض لوحة التحكم',            'الصفحة الرئيسية وملخصها المالي'),
  ('pos.access',            'sales',     'نقطة البيع',                 'إنشاء فواتير البيع وسجل مبيعات الكاشير'),
  ('invoices.view',         'finance',   'الاطلاع على الفواتير',        'تفاصيل المبيعات والفواتير في التقارير'),
  ('reports.view',          'finance',   'عرض التقارير المالية',        'المبيعات والأرباح والمخزون وبقية التقارير'),
  ('closings.manage',       'finance',   'الإغلاق اليومي وحركة الصندوق', 'تقارير الإغلاق اليومي والكاش'),
  ('suppliers.manage',      'finance',   'الموردون والمشتريات والمديونيات', 'أوامر الشراء ومديونيات الموردين'),
  ('repairs.manage',        'sales',     'إدارة الصيانة',               null),
  ('online_orders.manage',  'sales',     'إدارة طلبات المتجر',          null),
  ('store.manage',          'sales',     'إدارة المتجر الإلكتروني',     'إعدادات المتجر ومحركات البحث'),
  ('customers.manage',      'sales',     'العملاء والولاء',             null),
  ('marketing.manage',      'sales',     'التسويق والكوبونات',          null),
  ('wholesale.manage',      'sales',     'بيع الجملة',                  null),
  ('stocktake.manage',      'products',  'الجرد',                       null),
  ('transfers.manage',      'products',  'التحويلات بين الفروع',        null),
  ('shipping.manage',       'shipping',  'الشحن',                       null),
  ('ai_insights.view',      'insights',  'تحليلات الذكاء الاصطناعي',    null),
  ('attendance.manage',     'employees', 'الحضور وأجهزة البصمة',        null),
  ('payroll.manage',        'employees', 'الرواتب',                     null),
  ('branches.manage',       'settings',  'إدارة الفروع',                null),
  ('settings.manage',       'settings',  'الإعدادات العامة والإشعارات', null),
  ('policy.manage',         'settings',  'سياسة العمل',                 null),
  ('subscription.manage',   'settings',  'الاشتراك والباقات',           null)
ON CONFLICT (key) DO UPDATE
  SET module = EXCLUDED.module, name_ar = EXCLUDED.name_ar, description = EXCLUDED.description;

-- The legacy roles get exactly what their screens already open to them (the
-- denyRoles lists in the app), so adding a permission check to a screen does
-- not change who sees it. Mirrored in src/lib/legacyRolePermissions.ts.
CREATE OR REPLACE FUNCTION public.legacy_role_permissions(_role public.user_role)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _role::text
    WHEN 'owner' THEN ARRAY[
      'products.view','products.create','products.update','products.delete',
      'products.media.upload','products.media.delete','categories.manage',
      'employees.view','employees.create','employees.update','employees.delete',
      'users.view','users.create','users.update','users.delete',
      'roles.view','roles.manage',
      'dashboard.view','pos.access','invoices.view','reports.view','closings.manage',
      'suppliers.manage','repairs.manage','online_orders.manage','store.manage',
      'customers.manage','marketing.manage','wholesale.manage','stocktake.manage',
      'transfers.manage','shipping.manage','ai_insights.view','attendance.manage',
      'payroll.manage','branches.manage','settings.manage','policy.manage',
      'subscription.manage']
    WHEN 'admin' THEN ARRAY[
      'products.view','products.create','products.update','products.delete',
      'products.media.upload','products.media.delete','categories.manage',
      'employees.view','employees.create','employees.update','employees.delete',
      'users.view','users.create','users.update','users.delete',
      'roles.view','roles.manage',
      'dashboard.view','pos.access','invoices.view','reports.view','closings.manage',
      'suppliers.manage','repairs.manage','online_orders.manage','store.manage',
      'customers.manage','marketing.manage','wholesale.manage','stocktake.manage',
      'transfers.manage','shipping.manage','ai_insights.view','attendance.manage',
      'payroll.manage','branches.manage','settings.manage','policy.manage',
      'subscription.manage']
    WHEN 'inventory_manager' THEN ARRAY[
      'products.view','products.create','products.update','products.delete',
      'products.media.upload','products.media.delete','categories.manage',
      'dashboard.view','pos.access','invoices.view','reports.view','closings.manage',
      'suppliers.manage','repairs.manage','online_orders.manage','store.manage',
      'customers.manage','marketing.manage','wholesale.manage','stocktake.manage',
      'transfers.manage','shipping.manage','ai_insights.view','attendance.manage',
      'branches.manage','settings.manage']
    WHEN 'branch_manager' THEN ARRAY[
      'products.view','products.create','products.update',
      'products.media.upload','products.media.delete','employees.view',
      'dashboard.view','pos.access','invoices.view','reports.view','closings.manage',
      'suppliers.manage','repairs.manage','online_orders.manage','store.manage',
      'customers.manage','marketing.manage','wholesale.manage','stocktake.manage',
      'transfers.manage','shipping.manage','ai_insights.view','attendance.manage',
      'branches.manage','settings.manage']
    -- a cashier sells, takes repairs and closes the day; nothing else
    WHEN 'cashier' THEN ARRAY[
      'products.view','pos.access','repairs.manage','closings.manage']
    -- 'custom' (and anything unknown) implies nothing: its role rows decide
    ELSE ARRAY[]::text[]
  END
$$;

-- Keep the system role rows in step with the map above
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
  FROM public.roles r
  CROSS JOIN LATERAL unnest(public.legacy_role_permissions(r.legacy_role)) AS p(key)
 WHERE r.merchant_id IS NULL AND r.legacy_role IS NOT NULL
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2 · What a custom role may never hold
--
-- Managing users and roles is how one grants oneself everything; billing, the
-- shop's own settings and its branches are written only by the owner/admin in
-- the database today (has_merchant_role / is_owner_or_admin policies). These
-- stay with the system roles. Enforced on role_permissions itself, so no path
-- — RPC, direct write, platform tooling — can put one on a merchant's role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_role_forbidden_permissions()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY['roles.view','roles.manage',
               'users.view','users.create','users.update','users.delete',
               'subscription.manage','settings.manage','policy.manage','branches.manage']
$$;

CREATE OR REPLACE FUNCTION public.guard_custom_role_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.permission_key = ANY (public.custom_role_forbidden_permissions())
     AND EXISTS (SELECT 1 FROM public.roles r WHERE r.id = NEW.role_id AND NOT r.is_system) THEN
    RAISE EXCEPTION 'permission_not_allowed_for_custom_role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS role_permissions_guard_custom ON public.role_permissions;
CREATE TRIGGER role_permissions_guard_custom
  BEFORE INSERT OR UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_custom_role_permission();

-- A member leaving 'custom' must not keep the custom role's grants; a member
-- moving between system roles keeps the existing behaviour.
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

    IF OLD.role::text = 'custom' THEN
      DELETE FROM public.user_roles ur
       USING public.roles r
       WHERE ur.merchant_user_id = NEW.id AND ur.role_id = r.id AND NOT r.is_system;
    END IF;
  END IF;

  INSERT INTO public.user_roles (merchant_user_id, role_id)
  SELECT NEW.id, r.id FROM public.roles r
   WHERE r.merchant_id IS NULL AND r.legacy_role = NEW.role
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3 · Changing roles
-- ---------------------------------------------------------------------------

-- Create (_role_id NULL) or edit a role this merchant owns. Owner and admin:
-- roles.manage is held by those two system roles and no custom role can hold it.
CREATE OR REPLACE FUNCTION public.save_custom_role(
  _role_id uuid,
  _name text,
  _description text,
  _permissions text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant uuid := public.get_user_merchant_id();
  _clean    text := btrim(coalesce(_name, ''));
  _perms    text[] := ARRAY(SELECT DISTINCT unnest(coalesce(_permissions, ARRAY[]::text[])));
  _id       uuid;
BEGIN
  IF _merchant IS NULL OR NOT public.has_permission('roles.manage') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _clean = '' OR length(_clean) > 60 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  IF cardinality(_perms) = 0 THEN
    RAISE EXCEPTION 'no_permissions';
  END IF;

  IF _perms && public.custom_role_forbidden_permissions()
     OR EXISTS (SELECT 1 FROM unnest(_perms) k
                 WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.key = k)) THEN
    RAISE EXCEPTION 'invalid_permission';
  END IF;

  -- A custom role may not pass for a system one, nor for another of the shop's
  IF EXISTS (SELECT 1 FROM public.roles r
              WHERE (r.merchant_id IS NULL OR r.merchant_id = _merchant)
                AND lower(btrim(r.name_ar)) = lower(_clean)
                AND r.id IS DISTINCT FROM _role_id) THEN
    RAISE EXCEPTION 'duplicate_name';
  END IF;

  IF _role_id IS NULL THEN
    INSERT INTO public.roles (merchant_id, key, name_ar, description, is_system, legacy_role)
    VALUES (_merchant, 'custom_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
            _clean, nullif(btrim(coalesce(_description, '')), ''), false, NULL)
    RETURNING id INTO _id;
  ELSE
    UPDATE public.roles
       SET name_ar = _clean,
           description = nullif(btrim(coalesce(_description, '')), ''),
           updated_at = now()
     WHERE id = _role_id AND merchant_id = _merchant AND NOT is_system
    RETURNING id INTO _id;
    IF _id IS NULL THEN
      RAISE EXCEPTION 'not_found';
    END IF;
    DELETE FROM public.role_permissions WHERE role_id = _id;
  END IF;

  INSERT INTO public.role_permissions (role_id, permission_key)
  SELECT _id, k FROM unnest(_perms) AS k;

  RETURN _id;
END;
$$;

-- A role still held by someone is not deleted: its members would be left
-- signed in with no access and no explanation. Reassign them first.
CREATE OR REPLACE FUNCTION public.delete_custom_role(_role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant uuid := public.get_user_merchant_id();
BEGIN
  IF _merchant IS NULL OR NOT public.has_permission('roles.manage') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles
                  WHERE id = _role_id AND merchant_id = _merchant AND NOT is_system) THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles ur
               JOIN public.merchant_users mu ON mu.id = ur.merchant_user_id
              WHERE ur.role_id = _role_id AND mu.is_active) THEN
    RAISE EXCEPTION 'role_in_use';
  END IF;

  DELETE FROM public.roles WHERE id = _role_id;
END;
$$;

-- Give a member a system role or one of the shop's custom roles. Whoever may
-- edit users (owner, admin) may do this — the same people who could already
-- change merchant_users.role. A custom role can grant nothing they lack, since
-- the forbidden list is everything only the owner/admin hold.
CREATE OR REPLACE FUNCTION public.assign_member_role(
  _member_id uuid,
  _role text,
  _custom_role_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant uuid := public.get_user_merchant_id();
  _target   public.merchant_users%ROWTYPE;
BEGIN
  IF _merchant IS NULL OR NOT public.has_permission('users.update') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _target FROM public.merchant_users
   WHERE id = _member_id AND merchant_id = _merchant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- The owner stays the owner, and nobody is made one from here
  IF _target.role::text = 'owner' THEN
    RAISE EXCEPTION 'owner_locked';
  END IF;
  IF _role NOT IN ('admin', 'branch_manager', 'inventory_manager', 'cashier', 'custom') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  IF _role = 'custom' AND NOT EXISTS (
       SELECT 1 FROM public.roles
        WHERE id = _custom_role_id AND merchant_id = _merchant AND NOT is_system) THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  UPDATE public.merchant_users SET role = _role::public.user_role, updated_at = now()
   WHERE id = _member_id;

  -- One custom role per member: drop the previous one, add the new one
  DELETE FROM public.user_roles ur
   USING public.roles r
   WHERE ur.merchant_user_id = _member_id AND ur.role_id = r.id AND NOT r.is_system;

  IF _role = 'custom' THEN
    INSERT INTO public.user_roles (merchant_user_id, role_id, granted_by)
    VALUES (_member_id, _custom_role_id, auth.uid());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_custom_role(uuid, text, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_custom_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_member_role(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_custom_role(uuid, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_custom_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_member_role(uuid, text, uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- 4 · Enforcement
--
-- Most tables are scoped by merchant only: anyone in the shop reads and writes
-- them, and the app decided per legacy role what to show. A custom role has no
-- such screen logic to lean on, so its limits are put in the database.
--
-- member_can_any() is true for everyone who is NOT a custom member — those
-- policies then add nothing, and the system roles keep today's behaviour
-- exactly — and for a custom member only when their role grants one of the
-- listed permissions. The policies are RESTRICTIVE: they AND with the existing
-- permissive ones, so they can only take access away, never give it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_can_any(_permissions text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
           SELECT 1 FROM public.merchant_users mu
            WHERE mu.user_id = auth.uid() AND mu.role::text = 'custom')
      OR EXISTS (
           SELECT 1
             FROM public.merchant_users mu
             JOIN public.user_roles ur       ON ur.merchant_user_id = mu.id
             JOIN public.role_permissions rp ON rp.role_id = ur.role_id
            WHERE mu.user_id = auth.uid() AND mu.is_active
              AND rp.permission_key = ANY (_permissions))
$$;

REVOKE ALL ON FUNCTION public.member_can_any(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_can_any(text[]) TO authenticated;

DO $$
DECLARE
  _products_read text := 'products.view,pos.access,repairs.manage,online_orders.manage,stocktake.manage,transfers.manage,suppliers.manage,reports.view,dashboard.view,wholesale.manage';
  _stock_write   text := 'products.create,products.update,products.delete,pos.access,repairs.manage,online_orders.manage,stocktake.manage,transfers.manage';
  -- receiving a purchase order adds to accessory stock (new devices need products.create)
  _qty_write     text := _stock_write || ',suppliers.manage';
  _sales_read    text := 'pos.access,invoices.view,reports.view,closings.manage,dashboard.view,customers.manage,payroll.manage';
  _cust_read     text := 'customers.manage,pos.access,marketing.manage,reports.view,online_orders.manage,repairs.manage,dashboard.view';
  _cust_write    text := 'customers.manage,pos.access,online_orders.manage,repairs.manage';
  -- table, who may read (NULL: reads stay as they are), who may write
  _rules text[][] := ARRAY[
    ['devices',                       _products_read, _stock_write],
    ['accessories',                   _products_read, _qty_write],
    ['repair_parts',                  _products_read, _qty_write],
    ['merchant_categories',           _products_read, 'categories.manage'],
    ['product_media',                 _products_read, 'products.media.upload,products.media.delete'],
    ['sales',                         _sales_read,    'pos.access'],
    ['sale_items',                    _sales_read,    'pos.access'],
    ['daily_closings',                'closings.manage,reports.view,dashboard.view', 'closings.manage'],
    ['repair_orders',                 'repairs.manage,reports.view,dashboard.view,customers.manage', 'repairs.manage'],
    ['repair_order_parts',            'repairs.manage,reports.view,dashboard.view', 'repairs.manage'],
    ['online_orders',                 'online_orders.manage,reports.view,dashboard.view,customers.manage', 'online_orders.manage'],
    ['online_order_items',            'online_orders.manage,reports.view,dashboard.view,customers.manage', 'online_orders.manage'],
    ['merchant_payouts',              'online_orders.manage,store.manage,reports.view', 'store.manage'],
    ['store_settings',                NULL,           'store.manage'],
    ['store_pages',                   NULL,           'store.manage'],
    ['store_categories',              NULL,           'store.manage'],
    ['customers',                     _cust_read,     _cust_write],
    ['loyalty_transactions',          _cust_read,     _cust_write],
    ['campaigns',                     'marketing.manage', 'marketing.manage'],
    ['coupons',                       'marketing.manage,pos.access,store.manage', 'marketing.manage,pos.access'],
    ['stocktakes',                    'stocktake.manage,reports.view', 'stocktake.manage'],
    ['stocktake_items',               'stocktake.manage,reports.view', 'stocktake.manage'],
    ['stock_transfers',               'transfers.manage,reports.view', 'transfers.manage'],
    ['stock_transfer_items',          'transfers.manage,reports.view', 'transfers.manage'],
    ['suppliers',                     'suppliers.manage,reports.view', 'suppliers.manage'],
    ['purchase_orders',               'suppliers.manage,reports.view', 'suppliers.manage'],
    ['purchase_order_items',          'suppliers.manage,reports.view', 'suppliers.manage'],
    ['wholesale_listings',            'wholesale.manage', 'wholesale.manage'],
    ['wholesale_orders',              'wholesale.manage', 'wholesale.manage'],
    ['wholesale_order_items',         'wholesale.manage', 'wholesale.manage'],
    ['wholesale_credit_transactions', 'wholesale.manage', 'wholesale.manage']
  ];
  _i int;
  _t text; _read text; _write text;
BEGIN
  FOR _i IN 1 .. array_length(_rules, 1) LOOP
    _t := _rules[_i][1]; _read := _rules[_i][2]; _write := _rules[_i][3];

    -- Tables some deployments do not have are skipped, not failed on
    CONTINUE WHEN to_regclass('public.' || _t) IS NULL;

    EXECUTE format('DROP POLICY IF EXISTS "Custom roles read %s" ON public.%I', _t, _t);
    EXECUTE format('DROP POLICY IF EXISTS "Custom roles insert %s" ON public.%I', _t, _t);
    EXECUTE format('DROP POLICY IF EXISTS "Custom roles update %s" ON public.%I', _t, _t);
    EXECUTE format('DROP POLICY IF EXISTS "Custom roles delete %s" ON public.%I', _t, _t);

    -- (SELECT …) makes the check an init plan: once per statement, not per row
    IF _read IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY "Custom roles read %s" ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated
           USING ((SELECT public.member_can_any(%L::text[])))',
        _t, _t, '{' || _read || '}');
    END IF;

    EXECUTE format(
      'CREATE POLICY "Custom roles insert %s" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
         WITH CHECK ((SELECT public.member_can_any(%L::text[])))',
      _t, _t, '{' || _write || '}');
    EXECUTE format(
      'CREATE POLICY "Custom roles update %s" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
         USING ((SELECT public.member_can_any(%L::text[])))
         WITH CHECK ((SELECT public.member_can_any(%L::text[])))',
      _t, _t, '{' || _write || '}', '{' || _write || '}');
    EXECUTE format(
      'CREATE POLICY "Custom roles delete %s" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
         USING ((SELECT public.member_can_any(%L::text[])))',
      _t, _t, '{' || _write || '}');
  END LOOP;
END
$$;

-- Suppliers, purchases, campaigns and coupons are written only by owner/admin
-- (is_owner_or_admin). A custom role granted the matching permission gets the
-- same write; nobody else's access changes, since only custom members match.
CREATE OR REPLACE FUNCTION public.is_custom_member_with(_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.merchant_users mu
      JOIN public.user_roles ur       ON ur.merchant_user_id = mu.id
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
     WHERE mu.user_id = auth.uid() AND mu.is_active AND mu.role::text = 'custom'
       AND rp.permission_key = _permission)
$$;

REVOKE ALL ON FUNCTION public.is_custom_member_with(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_custom_member_with(text) TO authenticated;

DO $$
DECLARE
  _t text; _perm text;
BEGIN
  FOR _t, _perm IN VALUES ('suppliers','suppliers.manage'), ('purchase_orders','suppliers.manage'),
                          ('campaigns','marketing.manage'), ('coupons','marketing.manage') LOOP
    CONTINUE WHEN to_regclass('public.' || _t) IS NULL;
    EXECUTE format('DROP POLICY IF EXISTS "Custom roles manage %s" ON public.%I', _t, _t);
    EXECUTE format(
      'CREATE POLICY "Custom roles manage %s" ON public.%I FOR ALL TO authenticated
         USING (merchant_id = public.get_user_merchant_id() AND (SELECT public.is_custom_member_with(%L)))
         WITH CHECK (merchant_id = public.get_user_merchant_id() AND (SELECT public.is_custom_member_with(%L)))',
      _t, _t, _perm, _perm);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS "Custom roles manage purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "Custom roles manage purchase_order_items"
  ON public.purchase_order_items FOR ALL TO authenticated
  USING ((SELECT public.is_custom_member_with('suppliers.manage')) AND EXISTS (
          SELECT 1 FROM public.purchase_orders po
           WHERE po.id = purchase_order_items.purchase_order_id
             AND po.merchant_id = public.get_user_merchant_id()))
  WITH CHECK ((SELECT public.is_custom_member_with('suppliers.manage')) AND EXISTS (
          SELECT 1 FROM public.purchase_orders po
           WHERE po.id = purchase_order_items.purchase_order_id
             AND po.merchant_id = public.get_user_merchant_id()));
