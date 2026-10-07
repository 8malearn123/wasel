import { Suspense, type ElementType, type ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { SectionNav } from './SectionNav';
import { LoadingState, PermissionDeniedState } from '@/components/common/StateViews';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { usePermissions, type PermissionKey } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { leafVisible, resolveLeaf } from '@/lib/sectionRouting';
import type { FeatureKey } from '@/lib/planAccess';
import type { UserRole } from '@/types/database';

export interface SectionLeaf {
  key: string;
  /** nav label, already in the active language */
  label: string;
  icon: ElementType;
  /** page header, which follows the leaf so the header never goes vague */
  title: string;
  subtitle?: string;
  /** plan feature this leaf needs — the gate its own route used to carry */
  feature?: FeatureKey;
  /** permission this leaf needs */
  permission?: PermissionKey;
  /** roles on merchant_users that may NOT open this leaf (the old CashierRedirect) */
  denyRoles?: UserRole[];
  render: () => ReactNode;
}

export interface SectionGroup {
  label?: string;
  items: SectionLeaf[];
}

function Spinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

/**
 * A consolidated section page: one route, one header, one sub-navigation, and
 * only the active leaf mounted.
 *
 * The per-leaf gates are the same ones the separate routes carried before the
 * consolidation — FeatureRoute, PermissionRoute and the cashier redirect moved
 * from the route into the leaf, because one route now serves several of them.
 * As before, none of this is a security boundary: RLS is, and it is unchanged.
 */
export function SectionShell({
  groups,
  defaultLeaf,
  fallbackPath = '/',
  legacyTabs,
}: {
  groups: SectionGroup[];
  defaultLeaf: string;
  /** where to send a user who may open nothing here at all */
  fallbackPath?: string;
  /**
   * Inner tabs this page answered on ?tab= before it became a section, mapped
   * to where they live now. Only a section that kept its old path needs this —
   * every other old path is redirected in App.tsx.
   */
  legacyTabs?: Record<string, { leaf: string; sub?: string }>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { allows, loading: plansLoading } = useFeatureAccess();
  const { can, loading: permsLoading } = usePermissions();
  const { merchantUser, loading: authLoading } = useAuth();

  const all = groups.flatMap(g => g.items);
  const ctx = {
    role: merchantUser?.role as UserRole | undefined,
    allows,
    can,
    settling: plansLoading || permsLoading || authLoading,
  };

  const visibleGroups = groups
    .map(g => ({ ...g, items: g.items.filter(l => leafVisible(l, ctx)) }))
    .filter(g => g.items.length > 0);

  const named = searchParams.get('tab');
  const legacy = named && !all.some(l => l.key === named) ? legacyTabs?.[named] : undefined;
  const outcome = resolveLeaf(all, named, defaultLeaf, ctx);

  const setLeaf = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    // The leaf owns ?sub=, so it must not inherit the one before it
    next.delete('sub');
    setSearchParams(next, { replace: true });
  };

  // A bookmark from before the consolidation, on a path that did not move
  if (legacy) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', legacy.leaf);
    if (legacy.sub) next.set('sub', legacy.sub);
    else next.delete('sub');
    return <Navigate to={`?${next.toString()}`} replace />;
  }

  if (ctx.settling) {
    return <AppLayout title=""><Spinner /></AppLayout>;
  }

  // A plan feature keeps the contract its route had: the upsell page, not a
  // dead end. Typing the URL was never what stopped anyone — RLS is.
  if (outcome.kind === 'upsell') {
    return <Navigate to="/subscription" replace />;
  }

  // Nothing here is open to this user — the old per-route redirect.
  if (outcome.kind === 'empty') {
    return <Navigate to={fallbackPath} replace />;
  }

  const shown = outcome.kind === 'denied' ? outcome.fallback : outcome.leaf;

  return (
    <AppLayout title={shown.title} subtitle={shown.subtitle}>
      <SectionNav groups={visibleGroups} value={shown.key} onChange={setLeaf} />
      {/* Asked for a leaf they may not open: say so in place, instead of
          bouncing them out of a section they can otherwise use. */}
      {outcome.kind === 'denied'
        ? <PermissionDeniedState permission={outcome.leaf.permission} />
        : <Suspense fallback={<LoadingState />}>{shown.render()}</Suspense>}
    </AppLayout>
  );
}
