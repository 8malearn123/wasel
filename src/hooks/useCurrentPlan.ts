import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { usePlans, planDisplayName } from './usePlans';
import { resolveCurrentPlan } from '@/lib/subscriptionPlan';

/** The shop's plan as every screen should read it — see subscriptionPlan.ts */
export function useCurrentPlan() {
  const { subscription } = useAuth();
  const { plans, loading } = usePlans();
  return useMemo(() => {
    const current = resolveCurrentPlan(subscription, plans);
    return { ...current, displayName: planDisplayName(current.name), loading };
  }, [subscription, plans, loading]);
}
