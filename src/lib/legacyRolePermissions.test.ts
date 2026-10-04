import { describe, it, expect } from 'vitest';
import { LEGACY_ROLE_PERMISSIONS, permissionsForLegacyRole } from './legacyRolePermissions';

// This table has a twin in SQL — legacy_role_permissions() in
// 20261004100200_rbac.sql. If they drift, the UI stops matching the server.
describe('permissionsForLegacyRole', () => {
  it('lets an owner manage the catalogue', () => {
    const owner = permissionsForLegacyRole('owner');
    for (const key of ['products.create', 'products.delete', 'products.media.upload', 'roles.manage']) {
      expect(owner).toContain(key);
    }
  });

  it('keeps a cashier out of the catalogue', () => {
    expect(permissionsForLegacyRole('cashier')).toEqual(['products.view']);
  });

  it('gives an admin everything an owner has except managing roles', () => {
    const owner = new Set(LEGACY_ROLE_PERMISSIONS.owner);
    const admin = new Set(LEGACY_ROLE_PERMISSIONS.admin);
    const missing = [...owner].filter(k => !admin.has(k));
    expect(missing).toEqual(['roles.manage']);
  });

  it('lets an inventory manager run products but not people', () => {
    const inv = permissionsForLegacyRole('inventory_manager');
    expect(inv).toContain('products.create');
    expect(inv).toContain('categories.manage');
    expect(inv).not.toContain('employees.view');
    expect(inv).not.toContain('users.create');
  });

  // The regression this file exists to prevent: with the migration unapplied
  // the owner must still see the add and delete controls, because the database
  // still allows both.
  it('never leaves a signed-in role with nothing', () => {
    for (const role of ['owner', 'admin', 'inventory_manager', 'branch_manager', 'cashier'] as const) {
      expect(permissionsForLegacyRole(role).length).toBeGreaterThan(0);
    }
  });

  it('gives an unknown or missing role nothing', () => {
    expect(permissionsForLegacyRole(null)).toEqual([]);
    expect(permissionsForLegacyRole(undefined)).toEqual([]);
    expect(permissionsForLegacyRole('wizard' as never)).toEqual([]);
  });
});
