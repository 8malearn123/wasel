import { useCallback, useEffect, useMemo, useState } from 'react';
import { callOptionalRpc } from '@/lib/optionalRpc';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { permissionsForLegacyRole, CUSTOM_ROLE_FORBIDDEN } from '@/lib/legacyRolePermissions';

/**
 * What the signed-in user may do, as the database sees it.
 *
 * The list comes from my_permissions(), which unions the roles assigned in
 * user_roles with the permissions the legacy merchant_users.role implies — so
 * this is correct both for accounts that have been given explicit roles and for
 * accounts that have not.
 *
 * This is for deciding what to SHOW. It is not the boundary: every table has an
 * RLS policy calling has_permission() for the same key, so a user who gets past
 * the UI still cannot write.
 */

export type PermissionSource = 'server' | 'role-map' | 'failed' | 'none';

export type PermissionKey =
  | 'products.view' | 'products.create' | 'products.update' | 'products.delete'
  | 'products.media.upload' | 'products.media.delete' | 'categories.manage'
  | 'employees.view' | 'employees.create' | 'employees.update' | 'employees.delete'
  | 'users.view' | 'users.create' | 'users.update' | 'users.delete'
  | 'roles.view' | 'roles.manage'
  | 'dashboard.view' | 'pos.access' | 'invoices.view' | 'reports.view' | 'closings.manage'
  | 'suppliers.manage' | 'repairs.manage' | 'online_orders.manage' | 'store.manage'
  | 'customers.manage' | 'marketing.manage' | 'wholesale.manage' | 'stocktake.manage'
  | 'transfers.manage' | 'shipping.manage' | 'ai_insights.view' | 'attendance.manage'
  | 'payroll.manage' | 'branches.manage' | 'settings.manage' | 'policy.manage'
  | 'subscription.manage';

// one message per session, however many components ask
const told = new Set<string>();
const tellOnce = (key: string, show: () => void) => { if (!told.has(key)) { told.add(key); show(); } };

export function usePermissions() {
  const { user, merchantUser, memberLoading } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // where the list came from: the server, the role map (function not
  // installed), or nothing (the call failed)
  const [source, setSource] = useState<PermissionSource>('none');
  // the member the list belongs to. Between the member arriving and the list
  // being read there is a render where `loading` is still false from before —
  // a custom role then looked like a role with no permissions, and the guards
  // sent it away (the employee landed on /organization from every page)
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !merchantUser) {
      setPermissions([]);
      setSource('none');
      setLoadedFor(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error, missing } = await callOptionalRpc<string[]>('my_permissions', user.id);

    if (error && missing) {
      setSource('role-map');
      // The Phase 1 migration has not been applied, so my_permissions() does
      // not exist yet (404). The role's own permission map is what the server
      // checks in this state (and has_permission() unions the same map once
      // the migration lands), so it is used — not guessed. The owner/admin is
      // told once that the server function is missing.
      const system = merchantUser.customRole?.system;
      setPermissions(merchantUser.role === 'custom'
        ? (merchantUser.customRole?.permissions ?? [])
            .filter(k => !CUSTOM_ROLE_FORBIDDEN.has(k) || (!!system && permissionsForLegacyRole(system).includes(k)))
        : permissionsForLegacyRole(merchantUser.role));
      if (merchantUser.role === 'owner' || merchantUser.role === 'admin') {
        tellOnce('permissions-missing', () => toast.info(
          'خدمة الصلاحيات غير مفعّلة على الخادم بعد، فتُطبَّق الصلاحيات الأساسية لكل دور. يلزم تفعيلها من جهة الخادم.',
          { duration: 8000 },
        ));
      }
    } else if (error) {
      setSource('failed');
      // Any other failure (connection, server error): the answer is unknown,
      // so nothing extra is granted. A custom role then sees none of its
      // screens; a system role keeps only its base map (merged below).
      console.warn('[permissions] my_permissions failed:', error.message);
      setPermissions([]);
      tellOnce('permissions-failed', () => toast.error(
        'تعذّر التحقق من صلاحياتك، فقد لا تظهر بعض الأقسام. تحقّق من الاتصال ثم أعد تحميل الصفحة.',
        { duration: 8000 },
      ));
    } else {
      setSource('server');
      setPermissions((data as unknown as string[]) || []);
    }
    setLoadedFor(merchantUser.id);
    setLoading(false);
  }, [user, merchantUser]);

  useEffect(() => { load(); }, [load]);

  // A system role always has its map, whatever the database answered: the
  // screen permissions are newer than my_permissions() on a database that has
  // not had the custom-roles migration yet, and has_permission() unions the
  // same map anyway. A custom role has only what its own rows grant.
  const role = merchantUser?.role;
  const set = useMemo(
    () => new Set(role && role !== 'custom'
      ? [...permissions, ...permissionsForLegacyRole(role)]
      : permissions),
    [permissions, role],
  );

  const can = useCallback((permission: PermissionKey) => set.has(permission), [set]);
  const canAny = useCallback(
    (...keys: PermissionKey[]) => keys.some(k => set.has(k)),
    [set],
  );

  // For a system role the map is known with the session, so nothing waits on
  // the round trip; a custom role, or a session not read yet, does
  const settled = memberLoading
    || (role && role !== 'custom' ? false : loading || (!!merchantUser && loadedFor !== merchantUser.id));
  return { permissions: [...set], can, canAny, loading: settled, source, refresh: load };
}
