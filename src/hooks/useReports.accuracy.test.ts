import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// 1,200 invoices on the server: the first page holds 1,000, the second 200
const sale = (i: number) => ({
  id: `s${i}`, branch_id: 'b1', sold_by: 'u1', total_amount: 115, tax_amount: 15,
  sale_date: new Date().toISOString(), items: [{ cost_at_sale: 60, quantity: 1, device_id: null }],
});
const ALL = Array.from({ length: 1200 }, (_, i) => sale(i));
const builder = (table: string) => {
  let from = 0, to = 999;
  const rows = () => table === 'sales' ? ALL.slice(from, to + 1) : [];
  const b: Record<string, unknown> = {
    select: () => b, eq: () => b, in: () => b, order: () => b,
    range: (f: number, t: number) => { from = f; to = t; return b; },
    then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(res),
  };
  return b;
};
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => builder(t) } }));
const auth = { merchant: { id: 'm1' } };
vi.mock('./useAuth', () => ({ useAuth: () => auth }));

import { useReports } from './useReports';

describe('report figures', () => {
  it('reads every invoice past the 1,000-row page', async () => {
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.salesData).toHaveLength(1200);
  });

  it('profit is before VAT: 1,200 × (100 − 60), not 1,200 × (115 − 60)', async () => {
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const stats = result.current.getSummaryStats();
    expect(stats.todayRevenue).toBe(1200 * 115);
    expect(stats.todayProfit).toBe(1200 * 40);
    const emp = result.current.getEmployeePerformance()[0];
    expect(emp.totalProfit).toBe(1200 * 40);
    expect(emp.margin).toBeCloseTo(40);           // 40 of the 100 before VAT
  });
});
