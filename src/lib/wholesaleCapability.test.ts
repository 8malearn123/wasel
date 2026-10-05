import { describe, it, expect } from 'vitest';
import { wholesaleAccess, allowsWholesale } from './wholesaleCapability';
import type { Plan } from '@/hooks/usePlans';

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 'p', name: 'Enterprise', name_ar: 'باقة برو', price: 399,
  branch_limit: 1, user_limit: 9999, has_online_store: true,
  advanced_reports: true, priority_support: true, has_wholesale: false,
  has_loyalty: true, is_active: true, sort_order: 2, ...over,
});

describe('wholesaleAccess', () => {
  it('lets PRO buy but not supply', () => {
    expect(wholesaleAccess('Enterprise', plan())).toEqual({ canBuy: true, canSupply: false });
  });

  it('lets MAX buy and supply', () => {
    const max = plan({ name: 'Distributor', has_wholesale: true });
    expect(wholesaleAccess('Distributor', max)).toEqual({ canBuy: true, canSupply: true });
  });

  // A plan added in the database, unknown to this code, must still work
  it('follows the plans row over the plan name', () => {
    expect(allowsWholesale('supply', 'Enterprise Plus', plan({ name: 'Enterprise Plus', has_wholesale: true }))).toBe(true);
    expect(allowsWholesale('supply', 'Distributor', plan({ name: 'Distributor', has_wholesale: false }))).toBe(false);
  });

  it('falls back to the known plan names when the row is missing', () => {
    expect(allowsWholesale('supply', 'Distributor', null)).toBe(true);
    expect(allowsWholesale('supply', 'Enterprise', null)).toBe(false);
    expect(allowsWholesale('supply', 'Mystery', null)).toBe(false);
    expect(allowsWholesale('supply', null, null)).toBe(false);
  });

  it('never blocks buying', () => {
    for (const name of ['Basic', 'Enterprise', 'Distributor', 'Mystery', null]) {
      expect(allowsWholesale('buy', name, null)).toBe(true);
    }
  });
});
