import type { UserRole } from '@/types/database';

/**
 * What each merchant_users.role implies, mirroring legacy_role_permissions()
 * in 20261004100200_rbac.sql.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS IN TYPESCRIPT TOO
 *
 * usePermissions asks my_permissions(). Until the Phase 1 migration is applied
 * that function does not exist, and returning an empty list there hid the "add
 * product" and "delete product" controls from everyone, owners included —
 * while the database, still on its old FOR ALL policy, happily allowed both.
 * The UI was stricter than the server, which is the one direction that is
 * never a security win: it protected nothing and broke the catalogue screens.
 *
 * So when the RPC is unavailable the UI falls back to this table, which is the
 * same answer the database gives for an account with no explicit role rows.
 * The UI then matches what the server permits in BOTH states:
 *   • migration not applied → old policies, legacy role → this table
 *   • migration applied     → has_permission(), which unions the assigned
 *                             roles with exactly this same mapping
 *
 * KEEP THE TWO IN SYNC. If you change one, change the other.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const LEGACY_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: [
    'products.view', 'products.create', 'products.update', 'products.delete',
    'products.media.upload', 'products.media.delete', 'categories.manage',
    'employees.view', 'employees.create', 'employees.update', 'employees.delete',
    'users.view', 'users.create', 'users.update', 'users.delete',
    'roles.view', 'roles.manage',
  ],
  admin: [
    'products.view', 'products.create', 'products.update', 'products.delete',
    'products.media.upload', 'products.media.delete', 'categories.manage',
    'employees.view', 'employees.create', 'employees.update', 'employees.delete',
    'users.view', 'users.create', 'users.update', 'users.delete',
    'roles.view',
  ],
  inventory_manager: [
    'products.view', 'products.create', 'products.update', 'products.delete',
    'products.media.upload', 'products.media.delete', 'categories.manage',
  ],
  branch_manager: [
    'products.view', 'products.create', 'products.update',
    'products.media.upload', 'products.media.delete', 'employees.view',
  ],
  // a cashier sells; they do not edit the catalogue
  cashier: ['products.view'],
};

export function permissionsForLegacyRole(role?: UserRole | null): string[] {
  if (!role) return [];
  return LEGACY_ROLE_PERMISSIONS[role] ?? [];
}
