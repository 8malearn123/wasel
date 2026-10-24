import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('./useAuth', () => ({ useAuth: () => ({}) }));

import { saleLineRows } from './useSales';

const cart = [
  { id: 'd1', type: 'device', deviceId: 'dev-1', price: 2000, cost: 1700, quantity: 1 },
  { id: 'a1', type: 'accessory', accessoryId: 'acc-1', price: 186.52, cost: 50, quantity: 2 },
  { id: 'w1', type: 'warranty', price: 99, quantity: 1 },
] as never;

describe('saleLineRows', () => {
  it('builds every line for one insert, each with the same columns', () => {
    const rows = saleLineRows('s1', cart);
    expect(rows).toHaveLength(3);
    const keys = rows.map(r => Object.keys(r).sort().join());
    expect(new Set(keys).size).toBe(1);
    expect(rows[0]).toMatchObject({ sale_id: 's1', device_id: 'dev-1', accessory_id: null, quantity: 1, unit_price: 2000, cost_at_sale: 1700 });
    expect(rows[1]).toMatchObject({ device_id: null, accessory_id: 'acc-1', quantity: 2 });
    expect(rows[2]).toMatchObject({ device_id: null, accessory_id: null, cost_at_sale: null });
  });
});
