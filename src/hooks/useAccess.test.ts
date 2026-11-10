import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const auth = { memberLoading: false, memberError: null as string | null, branches: [{ is_active: true }, { is_active: true }] };
vi.mock('./useAuth', () => ({ useAuth: () => auth }));
let perms = { granted: ['pos.access'], loading: false, source: 'role-map' as string };
vi.mock('./usePermissions', () => ({
  usePermissions: () => ({
    can: (k: string) => perms.granted.includes(k),
    canAny: (...ks: string[]) => ks.some(k => perms.granted.includes(k)),
    loading: perms.loading, source: perms.source,
  }),
}));
let features: string[] = [];
vi.mock('./useFeatureAccess', () => ({ useFeatureAccess: () => ({ allows: (f: string) => features.includes(f), loading: false }) }));
let sub = { isLocked: false, state: null as unknown, daysRemaining: 10, subscription: null };
vi.mock('./useSubscription', () => ({ useSubscription: () => sub }));
vi.mock('./useCurrentPlan', () => ({ useCurrentPlan: () => ({ branchLimit: 1, userLimit: 3, displayName: 'لايت' }) }));

import { useAccess } from './useAccess';

describe('useAccess — one place for permissions, plan and subscription', () => {
  beforeEach(() => {
    auth.memberError = null; auth.memberLoading = false;
    perms = { granted: ['pos.access'], loading: false, source: 'role-map' };
    features = []; sub = { isLocked: false, state: null, daysRemaining: 10, subscription: null };
  });

  it('says why something is not allowed: plan before permission', () => {
    const { result } = renderHook(() => useAccess());
    expect(result.current.decide({ feature: 'wholesale', permission: 'wholesale.manage' })).toEqual({ allowed: false, reason: 'plan' });
    features = ['wholesale'];
    const again = renderHook(() => useAccess()).result.current;
    expect(again.decide({ feature: 'wholesale', permission: 'wholesale.manage' })).toEqual({ allowed: false, reason: 'permission' });
    expect(again.decide({ anyOf: ['reports.view', 'pos.access'] })).toEqual({ allowed: true });
  });

  it('waits while loading, and a locked subscription opens nothing', () => {
    perms.loading = true;
    expect(renderHook(() => useAccess()).result.current.decide({ permission: 'pos.access' })).toEqual({ allowed: false, reason: 'loading' });
    perms.loading = false; sub.isLocked = true;
    expect(renderHook(() => useAccess()).result.current.decide({ permission: 'pos.access' })).toEqual({ allowed: false, reason: 'locked' });
  });

  it('reports where the answer came from', () => {
    expect(renderHook(() => useAccess()).result.current.status).toBe('degraded');   // 404: role map
    perms.source = 'server'; sub.state = { is_locked: false };
    expect(renderHook(() => useAccess()).result.current.status).toBe('ready');
    perms.source = 'failed';
    expect(renderHook(() => useAccess()).result.current.status).toBe('error');
    perms.source = 'server'; auth.memberError = 'x';
    expect(renderHook(() => useAccess()).result.current.status).toBe('error');
  });

  it('knows a shop over its branch limit', () => {
    const { limits } = renderHook(() => useAccess()).result.current;
    expect(limits.branches).toMatchObject({ active: 2, limit: 1, canAdd: false, over: true });
  });
});
