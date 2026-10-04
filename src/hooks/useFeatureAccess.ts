import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { usePlans } from './usePlans';
import { resolveFeature, planAllowsFeature } from '@/lib/planFeatures';
import type { FeatureKey } from '@/lib/planAccess';

/**
 * Whether the merchant's plan includes a feature.
 *
 * Reads the plans row where a flag column exists and falls back to the tier
 * ladder otherwise — see planFeatures.ts. While the plans table is still
 * loading, `loading` is true and callers should not hide anything yet, or the
 * sidebar flickers on every page load.
 */
export function useFeatureAccess() {
  const { subscription } = useAuth();
  const { plans, loading } = usePlans();

  const plan = useMemo(
    () => plans.find(p => p.id === subscription?.plan_id) ?? null,
    [plans, subscription?.plan_id],
  );

  const allows = useCallback(
    (feature?: FeatureKey) => (feature ? planAllowsFeature(feature, subscription?.plan, plan) : true),
    [subscription?.plan, plan],
  );

  const explain = useCallback(
    (feature: FeatureKey) => resolveFeature(feature, subscription?.plan, plan),
    [subscription?.plan, plan],
  );

  return { plan, allows, explain, loading };
}
