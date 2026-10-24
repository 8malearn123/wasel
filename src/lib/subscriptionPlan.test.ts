import { describe, it, expect } from 'vitest';
import { resolveCurrentPlan, effectiveLimit, UNLIMITED } from './subscriptionPlan';
import { planAllowsFeature } from './planFeatures';
import type { Plan } from '@/hooks/usePlans';

const plan = (over: Partial<Plan>): Plan => ({
  id: 'x', name: 'Basic', name_ar: '', price: 0, branch_limit: 1, user_limit: 3,
  has_online_store: false, advanced_reports: false, priority_support: false,
  has_wholesale: false, has_loyalty: false, is_active: true, sort_order: 1, ...over,
});
const basic = plan({ id: 'b', name: 'Basic' });
const pro = plan({ id: 'p', name: 'Enterprise', branch_limit: 3, user_limit: 10, advanced_reports: true, has_online_store: true });
const max = plan({ id: 'm', name: 'Distributor', branch_limit: 9999, user_limit: 9999, has_wholesale: true });
const plans = [basic, pro, max];

describe('resolveCurrentPlan', () => {
  // the reported case: Pro by plan_id, Basic by its text, Basic's single branch
  it('follows plan_id when the text and limits drifted', () => {
    const cur = resolveCurrentPlan({ plan: 'Basic', plan_id: 'p', status: 'active', max_branches: 1, max_users: 3 }, plans);
    expect(cur.name).toBe('Enterprise');
    expect(cur.branchLimit).toBe(3);
    expect(cur.userLimit).toBe(10);
  });

  it('keeps an extra allowance granted on the subscription', () => {
    expect(resolveCurrentPlan({ plan: 'Enterprise', plan_id: 'p', max_branches: 5 }, plans).branchLimit).toBe(5);
  });

  it('treats 9999 or 0 as unlimited', () => {
    expect(resolveCurrentPlan({ plan: 'Distributor', plan_id: 'm', max_branches: 1 }, plans).branchLimit).toBe(UNLIMITED);
    expect(effectiveLimit(0, 2, 1)).toBe(UNLIMITED);
  });

  it('falls back to the text without a row, and to 1 branch / 3 users without anything', () => {
    expect(resolveCurrentPlan({ plan: 'Enterprise', plan_id: null }, plans).name).toBe('Enterprise');
    const none = resolveCurrentPlan({ plan: 'Basic' }, []);
    expect([none.branchLimit, none.userLimit]).toEqual([1, 3]);
  });

  it('keeps a trial a trial', () => {
    expect(resolveCurrentPlan({ plan: 'trial', plan_id: 'b', status: 'trial' }, plans).name).toBe('trial');
  });
});

describe('features follow one plan', () => {
  // reports came from the row (Pro: yes) and repairs from the text (Basic: no)
  it('decides column and tier features from the same plan', () => {
    const cur = resolveCurrentPlan({ plan: 'Basic', plan_id: 'p' }, plans);
    expect(planAllowsFeature('reports', cur.name, cur.row)).toBe(true);
    expect(planAllowsFeature('repairs', cur.name, cur.row)).toBe(true);
    expect(planAllowsFeature('repairs', 'Basic', pro)).toBe(true);
  });
});
