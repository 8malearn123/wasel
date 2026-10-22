import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CUSTOM_ROLE_FORBIDDEN } from '@/lib/legacyRolePermissions';
import { CUSTOM_ROLE_CATALOG } from '@/lib/permissionCatalog';
import {
  loadCustomRolesConfig,
  saveCustomRolesConfig,
  CUSTOM_ROLE_BASE,
  type CustomRolesConfig,
} from '@/lib/customRolesStore';

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

/** The function or table is not there: the database has not had the migration. */
export function isMissingInDatabase(message?: string): boolean {
  return !!message && /schema cache|PGRST20[25]|does not exist/i.test(message);
}

export function roleErrorMessage(message?: string): string {
  if (!message) return 'حدث خطأ';
  const known = Object.keys(ERRORS).find(k => message.includes(k));
  return known ? ERRORS[known] : message;
}

/**
 * The shop's own roles and the permissions they may be built from. Writing
 * goes through save_custom_role / delete_custom_role / assign_member_role,
 * which check roles.manage (owner, admin) or users.update in the database — the UI
 * hiding a button is a convenience, not the lock.
 */
export function useCustomRoles() {
  const { merchant } = useAuth();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [catalog, setCatalog] = useState<CatalogPermission[]>(CUSTOM_ROLE_CATALOG);
  const [loading, setLoading] = useState(true);
  // false until the custom-roles migration is on this database: the editor
  // still shows the list, and says saving needs the update
  const [databaseReady, setDatabaseReady] = useState(true);

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

    const fromDb = ((catalogRes.data as unknown as PermRow[]) || [])
      .filter(p => !CUSTOM_ROLE_FORBIDDEN.has(p.key))
      .map(p => ({ key: p.key, module: p.module, name: p.name_ar, description: p.description }));
    // The screen permissions come with the custom-roles migration; a database
    // without them (or without the table at all) is not ready to save roles
    const ready = !rolesRes.error && !catalogRes.error && fromDb.some(p => p.key === 'reports.view');
    setDatabaseReady(ready);
    setCatalog(ready ? fromDb : CUSTOM_ROLE_CATALOG);

    // Without the migration the roles live in the app's own store
    if (!ready) {
      const config = await loadCustomRolesConfig(merchant.id);
      const active = await activeMemberIds(merchant.id);
      setRoles(config.roles.map(r => ({
        ...r,
        memberCount: Object.entries(config.assignments)
          .filter(([member, role]) => role === r.id && active.has(member)).length,
      })));
    }

    setLoading(false);
  }, [merchant]);

  useEffect(() => { load(); }, [load]);

  const saveRole = async (
    roleId: string | null,
    name: string,
    description: string,
    permissions: string[],
  ): Promise<{ id?: string; error?: string }> => {
    if (!databaseReady && merchant) {
      const result = await saveRoleInStore(merchant.id, roleId, name, description, permissions);
      if (!result.error) await load();
      return result;
    }
    const { data, error } = await supabase.rpc('save_custom_role' as never, {
      _role_id: roleId, _name: name, _description: description, _permissions: permissions,
    } as never);
    if (error) return { error: roleErrorMessage(error.message) };
    await load();
    return { id: data as unknown as string };
  };

  const deleteRole = async (roleId: string): Promise<{ error?: string }> => {
    if (!databaseReady && merchant) {
      const config = await loadCustomRolesConfig(merchant.id);
      const active = await activeMemberIds(merchant.id);
      if (Object.entries(config.assignments).some(([m, r]) => r === roleId && active.has(m))) {
        return { error: ERRORS.role_in_use };
      }
      const result = await saveCustomRolesConfig(merchant.id, {
        roles: config.roles.filter(r => r.id !== roleId),
        assignments: Object.fromEntries(Object.entries(config.assignments).filter(([, r]) => r !== roleId)),
      });
      if (!result.error) await load();
      return result;
    }
    const { error } = await supabase.rpc('delete_custom_role' as never, { _role_id: roleId } as never);
    if (error) return { error: roleErrorMessage(error.message) };
    await load();
    return {};
  };

  return { roles, catalog, loading, databaseReady, refresh: load, saveRole, deleteRole };
}

/** Give a member one of the shop's custom roles (system roles keep their own path). */
export async function assignCustomRole(memberId: string, customRoleId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('assign_member_role' as never, {
    _member_id: memberId, _role: 'custom', _custom_role_id: customRoleId,
  } as never);
  if (error && isMissingInDatabase(error.message)) return assignInStore(memberId, customRoleId);
  return error ? { error: roleErrorMessage(error.message) } : {};
}

/** Move a member off a custom role onto a system one — the RPC also drops the custom grant. */
export async function assignSystemRole(memberId: string, role: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('assign_member_role' as never, {
    _member_id: memberId, _role: role, _custom_role_id: null,
  } as never);
  if (error && isMissingInDatabase(error.message)) return assignInStore(memberId, null, role);
  return error ? { error: roleErrorMessage(error.message) } : {};
}

// ── Without the migration ──────────────────────────────────────────────────
// The same rules save_custom_role / assign_member_role enforce, applied here.

async function activeMemberIds(merchantId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('merchant_users')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('is_active', true);
  return new Set((data || []).map(m => m.id));
}

const SYSTEM_ROLE_NAMES = ['صاحب المتجر', 'مالك', 'مدير', 'مدير فرع', 'مسؤول المخزون', 'مدير مخزون', 'كاشير'];

async function saveRoleInStore(
  merchantId: string,
  roleId: string | null,
  name: string,
  description: string,
  permissions: string[],
): Promise<{ id?: string; error?: string }> {
  const clean = name.trim();
  const perms = [...new Set(permissions)];
  const known = new Set(CUSTOM_ROLE_CATALOG.map(p => p.key));
  if (!clean || clean.length > 60) return { error: ERRORS.invalid_name };
  if (perms.length === 0) return { error: ERRORS.no_permissions };
  if (perms.some(k => CUSTOM_ROLE_FORBIDDEN.has(k) || !known.has(k))) return { error: ERRORS.invalid_permission };

  const config = await loadCustomRolesConfig(merchantId);
  const lower = clean.toLowerCase();
  if (SYSTEM_ROLE_NAMES.includes(clean)
      || config.roles.some(r => r.id !== roleId && r.name.trim().toLowerCase() === lower)) {
    return { error: ERRORS.duplicate_name };
  }

  let id = roleId;
  let roles: CustomRolesConfig['roles'];
  if (roleId) {
    if (!config.roles.some(r => r.id === roleId)) return { error: ERRORS.not_found };
    roles = config.roles.map(r => r.id === roleId
      ? { ...r, name: clean, description: description.trim() || null, permissions: perms }
      : r);
  } else {
    id = crypto.randomUUID();
    roles = [...config.roles, { id, name: clean, description: description.trim() || null, permissions: perms }];
  }

  const result = await saveCustomRolesConfig(merchantId, { roles, assignments: config.assignments });
  return result.error ? result : { id: id! };
}

async function assignInStore(memberId: string, customRoleId: string | null, systemRole?: string): Promise<{ error?: string }> {
  const { data: member } = await supabase
    .from('merchant_users')
    .select('id, merchant_id, role')
    .eq('id', memberId)
    .maybeSingle();
  if (!member) return { error: ERRORS.not_found };
  if (member.role === 'owner') return { error: ERRORS.owner_locked };

  const config = await loadCustomRolesConfig(member.merchant_id);
  if (customRoleId && !config.roles.some(r => r.id === customRoleId)) return { error: ERRORS.invalid_role };

  // The database keeps the least it grants (cashier) for a custom-role member;
  // a system role is written as before. The policy on merchant_users decides
  // who may do either — owner and admin.
  const dbRole = customRoleId ? CUSTOM_ROLE_BASE : systemRole;
  if (!dbRole || !['admin', 'branch_manager', 'inventory_manager', 'cashier'].includes(dbRole)) {
    return { error: ERRORS.invalid_role };
  }
  if (member.role !== dbRole) {
    const { data: updated, error } = await supabase
      .from('merchant_users')
      .update({ role: dbRole as never })
      .eq('id', memberId)
      .select('id');
    if (error) return { error: error.message };
    if (!updated || updated.length === 0) return { error: ERRORS.forbidden };
  }

  const assignments = { ...config.assignments };
  if (customRoleId) assignments[memberId] = customRoleId;
  else delete assignments[memberId];
  return saveCustomRolesConfig(member.merchant_id, { roles: config.roles, assignments });
}
