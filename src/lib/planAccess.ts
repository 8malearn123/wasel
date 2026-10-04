// Which plan a feature needs, and what to do when the plan is not one we know.
//
// This used to live in Sidebar.tsx as `PLAN_TIERS[plan] ?? 3` — an unknown plan
// name resolved to the HIGHEST tier and unlocked everything. A typo in the
// plans table, a plan renamed in the database, or a value an attacker managed
// to write all opened every feature. The default is now the lowest tier.

export const PLAN_TIERS: Record<string, number> = {
  Basic: 0,
  Professional: 1,
  Enterprise: 2,
  Distributor: 3,
  // the trial deliberately previews the top plan
  trial: 3,
};

/** The lowest tier — what an unrecognised plan gets */
export const MIN_TIER = 0;

export type FeatureKey =
  | 'onlineStore' | 'wholesale' | 'repairs' | 'suppliers' | 'marketing'
  | 'stocktake' | 'customers' | 'reports' | 'transfers';

// باقة بلس (tier 1) ملغاة — مميزاتها انتقلت لباقة برو (tier 2)
export const FEATURE_MIN_PLAN: Record<FeatureKey, number> = {
  repairs: 2,
  suppliers: 2,
  transfers: 2,
  stocktake: 2,
  reports: 2,
  marketing: 2,
  customers: 2,
  onlineStore: 2,
  wholesale: 3,
};

const warned = new Set<string>();

/** Fail closed: an unknown plan gets the lowest tier, and says so once. */
export function planTier(plan?: string | null): number {
  if (!plan) return MIN_TIER;
  const tier = PLAN_TIERS[plan];
  if (tier === undefined) {
    if (!warned.has(plan)) {
      warned.add(plan);
      console.warn(
        `[planAccess] unknown plan "${plan}" — falling back to the lowest tier. ` +
        `Add it to PLAN_TIERS if it is a real plan.`
      );
    }
    return MIN_TIER;
  }
  return tier;
}

/** Does this plan reach the feature? Unknown feature → allowed (not plan-gated). */
export function planAllows(plan: string | null | undefined, feature?: FeatureKey): boolean {
  if (!feature) return true;
  const min = FEATURE_MIN_PLAN[feature];
  if (min === undefined) return true;
  return planTier(plan) >= min;
}
