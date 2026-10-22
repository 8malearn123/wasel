import { describe, it, expect, vi, beforeEach } from 'vitest';

// A database without the custom-roles migration: the RPCs are missing, roles
// live in activity_logs snapshots. A small in-memory stand-in for the tables
// the store touches.
type Row = Record<string, unknown>;
const db: { merchant_users: Row[]; activity_logs: Row[] } = { merchant_users: [], activity_logs: [] };

function query(table: keyof typeof db) {
  const filters: Array<(r: Row) => boolean> = [];
  let patch: Row | null = null;
  const api = {
    select: () => api,
    eq: (col: string, val: unknown) => { filters.push(r => r[col] === val); return api; },
    order: () => api,
    limit: () => api,
    update: (p: Row) => { patch = p; return api; },
    insert: async (row: Row) => { db[table].push({ ...row, created_at: String(db[table].length) }); return { error: null }; },
    maybeSingle: async () => {
      const rows = db[table].filter(r => filters.every(f => f(r)));
      // newest first, like the store's order by created_at desc
      return { data: rows[rows.length - 1] ?? null, error: null };
    },
    then: (resolve: (v: unknown) => void) => {
      const rows = db[table].filter(r => filters.every(f => f(r)));
      if (patch) rows.forEach(r => Object.assign(r, patch));
      resolve({ data: rows, error: null });
    },
  };
  return api;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: null, error: { message: 'Could not find the function in the schema cache' } })),
    from: (t: 'merchant_users' | 'activity_logs') => query(t),
    auth: { getUser: async () => ({ data: { user: { id: 'owner-user' } } }) },
  },
}));

import { assignCustomRole, assignSystemRole } from './useCustomRoles';
import { loadCustomRolesConfig, saveCustomRolesConfig, storedRoleFor } from '@/lib/customRolesStore';

const M = 'merchant-1';

describe('custom roles without the migration', () => {
  beforeEach(async () => {
    db.merchant_users = [
      { id: 'owner', merchant_id: M, role: 'owner', is_active: true },
      { id: 'cashier', merchant_id: M, role: 'cashier', is_active: true },
      { id: 'manager', merchant_id: M, role: 'branch_manager', is_active: true },
    ];
    db.activity_logs = [];
    await saveCustomRolesConfig(M, {
      roles: [{ id: 'acct', name: 'محاسب', description: null, permissions: ['reports.view', 'invoices.view'] }],
      assignments: {},
    });
  });

  it('gives a member the role and keeps them a cashier in the database', async () => {
    expect(await assignCustomRole('manager', 'acct')).toEqual({});
    expect(db.merchant_users.find(m => m.id === 'manager')!.role).toBe('cashier');
    const config = await loadCustomRolesConfig(M);
    expect(storedRoleFor(config, 'manager')?.name).toBe('محاسب');
  });

  it('never touches the owner', async () => {
    expect((await assignCustomRole('owner', 'acct')).error).toBeTruthy();
    expect(db.merchant_users.find(m => m.id === 'owner')!.role).toBe('owner');
  });

  it('refuses a role that does not exist', async () => {
    expect((await assignCustomRole('cashier', 'nope')).error).toBeTruthy();
  });

  it('moving back to a system role drops the custom one', async () => {
    await assignCustomRole('cashier', 'acct');
    expect(await assignSystemRole('cashier', 'inventory_manager')).toEqual({});
    expect(db.merchant_users.find(m => m.id === 'cashier')!.role).toBe('inventory_manager');
    expect(storedRoleFor(await loadCustomRolesConfig(M), 'cashier')).toBeNull();
  });

  it('cannot make anyone owner', async () => {
    expect((await assignSystemRole('cashier', 'owner')).error).toBeTruthy();
  });

  it('a stored role never carries what custom roles may not hold', async () => {
    await saveCustomRolesConfig(M, {
      roles: [{ id: 'x', name: 'x', description: null, permissions: ['reports.view', 'roles.manage'] }],
      assignments: { cashier: 'x' },
    });
    // usePermissions filters CUSTOM_ROLE_FORBIDDEN out of a stored role's list
    const { CUSTOM_ROLE_FORBIDDEN } = await import('@/lib/legacyRolePermissions');
    const role = storedRoleFor(await loadCustomRolesConfig(M), 'cashier')!;
    expect(role.permissions.filter(k => !CUSTOM_ROLE_FORBIDDEN.has(k))).toEqual(['reports.view']);
  });

  it("assigning a role keeps the shop's changes to the system roles", async () => {
    const before = await loadCustomRolesConfig(M);
    await saveCustomRolesConfig(M, { ...before, systemRoles: { cashier: ['pos.access', 'reports.view'] } });
    expect(await assignCustomRole('cashier', 'acct')).toEqual({});
    const after = await loadCustomRolesConfig(M);
    expect(after.systemRoles).toEqual({ cashier: ['pos.access', 'reports.view'] });
    expect(after.assignments).toEqual({ cashier: 'acct' });
  });

  it('reads back no system-role changes when there are none, and drops unknown roles', async () => {
    expect((await loadCustomRolesConfig(M)).systemRoles).toEqual({});
    const config = await loadCustomRolesConfig(M);
    await saveCustomRolesConfig(M, { ...config, systemRoles: { cashier: ['pos.access'], admin: ['x'] } as never });
    expect((await loadCustomRolesConfig(M)).systemRoles).toEqual({ cashier: ['pos.access'] });
  });
});
