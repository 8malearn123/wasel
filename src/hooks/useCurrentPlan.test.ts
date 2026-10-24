import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// the reported account: Pro by plan_id, «Basic» in the text column, Basic's
// single branch, and two branches in use
const auth = {
  subscription: { plan: 'Basic', plan_id: 'pro', status: 'active', max_branches: 1, max_users: 3 },
  branches: [{ id: 'b1', is_active: true }, { id: 'b2', is_active: true }],
};
const plans = [
  { id: 'basic', name: 'Basic', name_ar: 'باقة لايت', branch_limit: 1, user_limit: 3, advanced_reports: false, has_online_store: false, has_wholesale: false },
  { id: 'pro', name: 'Enterprise', name_ar: 'باقة برو', branch_limit: 3, user_limit: 10, advanced_reports: true, has_online_store: true, has_wholesale: false },
];
vi.mock('./useAuth', () => ({ useAuth: () => auth }));
vi.mock('./usePlans', async (orig) => ({ ...(await orig<typeof import('./usePlans')>()), usePlans: () => ({ plans, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { useCurrentPlan } from './useCurrentPlan';
import { usePlanEnforcement } from './usePlanEnforcement';
import { planAllowsFeature } from '@/lib/planFeatures';

describe('the reported Pro account', () => {
  it('reads «باقة برو», 2 of 3 branches, and Pro features on every screen', () => {
    const { result } = renderHook(() => useCurrentPlan());
    expect(result.current.displayName).toBe('باقة برو');
    const { result: e } = renderHook(() => usePlanEnforcement());
    expect(`${e.current.branchUsage.current}/${e.current.branchUsage.limit}`).toBe('2/3');
    expect(e.current.canAddBranch).toBe(true);
    // reports (a plan column) and repairs (the tier ladder) now agree
    expect(planAllowsFeature('reports', result.current.name, result.current.row as never)).toBe(true);
    expect(planAllowsFeature('repairs', result.current.name, result.current.row as never)).toBe(true);
    expect(planAllowsFeature('wholesale', result.current.name, result.current.row as never)).toBe(false);
  });
});
