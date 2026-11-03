import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let perms = { granted: [] as string[], loading: false };
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (k: string) => perms.granted.includes(k), canAny: (...ks: string[]) => ks.some(k => perms.granted.includes(k)), loading: perms.loading }),
}));
let plan = { features: [] as string[], loading: false };
const featureCalls = vi.fn();
vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => { featureCalls(); return { allows: (f: string) => plan.features.includes(f), loading: plan.loading }; },
}));

import { Can } from './Can';
import { PermissionGate } from './PermissionGate';

describe('Can / PermissionGate', () => {
  beforeEach(() => { perms = { granted: [], loading: false }; plan = { features: [], loading: false }; featureCalls.mockClear(); });

  it('shows the action only with the permission', () => {
    const { rerender } = render(<PermissionGate require="products.delete"><button>حذف</button></PermissionGate>);
    expect(screen.queryByText('حذف')).toBeNull();
    perms.granted = ['products.delete'];
    rerender(<PermissionGate require="products.delete"><button>حذف</button></PermissionGate>);
    expect(screen.getByText('حذف')).toBeTruthy();
  });

  it('shows nothing while permissions load — not the action, not the fallback', () => {
    perms = { granted: ['products.delete'], loading: true };
    render(<Can permission="products.delete" fallback={<span>لا</span>}><button>حذف</button></Can>);
    expect(screen.queryByText('حذف')).toBeNull();
    expect(screen.queryByText('لا')).toBeNull();
  });

  it('a feature needs the plan too, and the plan is read only when asked for', () => {
    perms.granted = ['wholesale.manage'];
    render(<Can permission="wholesale.manage"><span>بلا باقة</span></Can>);
    expect(featureCalls).not.toHaveBeenCalled();
    render(<Can feature="wholesale" permission="wholesale.manage" fallback={<span>رقِّ باقتك</span>}><span>الجملة</span></Can>);
    expect(screen.getByText('رقِّ باقتك')).toBeTruthy();
    expect(screen.queryByText('الجملة')).toBeNull();
  });
});
