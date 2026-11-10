import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * A refused write is reported as refused. Each of these used to ignore the
 * server's answer and show success — or carry on to the next step as if the
 * previous one had happened.
 */
type Answer = { data: unknown; error: { message: string; code?: string } | null };
let answers: Record<string, Answer> = {};
const writes: string[] = [];
const builder = (table: string) => {
  let op = 'select';
  const answer = () => answers[`${table}:${op}`] ?? { data: op === 'select' ? [] : null, error: null };
  type B = Record<string, unknown>;
  const b: B = {
    select: () => b, eq: () => b, in: () => b, order: () => b, limit: () => b, neq: () => b,
    insert: () => { op = 'insert'; writes.push(`${table}:insert`); return b; },
    update: () => { op = 'update'; writes.push(`${table}:update`); return b; },
    delete: () => { op = 'delete'; writes.push(`${table}:delete`); return b; },
    single: async () => answer(), maybeSingle: async () => answer(),
    then: (res: (v: Answer) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(answer()).then(res, rej),
  };
  return b;
};
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: [], error: null }) },
}));
const auth = { merchant: { id: 'm1' }, currentBranch: { id: 'b1' }, user: { id: 'u1' }, merchantUser: { role: 'owner' } };
vi.mock('./useAuth', () => ({ useAuth: () => auth }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { useStocktake } from './useStocktake';
import { useWholesale } from './useWholesale';
import { useSales } from './useSales';

const refused = { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };

beforeEach(() => {
  answers = {}; writes.length = 0;
  Object.values(toast).forEach(f => f.mockClear());
});

describe('finishing a stocktake', () => {
  it('does not close the stocktake when the stock could not be corrected', async () => {
    answers['stocktake_items:select'] = { data: [{ id: 'i1', item_type: 'accessory', item_id: 'a1', counted_quantity: 3, discrepancy: -2 }], error: null };
    answers['accessories:update'] = refused;
    const { result } = renderHook(() => useStocktake());
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.finalizeStocktake('st1', true); });
    expect(ok).toBe(false);
    expect(writes).not.toContain('stocktakes:update');
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('says so when closing it is refused', async () => {
    answers['stocktakes:update'] = refused;
    const { result } = renderHook(() => useStocktake());
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.finalizeStocktake('st1', false); });
    expect(ok).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('a wholesale credit payment', () => {
  it('is not «recorded» when the server refuses it', async () => {
    answers['wholesale_credit_transactions:select'] = { data: [{ id: 'c1', amount: 1000, paid_amount: 0, remaining_amount: 1000, status: 'unpaid', supplier_merchant_id: 'm1', buyer_merchant_id: 'm2' }], error: null };
    answers['wholesale_credit_transactions:update'] = refused;
    const { result } = renderHook(() => useWholesale());
    await waitFor(() => expect(result.current.myCredits.length).toBe(1));
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.recordPayment('c1', 200); });
    expect(ok).toBe(false);
    expect(toast.success).not.toHaveBeenCalledWith('تم تسجيل الدفعة');
    expect(toast.error).toHaveBeenCalled();
  });

  it('refuses a zero or negative payment before asking the server', async () => {
    answers['wholesale_credit_transactions:select'] = { data: [{ id: 'c1', amount: 1000, paid_amount: 0, remaining_amount: 1000, status: 'unpaid', supplier_merchant_id: 'm1', buyer_merchant_id: 'm2' }], error: null };
    const { result } = renderHook(() => useWholesale());
    await waitFor(() => expect(result.current.myCredits.length).toBe(1));
    writes.length = 0;
    await act(async () => { await result.current.recordPayment('c1', -50); });
    expect(writes).not.toContain('wholesale_credit_transactions:update');
  });
});

describe('deleting an invoice', () => {
  it('keeps the invoice when an item could not go back to stock', async () => {
    answers['sales:select'] = { data: [{ id: 's1', invoice_number: 'INV-1', total_amount: 100, sale_date: new Date().toISOString(), items: [] }], error: null };
    answers['sale_items:select'] = { data: [{ device_id: 'd1', accessory_id: null, quantity: 1 }], error: null };
    answers['devices:update'] = refused;
    const { result } = renderHook(() => useSales());
    await waitFor(() => expect(result.current.sales.length).toBe(1));
    let out: { error: unknown } | undefined;
    await act(async () => { out = await result.current.deleteSale('s1'); });
    expect(out?.error).toBeTruthy();
    expect(writes).not.toContain('sales:delete');
  });
});
