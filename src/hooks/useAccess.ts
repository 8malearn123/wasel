import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { usePermissions, type PermissionKey } from './usePermissions';
import { useFeatureAccess } from './useFeatureAccess';
import { useSubscription } from './useSubscription';
import { useCurrentPlan } from './useCurrentPlan';
import type { FeatureKey } from '@/lib/planAccess';

/**
 * Everything the screens need to decide what to show, from one place:
 * the member's permissions, the plan's features and limits, and the
 * subscription. When the backend serves these (my_permissions(),
 * get_subscription_state(), plan limits), this is the one hook that changes.
 *
 * It decides what to SHOW. The server decides what is allowed: hiding a
 * button protects nothing by itself.
 *
 * status:
 *   loading  — still being read; guards wait, nothing is hidden or shown yet
 *   ready    — everything came from the server
 *   degraded — the server functions are not installed (404): the role map and
 *              the subscription row stand in for them
 *   error    — the member's data or permissions could not be read; nothing
 *              beyond the role's base map is granted
 */
export type AccessStatus = 'loading' | 'ready' | 'degraded' | 'error';

export interface AccessRequirement {
  permission?: PermissionKey;
  /** any one of these is enough */
  anyOf?: PermissionKey[];
  feature?: FeatureKey;
}

export interface AccessDecision {
  allowed: boolean;
  /** why not, when not allowed */
  reason?: 'loading' | 'permission' | 'plan' | 'locked';
}

export function useAccess() {
  const { memberLoading, memberError } = useAuth();
  const { can, canAny, loading: permissionsLoading, source } = usePermissions();
  const { allows, loading: planLoading } = useFeatureAccess();
  const { isLocked, state, daysRemaining, subscription } = useSubscription();
  const plan = useCurrentPlan();
  const { branches } = useAuth();

  const status: AccessStatus =
    memberError ? 'error'
    : memberLoading || permissionsLoading || planLoading ? 'loading'
    : source === 'failed' ? 'error'
    : source === 'role-map' || !state ? 'degraded'
    : 'ready';

  const limits = useMemo(() => {
    const active = branches.filter(b => b.is_active !== false).length;
    const limit = plan.branchLimit;
    const unlimited = limit >= 9999;
    return {
      branches: {
        active,
        limit,
        unlimited,
        canAdd: unlimited || active < limit,
        /** more active than the plan allows — the server should not have let it happen */
        over: !unlimited && active > limit,
      },
      users: { limit: plan.userLimit },
    };
  }, [branches, plan.branchLimit, plan.userLimit]);

  const decide = useCallback((req: AccessRequirement): AccessDecision => {
    if (status === 'loading') return { allowed: false, reason: 'loading' };
    if (isLocked) return { allowed: false, reason: 'locked' };
    if (req.feature && !allows(req.feature)) return { allowed: false, reason: 'plan' };
    if (req.permission && !can(req.permission)) return { allowed: false, reason: 'permission' };
    if (req.anyOf && !canAny(...req.anyOf)) return { allowed: false, reason: 'permission' };
    return { allowed: true };
  }, [status, isLocked, allows, can, canAny]);

  return {
    status,
    can,
    canAny,
    allows,
    decide,
    isLocked,
    subscription: { row: subscription, serverState: state, daysRemaining, planName: plan.displayName },
    limits,
  };
}
