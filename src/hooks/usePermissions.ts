import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
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

export function usePermissions() {
  const { user, merchantUser } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !merchantUser) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc('my_permissions' as never);

    if (error) {
      // The Phase 1 migration has not been applied, so my_permissions() does
      // not exist yet. Returning an empty list here was wrong: it hid "add
      // product" and "delete product" from everyone — owners included — while
      // the database, still on its old merchant-scoped policy, allowed both.
      // A UI stricter than the server protects nothing and only breaks screens.
      //
      // Falling back to the legacy role map gives the same answer the server
      // gives in this state, and the same answer has_permission() will give
      // once the migration lands.
      console.warn(
        '[permissions] my_permissions unavailable, falling back to the role map:',
        error.message,
      );
      // a custom role kept in the app's store carries its own list
      setPermissions(merchantUser.role === 'custom'
        ? (merchantUser.customRole?.permissions ?? []).filter(k => !CUSTOM_ROLE_FORBIDDEN.has(k))
        : permissionsForLegacyRole(merchantUser.role));
    } else {
      setPermissions((data as unknown as string[]) || []);
    }
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
  const settled = role && role !== 'custom' ? false : loading;
  return { permissions: [...set], can, canAny, loading: settled, refresh: load };
}
