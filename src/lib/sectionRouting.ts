import type { FeatureKey } from '@/lib/planAccess';
import type { PermissionKey } from '@/hooks/usePermissions';
import type { UserRole } from '@/types/database';

/** The access rules a section leaf carries, which its own route used to carry. */
export interface LeafGate {
  key: string;
  feature?: FeatureKey;
  permission?: PermissionKey;
  /** roles that may NOT open this leaf — the old CashierRedirect, generalised */
  denyRoles?: UserRole[];
}

export interface GateContext {
  role?: UserRole;
  allows: (feature: FeatureKey) => boolean;
  can: (permission: PermissionKey) => boolean;
  /** plan and permission data still in flight */
  settling?: boolean;
}

export function leafVisible(leaf: LeafGate, ctx: GateContext): boolean {
  // A role is known as soon as the session is, so it filters even while
  // the plan and permission tables are still loading.
  if (leaf.denyRoles && ctx.role && leaf.denyRoles.includes(ctx.role)) return false;
  // While they load nothing else is hidden, so the navigation does not shuffle
  // a moment after it paints.
  if (ctx.settling) return true;
  if (leaf.feature && !ctx.allows(leaf.feature)) return false;
  if (leaf.permission && !ctx.can(leaf.permission)) return false;
  return true;
}

export type LeafOutcome<L extends LeafGate> =
  /** show this leaf */
  | { kind: 'show'; leaf: L }
  /** the url named a leaf whose plan feature this shop does not have */
  | { kind: 'upsell'; leaf: L }
  /** the url named a leaf this user may not open, but the section is usable */
  | { kind: 'denied'; leaf: L; fallback: L }
  /** nothing in this section is open to this user */
  | { kind: 'empty' };

/**
 * Which leaf a section page shows, given the url and who is asking.
 *
 * Only a leaf named in the url counts as a request: arriving at a section with
 * no ?tab= must never read as "you asked for something you may not open", or a
 * cashier opening /sales would be told off instead of shown the daily closing.
 */
export function resolveLeaf<L extends LeafGate>(
  leaves: L[],
  named: string | null,
  defaultLeaf: string,
  ctx: GateContext,
): LeafOutcome<L> {
  const asked = named ? leaves.find(l => l.key === named) : undefined;

  if (asked && asked.feature && !ctx.settling && !ctx.allows(asked.feature)) {
    return { kind: 'upsell', leaf: asked };
  }
  if (asked && leafVisible(asked, ctx)) {
    return { kind: 'show', leaf: asked };
  }

  const open = leaves.filter(l => leafVisible(l, ctx));
  const preferred = open.find(l => l.key === defaultLeaf) ?? open[0];
  if (!preferred) return { kind: 'empty' };

  return asked
    ? { kind: 'denied', leaf: asked, fallback: preferred }
    : { kind: 'show', leaf: preferred };
}
