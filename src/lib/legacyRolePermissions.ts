import type { UserRole } from '@/types/database';

/**
 * What each merchant_users.role implies, mirroring legacy_role_permissions()
 * in 20261020100100_custom_roles.sql (first written in 20261004100200_rbac.sql).
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
 * The screen permissions (dashboard.view … subscription.manage) are exactly
 * what each role's screens already opened to it through denyRoles, so gating
 * a screen on its permission does not move anyone with a system role.
 *
 * KEEP THE TWO IN SYNC. If you change one, change the other.
 * ──────────────────────────────────────────────────────────────────────────
 */

// Every screen the shop's operations run on — the system roles' share of them
const OPERATIONS = [
  'dashboard.view', 'pos.access', 'invoices.view', 'reports.view', 'closings.manage',
  'suppliers.manage', 'repairs.manage', 'online_orders.manage', 'store.manage',
  'customers.manage', 'marketing.manage', 'wholesale.manage', 'stocktake.manage',
  'transfers.manage', 'shipping.manage', 'ai_insights.view', 'attendance.manage',
  'branches.manage', 'settings.manage',
];

export const LEGACY_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: [
    'products.view', 'products.create', 'products.update', 'products.delete',
    'products.media.upload', 'products.media.delete', 'categories.manage',
    'employees.view', 'employees.create', 'employees.update', 'employees.delete',
    'users.view', 'users.create', 'users.update', 'users.delete',
    'roles.view', 'roles.manage',
    ...OPERATIONS, 'payroll.manage', 'policy.manage', 'subscription.manage',
  ],
  admin: [
    'products.view', 'products.create', 'products.update', 'products.delete',
    'products.media.upload', 'products.media.delete', 'categories.manage',
    'employees.view', 'employees.create', 'employees.update', 'employees.delete',
    'users.view', 'users.create', 'users.update', 'users.delete',
    // the admin runs the shop with the owner: roles and permissions included
    'roles.view', 'roles.manage',
    ...OPERATIONS, 'payroll.manage', 'policy.manage', 'subscription.manage',
  ],
  inventory_manager: [
    'products.view', 'products.create', 'products.update', 'products.delete',
    'products.media.upload', 'products.media.delete', 'categories.manage',
    ...OPERATIONS,
  ],
  branch_manager: [
    'products.view', 'products.create', 'products.update',
    'products.media.upload', 'products.media.delete', 'employees.view',
    ...OPERATIONS,
  ],
  // a cashier sells, takes repairs and closes the day
  cashier: ['products.view', 'pos.access', 'repairs.manage', 'closings.manage'],
  // a custom role implies nothing: its own permission rows decide
  custom: [],
};

/**
 * What a role the shop makes may never hold — custom_role_forbidden_permissions()
 * in the migration, where it is enforced on role_permissions itself. Managing
 * users and roles, billing, the shop's settings and its branches stay with the
 * system roles.
 */
export const CUSTOM_ROLE_FORBIDDEN = new Set([
  'roles.view', 'roles.manage',
  'users.view', 'users.create', 'users.update', 'users.delete',
  'subscription.manage', 'settings.manage', 'policy.manage', 'branches.manage',
]);

export function permissionsForLegacyRole(role?: UserRole | null): string[] {
  if (!role) return [];
  return LEGACY_ROLE_PERMISSIONS[role] ?? [];
}
