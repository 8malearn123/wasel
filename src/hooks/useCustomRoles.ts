import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CUSTOM_ROLE_FORBIDDEN } from '@/lib/legacyRolePermissions';

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  /** active members holding it */
  memberCount: number;
}

export interface CatalogPermission {
  key: string;
  module: string;
  name: string;
  description: string | null;
}

// What the database raises → what the owner reads
const ERRORS: Record<string, string> = {
  forbidden: 'لا تملك صلاحية إدارة الأدوار',
  invalid_name: 'اسم الدور مطلوب (60 حرفًا كحد أقصى)',
  no_permissions: 'اختر صلاحية واحدة على الأقل',
  invalid_permission: 'إحدى الصلاحيات المختارة غير مسموحة للأدوار المخصصة',
  duplicate_name: 'يوجد دور بنفس الاسم',
  not_found: 'الدور غير موجود',
  role_in_use: 'الدور مسند لمستخدمين — غيّر أدوارهم أولًا ثم احذفه',
  owner_locked: 'دور المالك لا يمكن تغييره',
  invalid_role: 'الدور المختار غير صالح',
};

export function roleErrorMessage(message?: string): string {
  if (!message) return 'حدث خطأ';
  // the function or table is not there: the database has not had the migration
  if (/schema cache|PGRST20[25]|does not exist/i.test(message)) {
    return 'الأدوار المخصصة تحتاج تحديث قاعدة البيانات أولًا (custom roles migration)';
  }
  const known = Object.keys(ERRORS).find(k => message.includes(k));
  return known ? ERRORS[known] : message;
}

/**
 * The shop's own roles and the permissions they may be built from. Writing
 * goes through save_custom_role / delete_custom_role / assign_member_role,
 * which check roles.manage (owner) or users.update in the database — the UI
 * hiding a button is a convenience, not the lock.
 */
export function useCustomRoles() {
  const { merchant } = useAuth();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [catalog, setCatalog] = useState<CatalogPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);

    const [rolesRes, catalogRes] = await Promise.all([
      supabase
        .from('roles' as never)
        .select('id, name_ar, description, role_permissions(permission_key), user_roles(merchant_user:merchant_users(is_active))')
        .eq('merchant_id', merchant.id)
        .eq('is_system', false)
        .order('created_at'),
      supabase
        .from('permissions' as never)
        .select('key, module, name_ar, description')
        .order('module'),
    ]);

    type RoleRow = {
      id: string; name_ar: string; description: string | null;
      role_permissions: { permission_key: string }[] | null;
      user_roles: { merchant_user: { is_active: boolean } | null }[] | null;
    };
    type PermRow = { key: string; module: string; name_ar: string; description: string | null };

    setRoles(((rolesRes.data as unknown as RoleRow[]) || []).map(r => ({
      id: r.id,
      name: r.name_ar,
      description: r.description,
      permissions: (r.role_permissions || []).map(p => p.permission_key),
      memberCount: (r.user_roles || []).filter(u => u.merchant_user?.is_active).length,
    })));

    setCatalog(((catalogRes.data as unknown as PermRow[]) || [])
      .filter(p => !CUSTOM_ROLE_FORBIDDEN.has(p.key))
      .map(p => ({ key: p.key, module: p.module, name: p.name_ar, description: p.description })));

    setLoading(false);
  }, [merchant]);

  useEffect(() => { load(); }, [load]);

  const saveRole = async (
    roleId: string | null,
    name: string,
    description: string,
    permissions: string[],
  ): Promise<{ id?: string; error?: string }> => {
    const { data, error } = await supabase.rpc('save_custom_role' as never, {
      _role_id: roleId, _name: name, _description: description, _permissions: permissions,
    } as never);
    if (error) return { error: roleErrorMessage(error.message) };
    await load();
    return { id: data as unknown as string };
  };

  const deleteRole = async (roleId: string): Promise<{ error?: string }> => {
    const { error } = await supabase.rpc('delete_custom_role' as never, { _role_id: roleId } as never);
    if (error) return { error: roleErrorMessage(error.message) };
    await load();
    return {};
  };

  return { roles, catalog, loading, refresh: load, saveRole, deleteRole };
}

/** Give a member one of the shop's custom roles (system roles keep their own path). */
export async function assignCustomRole(memberId: string, customRoleId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('assign_member_role' as never, {
    _member_id: memberId, _role: 'custom', _custom_role_id: customRoleId,
  } as never);
  return error ? { error: roleErrorMessage(error.message) } : {};
}

/** Move a member off a custom role onto a system one — the RPC also drops the custom grant. */
export async function assignSystemRole(memberId: string, role: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('assign_member_role' as never, {
    _member_id: memberId, _role: role, _custom_role_id: null,
  } as never);
  return error ? { error: roleErrorMessage(error.message) } : {};
}
