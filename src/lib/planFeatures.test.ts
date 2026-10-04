import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveFeature, planAllowsFeature, TIER_ONLY_FEATURES } from './planFeatures';
import type { Plan } from '@/hooks/usePlans';

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 'p1', name: 'Enterprise', name_ar: 'باقة برو', price: 399,
  branch_limit: 1, user_limit: 9999,
  has_online_store: true, advanced_reports: true, priority_support: true,
  has_wholesale: false, has_loyalty: true, is_active: true, sort_order: 2,
  ...over,
});

describe('resolveFeature', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));

  it('reads the plans row where a column exists', () => {
    expect(resolveFeature('onlineStore', 'Enterprise', plan())).toEqual({ allowed: true, source: 'plan-column' });
    expect(resolveFeature('wholesale', 'Enterprise', plan())).toEqual({ allowed: false, source: 'plan-column' });
    expect(resolveFeature('reports', 'Enterprise', plan())).toEqual({ allowed: true, source: 'plan-column' });
  });

  // The point of the exercise: a new plan is a row, not a code change.
  it('follows the row even when the plan name is unknown to the code', () => {
    const custom = plan({ name: 'Enterprise Plus', has_wholesale: true, has_online_store: false });
    expect(planAllowsFeature('wholesale', 'Enterprise Plus', custom)).toBe(true);
    expect(planAllowsFeature('onlineStore', 'Enterprise Plus', custom)).toBe(false);
  });

  it('falls back to the tier ladder for features with no column', () => {
    for (const feature of TIER_ONLY_FEATURES) {
      expect(resolveFeature(feature, 'Enterprise', plan()).source).toBe('tier');
    }
    expect(planAllowsFeature('repairs', 'Enterprise', plan())).toBe(true);
    expect(planAllowsFeature('repairs', 'Basic', plan({ name: 'Basic' }))).toBe(false);
  });

  // Without the row we cannot know, so the ladder decides — and it fails closed
  // on a name it does not recognise.
  it('fails closed when the plan row is missing and the name is unknown', () => {
    expect(planAllowsFeature('wholesale', 'Mystery', null)).toBe(false);
    expect(planAllowsFeature('onlineStore', 'Mystery', null)).toBe(false);
    expect(planAllowsFeature('reports', undefined, null)).toBe(false);
  });

  it('still trusts the ladder for a known name when the row is missing', () => {
    expect(planAllowsFeature('wholesale', 'Distributor', null)).toBe(true);
    expect(planAllowsFeature('wholesale', 'Enterprise', null)).toBe(false);
  });
});
