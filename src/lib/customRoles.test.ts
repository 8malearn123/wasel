import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_ROLE_PERMISSIONS, CUSTOM_ROLE_FORBIDDEN } from './legacyRolePermissions';
import { firstOpenSection } from './sectionAccess';
import type { PermissionKey } from '@/hooks/usePermissions';

// Read from source, like navConsistency.test.ts: the pages and the sidebar pull
// in providers that would need Supabase to import.
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const MIGRATION = read('supabase/migrations/20261020100100_custom_roles.sql');
const SYSTEM_ROLES = ['owner', 'admin', 'branch_manager', 'inventory_manager', 'cashier'] as const;

/** legacy_role_permissions() as the migration writes it: role → keys */
function sqlLegacyMap(): Record<string, string[]> {
  const fn = MIGRATION.slice(MIGRATION.indexOf('FUNCTION public.legacy_role_permissions'));
  const body = fn.slice(0, fn.indexOf('$$;'));
  const map: Record<string, string[]> = {};
  for (const m of body.matchAll(/WHEN '([a-z_]+)' THEN ARRAY\[([\s\S]*?)\]/g)) {
    map[m[1]] = [...m[2].matchAll(/'([a-z_.]+)'/g)].map(k => k[1]);
  }
  return map;
}

describe('the role map in the app and in the database', () => {
  it.each(SYSTEM_ROLES)('%s holds the same permissions in both', (role) => {
    expect(new Set(LEGACY_ROLE_PERMISSIONS[role])).toEqual(new Set(sqlLegacyMap()[role]));
  });

  it('custom roles are refused the same permissions in both', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('FUNCTION public.custom_role_forbidden_permissions'));
    const sql = [...fn.slice(0, fn.indexOf('$$;')).matchAll(/'([a-z_.]+)'/g)].map(m => m[1]);
    expect(new Set(sql)).toEqual(CUSTOM_ROLE_FORBIDDEN);
  });

  it('a custom role can never manage roles or users, or hold the owner role', () => {
    for (const key of ['roles.manage', 'users.create', 'users.update', 'users.delete']) {
      expect(CUSTOM_ROLE_FORBIDDEN.has(key)).toBe(true);
    }
    expect(LEGACY_ROLE_PERMISSIONS.custom).toEqual([]);
  });

  it('roles.manage stays the owner’s alone', () => {
    const holders = SYSTEM_ROLES.filter(r => LEGACY_ROLE_PERMISSIONS[r].includes('roles.manage'));
    expect(holders).toEqual(['owner']);
  });
});

/** every leaf of a section page: its denyRoles and its permission */
function pageLeaves(path: string) {
  const src = read(path);
  return src.split(/\n\s*key: '/).slice(1).map(block => {
    const item = block.slice(0, block.indexOf('render:'));
    return {
      key: item.slice(0, item.indexOf("'")),
      deny: [...(item.match(/denyRoles: \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map(m => m[1]),
      permission: item.match(/permission: '([a-z_.]+)'/)?.[1],
    };
  });
}

const PAGES = [
  'src/pages/ProductsPage.tsx', 'src/pages/SalesPage.tsx', 'src/pages/TeamPage.tsx',
  'src/pages/SettingsPage.tsx', 'src/pages/OrganizationPage.tsx',
];

// Gating a screen on a permission must not take it from a system role that
// could open it before: whoever denyRoles let through must hold the key.
// employees.view gated its leaf before this change (an inventory manager has
// never had it), so it is not one of the gates being checked here.
const PREEXISTING_GATES = new Set(['employees.view']);
describe('system roles keep every screen they had', () => {
  it.each(PAGES)('%s', (page) => {
    const leaves = pageLeaves(page);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      if (!leaf.permission || PREEXISTING_GATES.has(leaf.permission)) continue;
      for (const role of SYSTEM_ROLES) {
        if (leaf.deny.includes(role)) continue;
        expect(LEGACY_ROLE_PERMISSIONS[role], `${page} ?tab=${leaf.key} for ${role}`).toContain(leaf.permission);
      }
    }
  });

  it('the sidebar', () => {
    const src = read('src/components/layout/Sidebar.tsx');
    const list = src.slice(src.indexOf('const navItems'), src.indexOf('export function Sidebar'));
    // one block per section; its own denyRoles come before `children:`
    for (const block of list.split(/\n {2}\{\n/).slice(1)) {
      const head = block.split('children:')[0];
      const sectionDeny = [...(head.match(/denyRoles: \[([^\]]*)\]/)?.[1] ?? '').matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
      const sectionPerm = head.match(/requirePermission: "([a-z_.]+)"/)?.[1];
      const entries = [
        { name: head.match(/path: "([^"]+)"/)?.[1], deny: [] as string[], permission: sectionPerm },
        ...[...block.matchAll(/\{ key: "([a-z0-9-]+)".*\}/g)].map(m => ({
          name: m[1],
          deny: [...(m[0].match(/denyRoles: \[([^\]]*)\]/)?.[1] ?? '').matchAll(/"([a-z_]+)"/g)].map(x => x[1]),
          permission: m[0].match(/requirePermission: "([a-z_.]+)"/)?.[1],
        })),
      ];
      for (const entry of entries) {
        if (!entry.permission || PREEXISTING_GATES.has(entry.permission)) continue;
        for (const role of SYSTEM_ROLES) {
          if (sectionDeny.includes(role) || entry.deny.includes(role)) continue;
          expect(LEGACY_ROLE_PERMISSIONS[role], `sidebar ${entry.name} for ${role}`).toContain(entry.permission);
        }
      }
    }
  });
});

describe('where "/" sends someone without the dashboard', () => {
  const holding = (...keys: string[]) => (k: PermissionKey) => keys.includes(k);
  const plan = (...features: string[]) => (f: string) => features.includes(f);

  it('an accountant lands on the reports', () => {
    expect(firstOpenSection(holding('reports.view', 'invoices.view'), plan('reports'))).toBe('/reports');
  });

  it('skips a section whose only screen the plan does not have', () => {
    expect(firstOpenSection(holding('online_orders.manage', 'reports.view'), plan())).toBe('/organization');
    expect(firstOpenSection(holding('online_orders.manage', 'reports.view'), plan('reports'))).toBe('/reports');
  });

  it('the till comes first for someone who may sell', () => {
    expect(firstOpenSection(holding('pos.access', 'closings.manage'), plan())).toBe('/pos');
  });

  it('nothing granted still leaves support', () => {
    expect(firstOpenSection(holding(), plan())).toBe('/organization');
  });
});
