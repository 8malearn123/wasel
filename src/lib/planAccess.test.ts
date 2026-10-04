import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planTier, planAllows, MIN_TIER } from './planAccess';

describe('planTier', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));

  it('reads the known plans', () => {
    expect(planTier('Basic')).toBe(0);
    expect(planTier('Enterprise')).toBe(2);
    expect(planTier('Distributor')).toBe(3);
  });

  it('previews the top plan during the trial', () => {
    expect(planTier('trial')).toBe(3);
  });

  // The bug this file exists for: `PLAN_TIERS[plan] ?? 3` gave an unknown plan
  // the HIGHEST tier, so a typo or a tampered value unlocked everything.
  it('gives an unknown plan the lowest tier, not the highest', () => {
    expect(planTier('Platinum')).toBe(MIN_TIER);
    expect(planTier('; DROP TABLE plans;')).toBe(MIN_TIER);
    expect(planTier('')).toBe(MIN_TIER);
    expect(planTier(null)).toBe(MIN_TIER);
    expect(planTier(undefined)).toBe(MIN_TIER);
  });

  it('warns once per unknown plan', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    planTier('MysteryPlan');
    planTier('MysteryPlan');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('planAllows', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));

  it('keeps wholesale on the top plan only', () => {
    expect(planAllows('Distributor', 'wholesale')).toBe(true);
    expect(planAllows('Enterprise', 'wholesale')).toBe(false);
    expect(planAllows('Basic', 'wholesale')).toBe(false);
  });

  it('opens the pro features from Enterprise up', () => {
    for (const feature of ['repairs', 'suppliers', 'reports', 'onlineStore'] as const) {
      expect(planAllows('Enterprise', feature)).toBe(true);
      expect(planAllows('Basic', feature)).toBe(false);
    }
  });

  it('refuses every gated feature for an unknown plan', () => {
    for (const feature of ['wholesale', 'onlineStore', 'reports', 'customers'] as const) {
      expect(planAllows('WhoKnows', feature)).toBe(false);
    }
  });

  it('leaves ungated pages alone', () => {
    expect(planAllows('Basic', undefined)).toBe(true);
    expect(planAllows('WhoKnows', undefined)).toBe(true);
  });
});
