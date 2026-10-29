import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// A tiny in-memory sales/sale_items store. `dropSaleAnswer` makes the next
// sales insert reach the "server" (the row is stored) while the till gets a
// network error back — the case where pressing «pay» again used to sell twice.
const db = { sales: new Map<string, any>(), items: [] as any[] };
let dropSaleAnswer = false;
let numbers = 0;
const calls: string[] = [];
const netError = { message: 'TypeError: Failed to fetch' };

const builder = (table: string) => {
  let op = 'select';
  let row: any = null;
  const filters: Record<string, unknown> = {};
  let head = false;
  const b: any = {
    select: (_c?: string, o?: { head?: boolean }) => { if (o?.head) head = true; return b; },
    eq: (k: string, v: unknown) => { filters[k] = v; return b; },
    in: () => b, order: () => b, limit: () => b,
    insert: (r: any) => {
      op = 'insert'; row = r; calls.push(`${table}:insert`);
      if (table === 'sales') db.sales.set(r.id, { ...r });
      if (table === 'sale_items') db.items.push(...r);
      return b;
    },
    update: () => { op = 'update'; calls.push(`${table}:update`); return b; },
    delete: () => { op = 'delete'; calls.push(`${table}:delete`); return b; },
    single: async () => {
      if (table === 'sales' && op === 'insert') {
        if (dropSaleAnswer) { dropSaleAnswer = false; return { data: null, error: netError }; }
        return { data: db.sales.get(row.id), error: null };
      }
      return { data: { quantity: 5 }, error: null };
    },
    maybeSingle: async () => ({ data: table === 'sales' ? db.sales.get(filters.id as string) ?? null : null, error: null }),
    then: (res: any, rej: any) => {
      let out: any = { data: [], error: null };
      if (table === 'sale_items' && head) out = { count: db.items.filter(i => i.sale_id === filters.sale_id).length, error: null };
      if (table === 'sales' && op === 'delete') db.sales.delete(filters.id as string);
      return Promise.resolve(out).then(res, rej);
    },
  };
  return b;
};
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => builder(t),
    rpc: async () => { calls.push('rpc:number'); numbers += 1; return { data: `INV-${numbers}`, error: null }; },
  },
}));
const auth = { merchant: { id: 'm1' }, currentBranch: { id: 'b1' }, user: { id: 'u1' } };
vi.mock('./useAuth', () => ({ useAuth: () => auth }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { useSales, resetPendingSale } from './useSales';
import { toast } from 'sonner';

const cart: any[] = [{ id: 'a1', type: 'accessory', accessoryId: 'acc-1', name: 'Charger', price: 59, cost: 20, quantity: 1 }];

describe('pressing «pay» again after the connection dropped', () => {
  beforeEach(() => {
    db.sales.clear(); db.items.length = 0; calls.length = 0; numbers = 0; dropSaleAnswer = false;
    resetPendingSale(); vi.clearAllMocks();
  });

  it('finishes the invoice that reached the server instead of making a second one', async () => {
    const { result } = renderHook(() => useSales());
    dropSaleAnswer = true;
    let first: any, second: any;
    await act(async () => { first = await result.current.createSale(cart, 'cash'); });
    expect(first.error).toBe(netError);
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('لن تتكرر الفاتورة');
    expect(db.sales.size).toBe(1);

    await act(async () => { second = await result.current.createSale(cart, 'cash'); });
    expect(second.error).toBeNull();
    expect(db.sales.size).toBe(1);                       // still one invoice
    expect(calls.filter(c => c === 'sales:insert')).toHaveLength(1);
    expect(calls.filter(c => c === 'rpc:number')).toHaveLength(1);  // same number kept
    expect(second.data.invoice_number).toBe('INV-1');
    expect(db.items).toHaveLength(1);                    // its lines saved once
  });

  it('a normal sale after a finished one gets its own invoice', async () => {
    const { result } = renderHook(() => useSales());
    await act(async () => { await result.current.createSale(cart, 'cash'); });
    await act(async () => { await result.current.createSale(cart, 'cash'); });
    expect(db.sales.size).toBe(2);
    expect(calls.filter(c => c === 'rpc:number')).toHaveLength(2);
  });

  it('a changed cart after a lost answer takes back the empty invoice and starts a new one', async () => {
    const { result } = renderHook(() => useSales());
    dropSaleAnswer = true;
    await act(async () => { await result.current.createSale(cart, 'cash'); });
    const other = [{ ...cart[0], quantity: 2 }];
    let out: any;
    await act(async () => { out = await result.current.createSale(other, 'cash'); });
    expect(out.error).toBeNull();
    expect(calls).toContain('sales:delete');
    expect(db.sales.size).toBe(1);
    expect(out.data.invoice_number).toBe('INV-2');
  });
});
