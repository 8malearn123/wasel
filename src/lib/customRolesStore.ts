import { supabase } from '@/integrations/supabase/client';

/**
 * Custom roles WITHOUT the database migration.
 *
 * Until 20261020100100_custom_roles.sql is applied there is no roles table and
 * merchant_users.role cannot be 'custom'. So the shop's roles and who holds
 * them are kept as one snapshot in activity_logs (entity_type 'custom_roles'),
 * which every member of the shop can already read and write; the newest
 * snapshot is the current one. A member given a custom role keeps
 * merchant_users.role = 'cashier' — the least the database grants — and the app
 * then shows them only what their role allows.
 *
 * WHAT THIS DOES NOT DO: the database does not know these roles, so it still
 * applies the cashier's policies to such a member. The limits here are the
 * app's screens. Applying the migration moves everything to the real tables
 * and RLS; this store is then no longer read (see useCustomRoles).
 */

export const CUSTOM_ROLES_ENTITY = 'custom_roles';
/** the database role a custom-role member keeps while roles live here */
export const CUSTOM_ROLE_BASE = 'cashier';

export interface StoredRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface CustomRolesConfig {
  roles: StoredRole[];
  /** merchant_users.id → StoredRole.id */
  assignments: Record<string, string>;
}

const EMPTY: CustomRolesConfig = { roles: [], assignments: {} };

function parse(value: unknown): CustomRolesConfig {
  const v = value as Partial<CustomRolesConfig> | null;
  if (!v || !Array.isArray(v.roles)) return EMPTY;
  return {
    roles: v.roles
      .filter(r => r && typeof r.id === 'string' && typeof r.name === 'string' && Array.isArray(r.permissions))
      .map(r => ({
        id: r.id,
        name: r.name,
        description: r.description ?? null,
        permissions: r.permissions.filter((k): k is string => typeof k === 'string'),
      })),
    assignments: v.assignments && typeof v.assignments === 'object' ? { ...v.assignments } : {},
  };
}

export async function loadCustomRolesConfig(merchantId: string): Promise<CustomRolesConfig> {
  const { data } = await supabase
    .from('activity_logs')
    .select('new_data')
    .eq('merchant_id', merchantId)
    .eq('entity_type', CUSTOM_ROLES_ENTITY)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return parse(data?.new_data);
}

export async function saveCustomRolesConfig(merchantId: string, config: CustomRolesConfig): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('activity_logs').insert({
    merchant_id: merchantId,
    user_id: user?.id ?? null,
    action: 'custom_roles_update',
    entity_type: CUSTOM_ROLES_ENTITY,
    new_data: config as never,
  });
  return error ? { error: error.message } : {};
}

/** The role a member holds in the store, if any. */
export function storedRoleFor(config: CustomRolesConfig, memberId: string): StoredRole | null {
  const roleId = config.assignments[memberId];
  return roleId ? config.roles.find(r => r.id === roleId) ?? null : null;
}
