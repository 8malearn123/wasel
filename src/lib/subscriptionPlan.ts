import type { Plan } from '@/hooks/usePlans';
import { isUnlimited } from './planLimits';

/**
 * The one answer to "which plan is this shop on, and what does it allow".
 *
 * A subscription row carries the plan three times: plan_id (the plans row),
 * plan (that row's name, as text) and max_branches / max_users (its limits,
 * copied when the plan was applied). The server functions write all of them
 * together, but rows written before them — or edited by hand — drift: a Pro
 * shop whose `plan` text still read 'Basic' and whose max_branches was still 1
 * showed «باقة لايت» and «2/1» while its plans row granted Pro's reports.
 * Each screen read a different copy, so each screen told a different story.
 *
 * plan_id is the reference the server applies plans by, so when it resolves to
 * a plans row that row decides the name, the tier and the floor of the limits.
 * The text column is only the fallback for a subscription without a row.
 */

export interface SubscriptionLike {
  plan?: string | null;
  plan_id?: string | null;
  status?: string | null;
  max_branches?: number | null;
  max_users?: number | null;
}

/** 9999 is how the plans table writes "no ceiling" */
export const UNLIMITED = 9999;

/** The plans row the subscription points at, when there is one */
export function planRowFor(sub: SubscriptionLike | null | undefined, plans: Plan[]): Plan | null {
  if (!sub?.plan_id) return null;
  return plans.find(p => p.id === sub.plan_id) ?? null;
}

/**
 * The plan's key ('Basic', 'Enterprise', 'Distributor', or 'trial') — what the
 * tier ladder and the display names are keyed by. A trial previews the top
 * plan whatever row it points at.
 */
export function effectivePlanName(sub: SubscriptionLike | null | undefined, row: Plan | null): string | null {
  if (!sub) return null;
  if (sub.plan === 'trial' || (sub.status === 'trial' && !row)) return 'trial';
  return row?.name ?? sub.plan ?? null;
}

/**
 * A limit: never below what the plan provides, and an extra allowance granted
 * on the subscription itself is kept. Unlimited on either side wins.
 */
export function effectiveLimit(granted: number | null | undefined, planLimit: number | null | undefined, fallback: number): number {
  const known = [granted, planLimit].filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  if (known.length === 0) return fallback;
  if (known.some(n => isUnlimited(n))) return UNLIMITED;
  return Math.max(...known);
}

export interface CurrentPlan {
  row: Plan | null;
  name: string | null;
  branchLimit: number;
  userLimit: number;
}

export function resolveCurrentPlan(sub: SubscriptionLike | null | undefined, plans: Plan[]): CurrentPlan {
  const row = planRowFor(sub, plans);
  return {
    row,
    name: effectivePlanName(sub, row),
    branchLimit: effectiveLimit(sub?.max_branches, row?.branch_limit, 1),
    userLimit: effectiveLimit(sub?.max_users, row?.user_limit, 3),
  };
}
