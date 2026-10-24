import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// devices answer with whatever status the test sets; every write is recorded
let deviceRows: { id: string; model: string; status: string }[] = [];
const writes: string[] = [];
const builder = (table: string) => {
  let op = 'select';
  const b: any = {
    select: () => b, eq: () => b, in: () => b, order: () => b, limit: () => b,
    insert: () => { op = 'insert'; writes.push(`${table}:insert`); return b; },
    update: () => { op = 'update'; writes.push(`${table}:update`); return b; },
    delete: () => { op = 'delete'; return b; },
    single: async () => ({ data: table === 'sales' ? { id: 's1', invoice_number: 'INV-1' } : { quantity: 5 }, error: null }),
    then: (res: any, rej: any) => Promise.resolve(
      table === 'devices' && op === 'select' ? { data: deviceRows, error: null } : { data: [], error: null },
    ).then(res, rej),
  };
  return b;
};
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: 'INV-1', error: null }) },
}));
const auth = { merchant: { id: 'm1' }, currentBranch: { id: 'b1' }, user: { id: 'u1' } };
vi.mock('./useAuth', () => ({ useAuth: () => auth }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useSales } from './useSales';

const cart: any[] = [{ id: 'd1', type: 'device', deviceId: 'dev-1', price: 4799, cost: 4200, quantity: 1 }];

describe('a device is sold once', () => {
  beforeEach(() => { writes.length = 0; });

  it('refuses a device that is already sold, before any invoice is made', async () => {
    deviceRows = [{ id: 'dev-1', model: 'iPhone 15 Pro Max', status: 'sold' }];
    const { result } = renderHook(() => useSales());
    let out: any;
    await act(async () => { out = await result.current.createSale(cart, 'cash'); });
    expect(out.error?.message).toContain('iPhone 15 Pro Max');
    expect(writes).toEqual([]);
  });

  it('sells a device that is available', async () => {
    deviceRows = [{ id: 'dev-1', model: 'iPhone 14 Pro', status: 'available' }];
    const { result } = renderHook(() => useSales());
    let out: any;
    await act(async () => { out = await result.current.createSale(cart, 'cash'); });
    expect(out.error).toBeNull();
    expect(writes).toContain('sales:insert');
    expect(writes).toContain('devices:update');
  });
});
