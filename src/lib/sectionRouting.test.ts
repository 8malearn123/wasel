import { describe, it, expect } from 'vitest';
import { leafVisible, resolveLeaf, type GateContext, type LeafGate } from './sectionRouting';

// The four section registries as the pages declare them. Kept here as gates
// only: this asserts who may open what, not how it looks.
const PRODUCTS: LeafGate[] = [
  { key: 'inventory', denyRoles: ['cashier'] },
  { key: 'stocktake', feature: 'stocktake', denyRoles: ['cashier'] },
  { key: 'transfers', feature: 'transfers', denyRoles: ['cashier'] },
  { key: 'suppliers', feature: 'suppliers', denyRoles: ['cashier'] },
  { key: 'labels', denyRoles: ['cashier'] },
];

const SALES: LeafGate[] = [
  { key: 'orders', feature: 'onlineStore', denyRoles: ['cashier'] },
  { key: 'repairs', feature: 'repairs' },
  { key: 'closings' },
  { key: 'store', feature: 'onlineStore', denyRoles: ['cashier'] },
  { key: 'seo', feature: 'onlineStore', denyRoles: ['cashier'] },
  { key: 'customers', feature: 'customers', denyRoles: ['cashier'] },
  { key: 'marketing', feature: 'marketing', denyRoles: ['cashier'] },
  { key: 'wholesale', denyRoles: ['cashier'] },
];

const TEAM: LeafGate[] = [
  { key: 'employees', permission: 'employees.view', denyRoles: ['cashier'] },
  { key: 'attendance', denyRoles: ['cashier'] },
  { key: 'devices', denyRoles: ['cashier'] },
  { key: 'payroll', denyRoles: ['cashier', 'branch_manager', 'inventory_manager'] },
  { key: 'users', denyRoles: ['cashier', 'branch_manager', 'inventory_manager'] },
];

const ctx = (over: Partial<GateContext> = {}): GateContext => ({
  role: 'owner',
  allows: () => true,
  can: () => true,
  ...over,
});

describe('leafVisible', () => {
  it('hides a leaf the role is denied', () => {
    expect(leafVisible({ key: 'x', denyRoles: ['cashier'] }, ctx({ role: 'cashier' }))).toBe(false);
    expect(leafVisible({ key: 'x', denyRoles: ['cashier'] }, ctx({ role: 'owner' }))).toBe(true);
  });

  it('hides a leaf the plan does not include', () => {
    expect(leafVisible({ key: 'x', feature: 'repairs' }, ctx({ allows: () => false }))).toBe(false);
  });

  it('hides a leaf the permission is missing for', () => {
    expect(leafVisible({ key: 'x', permission: 'employees.view' }, ctx({ can: () => false }))).toBe(false);
  });

  it('hides nothing on plan or permission while they are still loading', () => {
    const loading = ctx({ settling: true, allows: () => false, can: () => false });
    expect(leafVisible({ key: 'x', feature: 'repairs' }, loading)).toBe(true);
    expect(leafVisible({ key: 'x', permission: 'employees.view' }, loading)).toBe(true);
  });

  it('still hides a role-denied leaf while they load, since the role is known', () => {
    expect(leafVisible({ key: 'x', denyRoles: ['cashier'] }, ctx({ role: 'cashier', settling: true })))
      .toBe(false);
  });
});

describe('resolveLeaf', () => {
  it('shows the section default when the url names no tab', () => {
    const out = resolveLeaf(PRODUCTS, null, 'inventory', ctx());
    expect(out).toEqual({ kind: 'show', leaf: PRODUCTS[0] });
  });

  it('shows the tab the url names', () => {
    const out = resolveLeaf(PRODUCTS, 'labels', 'inventory', ctx());
    expect(out.kind).toBe('show');
    expect(out.kind === 'show' && out.leaf.key).toBe('labels');
  });

  it('falls back to the default when the url names nothing real', () => {
    const out = resolveLeaf(PRODUCTS, 'does-not-exist', 'inventory', ctx());
    expect(out.kind).toBe('show');
    expect(out.kind === 'show' && out.leaf.key).toBe('inventory');
  });

  it('sends a url-named leaf the plan lacks to the upsell page', () => {
    const noStocktake = ctx({ allows: f => f !== 'stocktake' });
    const out = resolveLeaf(PRODUCTS, 'stocktake', 'inventory', noStocktake);
    expect(out.kind).toBe('upsell');
  });

  it('does not upsell for a plan-gated default nobody asked for', () => {
    // A shop without the suppliers feature landing on /products plainly
    const noSuppliers = ctx({ allows: f => f !== 'suppliers' });
    const out = resolveLeaf(PRODUCTS, null, 'suppliers', noSuppliers);
    expect(out.kind).toBe('show');
    expect(out.kind === 'show' && out.leaf.key).toBe('inventory');
  });

  it('leaves a cashier nothing to open under المنتجات', () => {
    expect(resolveLeaf(PRODUCTS, null, 'inventory', ctx({ role: 'cashier' })).kind).toBe('empty');
  });

  it('keeps a cashier the two sales leaves they always had', () => {
    const cashier = ctx({ role: 'cashier' });
    // Daily closings and repairs carried no cashier redirect before the merge
    const open = SALES.filter(l => leafVisible(l, cashier)).map(l => l.key);
    expect(open).toEqual(['repairs', 'closings']);
  });

  it('shows a cashier a usable leaf rather than scolding them for the default', () => {
    // /sales defaults to online orders, which a cashier may not open
    const out = resolveLeaf(SALES, null, 'orders', ctx({ role: 'cashier' }));
    expect(out.kind).toBe('show');
    expect(out.kind === 'show' && out.leaf.key).toBe('repairs');
  });

  it('says so in place when the url names a leaf the user may not open', () => {
    const out = resolveLeaf(TEAM, 'users', 'employees', ctx({ role: 'branch_manager' }));
    expect(out.kind).toBe('denied');
    expect(out.kind === 'denied' && out.fallback.key).toBe('employees');
  });

  it('denies the employees leaf without the permission, and keeps the rest', () => {
    const out = resolveLeaf(TEAM, 'employees', 'employees', ctx({ can: () => false }));
    expect(out.kind).toBe('denied');
    expect(out.kind === 'denied' && out.fallback.key).toBe('attendance');
  });

  it('settles on the asked-for leaf while the gates still load', () => {
    const out = resolveLeaf(TEAM, 'users', 'employees', ctx({ settling: true, can: () => false }));
    expect(out.kind).toBe('show');
    expect(out.kind === 'show' && out.leaf.key).toBe('users');
  });
});
