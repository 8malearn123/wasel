import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
      // Before the Phase 1 migration lands the function does not exist. Fail
      // closed: an empty list hides the new controls rather than showing
      // everyone everything.
      console.warn('[permissions] my_permissions unavailable:', error.message);
      setPermissions([]);
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
