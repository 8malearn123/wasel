import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveLeaf, leafVisible, type LeafGate, type GateContext } from './sectionRouting';
import { firstOpenSection, sectionPermitted } from './sectionAccess';
import { LEGACY_ROLE_PERMISSIONS, CUSTOM_ROLE_FORBIDDEN } from './legacyRolePermissions';
import { CUSTOM_ROLE_CATALOG } from './permissionCatalog';
import type { FeatureKey } from './planAccess';
import type { PermissionKey } from '@/hooks/usePermissions';
import type { UserRole } from '@/types/database';

/**
 * Every role × every plan, walked through the app's own routing: where "/"
 * lands, whether each section the sidebar and the sections menu offer really
 * opens, and that nothing redirects in a circle.
 *
 * The leaf gates and the sidebar entries are read from source (the pages pull
 * in providers that need Supabase); the decisions use the real resolveLeaf,
 * leafVisible, firstOpenSection and sectionPermitted. The route guards in
 * App.tsx are mirrored in `land` below.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const words = (s = '', q = "'") => [...s.matchAll(new RegExp(`${q}([a-zA-Z_.]+)${q}`, 'g'))].map(m => m[1]);

interface Section { leaves: LeafGate[]; defaultLeaf: string; fallback: string }

function sectionFrom(file: string): Section {
  const src = read(file);
  const leaves = src.split(/\n\s*key: '/).slice(1).map(block => {
    const item = block.slice(0, block.indexOf('render:'));
    return {
      key: item.slice(0, item.indexOf("'")),
      denyRoles: words(item.match(/denyRoles: \[([^\]]*)\]/)?.[1]) as UserRole[],
      permission: item.match(/permission: '([a-z_.]+)'/)?.[1] as PermissionKey | undefined,
      feature: item.match(/feature: '([a-zA-Z]+)'/)?.[1] as FeatureKey | undefined,
    };
  });
  return {
    leaves,
    defaultLeaf: src.match(/defaultLeaf="([a-z-]+)"/)![1],
    fallback: src.match(/fallbackPath="([^"]+)"/)![1],
  };
}

const SECTIONS: Record<string, Section> = {
  '/products': sectionFrom('src/pages/ProductsPage.tsx'),
  '/sales': sectionFrom('src/pages/SalesPage.tsx'),
  '/team': sectionFrom('src/pages/TeamPage.tsx'),
  '/settings': sectionFrom('src/pages/SettingsPage.tsx'),
  '/organization': sectionFrom('src/pages/OrganizationPage.tsx'),
};

interface Gate { feature?: FeatureKey; permission?: PermissionKey; deny: string[] }
/** the sidebar's sections: their own gate, and their children's */
const SIDEBAR = (() => {
  const src = read('src/components/layout/Sidebar.tsx');
  const list = src.slice(src.indexOf('const navItems'), src.indexOf('export function Sidebar'));
  const gateOf = (s: string): Gate => ({
    feature: s.match(/requireFeature: "([a-zA-Z]+)"/)?.[1] as FeatureKey | undefined,
    permission: s.match(/requirePermission: "([a-z_.]+)"/)?.[1] as PermissionKey | undefined,
    deny: words(s.match(/denyRoles: \[([^\]]*)\]/)?.[1], '"'),
  });
  return list.split(/\n {2}\{\n/).slice(1).map(block => {
    const head = block.split('children:')[0];
    return {
      path: head.match(/path: "([^"]+)"/)![1],
      gate: gateOf(head),
      children: [...block.matchAll(/\{ key: "[a-z0-9-]+".*\}/g)].map(m => gateOf(m[0])),
    };
  });
})();

interface Who { role: UserRole; perms: Set<string>; features: Set<string> }
const ctxOf = (w: Who): GateContext => ({
  role: w.role,
  can: (k) => w.perms.has(k),
  allows: (f) => w.features.has(f),
});

function sidebarOffers(w: Who): string[] {
  const ok = (g: Gate) => !g.deny.includes(w.role)
    && (!g.feature || w.features.has(g.feature))
    && (!g.permission || w.perms.has(g.permission));
  const pos = w.perms.has('pos.access') ? ['/pos'] : [];
  return [...pos, ...SIDEBAR.filter(s => ok(s.gate) && (s.children.length === 0 || s.children.some(ok))).map(s => s.path)];
}

/** Header's sections menu for a custom role (system roles keep the full list) */
function menuOffers(w: Who): string[] {
  const all = ['/', '/pos', '/products', '/sales', '/shipping', '/reports', '/team', '/ai-insights', '/settings', '/organization'];
  return all.filter(p => sectionPermitted(p, k => w.perms.has(k), f => w.features.has(f)));
}

/** Follow App.tsx's guards from a path until a page renders; null on a loop. */
function land(path: string, w: Who): string | null {
  const ctx = ctxOf(w);
  const can = (k: string) => w.perms.has(k);
  const cashier = w.role === 'cashier';
  for (let hops = 0; hops < 12; hops++) {
    let next: string | null = null;
    switch (path) {
      case '/':
        next = cashier ? '/pos' : can('dashboard.view') ? null : firstOpenSection(can as never, f => w.features.has(f));
        break;
      case '/pos':
        next = can('pos.access') ? null : '/';
        break;
      case '/reports':
        next = !w.features.has('reports') ? '/subscription'
          : cashier ? '/pos'
          : can('reports.view') || can('invoices.view') ? null : '/';
        break;
      case '/shipping':
        next = cashier ? '/pos' : can('shipping.manage') ? null : '/';
        break;
      case '/ai-insights':
        next = cashier ? '/pos' : can('ai_insights.view') ? null : '/';
        break;
      case '/subscription':
        next = ['owner', 'admin'].includes(w.role) && !cashier ? null : '/';
        break;
      default: {
        const s = SECTIONS[path];
        const outcome = resolveLeaf(s.leaves, null, s.defaultLeaf, ctx);
        next = outcome.kind === 'empty' ? s.fallback : null;
      }
    }
    if (next === null) return path;
    path = next;
  }
  return null;
}

const FEATURES: FeatureKey[] = ['onlineStore', 'wholesale', 'repairs', 'suppliers', 'marketing', 'stocktake', 'customers', 'reports', 'transfers'];
const PLANS: Record<string, Set<string>> = {
  'all features': new Set(FEATURES),
  'no features': new Set(),
  'reports only': new Set(['reports']),
  'online store only': new Set(['onlineStore']),
};

function check(w: Who, label: string) {
  const home = land('/', w);
  expect(home, `${label}: "/" goes round in a circle`).not.toBeNull();

  const opens = (p: string) => land(p, w) === p;
  for (const p of sidebarOffers(w)) {
    expect(opens(p), `${label}: sidebar offers ${p}, which lands on ${land(p, w)}`).toBe(true);
  }
  if (w.role === 'custom') {
    for (const p of menuOffers(w)) {
      expect(land(p, w), `${label}: sections menu offers ${p}, which lands on ${land(p, w)}`).toBe(p);
    }
  }
  for (const p of ['/pos', '/reports', '/shipping', '/ai-insights', '/subscription', ...Object.keys(SECTIONS)]) {
    expect(land(p, w), `${label}: ${p} goes round in a circle`).not.toBeNull();
    // a section that opens must be reachable from the sidebar
    if (opens(p) && p !== '/subscription') {
      expect(sidebarOffers(w), `${label}: ${p} opens but the sidebar hides it`).toContain(p);
    }
  }
}

describe('system roles on every plan', () => {
  const roles: UserRole[] = ['owner', 'admin', 'branch_manager', 'inventory_manager', 'cashier'];
  for (const role of roles) {
    for (const [plan, features] of Object.entries(PLANS)) {
      it(`${role}, ${plan}`, () => {
        check({ role, perms: new Set(LEGACY_ROLE_PERMISSIONS[role]), features }, `${role}/${plan}`);
      });
    }
  }

  it('a cashier lands on the till and never on the dashboard', () => {
    const w = { role: 'cashier' as UserRole, perms: new Set(LEGACY_ROLE_PERMISSIONS.cashier), features: PLANS['all features'] };
    expect(land('/', w)).toBe('/pos');
    for (const p of ['/reports', '/shipping', '/ai-insights', '/subscription']) expect(land(p, w)).not.toBe(p);
  });
});

describe('custom roles: every permission alone and every pair, on every plan', () => {
  const keys = CUSTOM_ROLE_CATALOG.map(p => p.key);
  const combos: string[][] = [[]];
  keys.forEach((a, i) => { combos.push([a]); keys.slice(i + 1).forEach(b => combos.push([a, b])); });

  for (const [plan, features] of Object.entries(PLANS)) {
    it(`${combos.length} roles, ${plan}`, () => {
      for (const perms of combos) {
        check({ role: 'custom', perms: new Set(perms), features }, `custom [${perms.join(', ')}] / ${plan}`);
      }
    });
  }

  it('a custom role never sees the owner/admin screens, whatever it was given', () => {
    // even a forged list: usePermissions strips the forbidden keys first
    const forged = [...CUSTOM_ROLE_FORBIDDEN].filter(k => !CUSTOM_ROLE_FORBIDDEN.has(k));
    const w = { role: 'custom' as UserRole, perms: new Set(forged), features: PLANS['all features'] };
    expect(land('/subscription', w)).not.toBe('/subscription');
    const team = resolveLeaf(SECTIONS['/team'].leaves, 'users', 'employees', ctxOf(w));
    expect(team.kind === 'show' && team.leaf.key === 'users').toBe(false);
    const settings = SECTIONS['/settings'].leaves.filter(l => leafVisible(l, ctxOf(w)));
    expect(settings).toEqual([]);
  });

  it('an accountant opens the reports, the closings and suppliers — and nothing else', () => {
    const w = {
      role: 'custom' as UserRole,
      perms: new Set(['reports.view', 'invoices.view', 'closings.manage', 'suppliers.manage']),
      features: PLANS['all features'],
    };
    expect(land('/', w)).toBe('/products');
    expect(sidebarOffers(w).sort()).toEqual(['/organization', '/products', '/reports', '/sales']);
    expect(SECTIONS['/products'].leaves.filter(l => leafVisible(l, ctxOf(w))).map(l => l.key)).toEqual(['suppliers']);
    expect(SECTIONS['/sales'].leaves.filter(l => leafVisible(l, ctxOf(w))).map(l => l.key)).toEqual(['closings']);
    for (const p of ['/pos', '/shipping', '/ai-insights', '/subscription', '/team', '/settings']) {
      expect(land(p, w), p).not.toBe(p);
    }
  });
});
