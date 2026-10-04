import type { Plan } from '@/hooks/usePlans';
import { planTier, FEATURE_MIN_PLAN, type FeatureKey } from './planAccess';

/**
 * Which plan unlocks which feature.
 *
 * Phase 2 asked for feature flags rather than conditions hard-coded in the
 * screens, so that adding Basic / Pro / Max / Max Pro / Enterprise is a row in
 * the plans table and not a code change.
 *
 * Today the plans table already carries real boolean columns, and those are
 * authoritative wherever one exists:
 *
 *   has_online_store  → onlineStore
 *   has_wholesale     → wholesale
 *   advanced_reports  → reports
 *
 * The other six features (repairs, suppliers, transfers, stocktake, marketing,
 * customers) have no column yet, so they still resolve through the tier ladder
 * in planAccess.ts. Giving them real flags means a `plan_features` table, which
 * is a migration — and no migration may be assumed applied right now. The
 * resolver below is the single place that decision lives, so that migration
 * only has to change this file, not nine call sites.
 */

/** A plan column, when the feature has one */
const PLAN_COLUMN: Partial<Record<FeatureKey, keyof Plan>> = {
  onlineStore: 'has_online_store',
  wholesale: 'has_wholesale',
  reports: 'advanced_reports',
};

/** Features still decided by the tier ladder, until plan_features exists */
export const TIER_ONLY_FEATURES: FeatureKey[] = [
  'repairs', 'suppliers', 'transfers', 'stocktake', 'marketing', 'customers',
];

export interface FeatureResolution {
  allowed: boolean;
  /** 'plan-column' = read from the plans row; 'tier' = the hard-coded ladder */
  source: 'plan-column' | 'tier';
}

/**
 * Resolve one feature for one plan.
 *
 * `plan` is the row from the plans table, when it could be read. Without it —
 * the table is unreachable, or the subscription points at a plan that no longer
 * exists — every feature falls back to the tier ladder, which fails closed for
 * a plan name it does not recognise.
 */
export function resolveFeature(
  feature: FeatureKey,
  planName: string | null | undefined,
  plan?: Plan | null,
): FeatureResolution {
  const column = PLAN_COLUMN[feature];

  if (column && plan) {
    return { allowed: Boolean(plan[column]), source: 'plan-column' };
  }

  const min = FEATURE_MIN_PLAN[feature];
  if (min === undefined) return { allowed: true, source: 'tier' };
  return { allowed: planTier(planName) >= min, source: 'tier' };
}

export function planAllowsFeature(
  feature: FeatureKey,
  planName: string | null | undefined,
  plan?: Plan | null,
): boolean {
  return resolveFeature(feature, planName, plan).allowed;
}
