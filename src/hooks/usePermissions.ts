import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { permissionsForLegacyRole } from '@/lib/legacyRolePermissions';

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
  | 'roles.view' | 'roles.manage';

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
      setPermissions(permissionsForLegacyRole(merchantUser.role));
    } else {
      setPermissions((data as unknown as string[]) || []);
    }
    setLoading(false);
  }, [user, merchantUser]);

  useEffect(() => { load(); }, [load]);

  const set = useMemo(() => new Set(permissions), [permissions]);

  const can = useCallback((permission: PermissionKey) => set.has(permission), [set]);
  const canAny = useCallback(
    (...keys: PermissionKey[]) => keys.some(k => set.has(k)),
    [set],
  );

  return { permissions, can, canAny, loading, refresh: load };
}
