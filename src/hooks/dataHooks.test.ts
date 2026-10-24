import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

/**
 * The data hooks against a scripted Supabase: each table answers with the rows
 * (or the error) a test sets, and joins the database would refuse come back
 * null, as RLS makes them. Auth is a stable object, or the hooks' effects
 * would re-run on every render.
 */
type Answer = { data: unknown; error: { message: string; code?: string } | null };
const tables: Record<string, Answer> = {};
const rpcs: Record<string, Answer> = {};
const answer = (t: string): Answer => tables[t] ?? { data: [], error: null };
const builder = (table: string) => {
  const b: any = {
    select: () => b, eq: () => b, neq: () => b, in: () => b, gte: () => b, lt: () => b, lte: () => b,
    order: () => b, limit: () => b, insert: () => b, update: () => b, delete: () => b,
    single: async () => answer(table),
    maybeSingle: async () => answer(table),
    then: (res: any, rej: any) => Promise.resolve(answer(table)).then(res, rej),
  };
  return b;
};
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => builder(t),
    rpc: async (fn: string) => rpcs[fn] ?? { data: null, error: { message: 'Could not find the function', code: 'PGRST202' } },
  },
}));
const auth: any = { merchant: { id: 'm1' }, user: { id: 'u1' }, currentBranch: { id: 'b1' } };
vi.mock('./useAuth', () => ({ useAuth: () => auth }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { useDashboardData } from './useDashboardData';
import { useWholesale } from './useWholesale';
import { useReports } from './useReports';
import { deviceCounts, stockValue } from '@/lib/inventoryMetrics';

// 24 devices as on the demo Max shop's products page: 5 for sale, 13 sold,
// and 6 others in stock (reserved / in repair / in transfer)
const devices = [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `av${i}`, status: 'available', price: 1000 + i, cost: 800, branch_id: 'b1' })),
  ...Array.from({ length: 13 }, (_, i) => ({ id: `so${i}`, status: 'sold', price: 2000, cost: 1500, branch_id: 'b1' })),
  { id: 'ipo', status: 'reserved', price: 8689090, cost: 1, branch_id: 'b1' },
  { id: 'r1', status: 'reserved', price: 3000, cost: 2500, branch_id: 'b1' },
  { id: 'r2', status: 'in_repair', price: 1500, cost: 1000, branch_id: 'b1' },
  { id: 'r3', status: 'in_repair', price: 1200, cost: 900, branch_id: 'b1' },
  { id: 't1', status: 'transferring', price: 2500, cost: 2000, branch_id: 'b1' },
  { id: 't2', status: 'transferring', price: 1100, cost: 700, branch_id: 'b1' },
];
const accessories = [
  { id: 'a1', quantity: 400, price: 50, cost: 20, min_quantity: 5, branch_id: 'b1' },
  { id: 'a2', quantity: 53, price: 100, cost: 40, min_quantity: 60, branch_id: 'b1' },
];

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  for (const k of Object.keys(rpcs)) delete rpcs[k];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('stock figures agree across the dashboard, the products page and the reports', () => {
  it('shows one device count and one stock value', async () => {
    tables.devices = { data: devices, error: null };
    tables.accessories = { data: accessories, error: null };
    tables.sales = { data: [], error: null };
    tables.branches = { data: [{ id: 'b1', name: 'الرئيسي', is_active: true }], error: null };

    const dash = renderHook(() => useDashboardData());
    const reports = renderHook(() => useReports());
    await waitFor(() => expect(dash.result.current.loading).toBe(false));
    await waitFor(() => expect(reports.result.current.loading).toBe(false));

    // the products page computes these two lines (InventorySection)
    const products = { inStock: deviceCounts(devices).inStock, value: stockValue(devices, accessories).retail };
    const inv = reports.result.current.getInventoryReport();
    const summary = reports.result.current.getSummaryStats();

    expect(products.inStock).toBe(11);
    expect(dash.result.current.metrics!.devicesInStock).toBe(11);
    expect(inv.inStockDevices).toBe(11);
    expect(summary.availableDevices).toBe(11);
    expect(dash.result.current.metrics!.devicesForSale).toBe(5);
    expect(inv.availableDevices).toBe(5);
    expect(summary.inventoryValue).toBe(products.value);
    expect(inv.retailValue).toBe(products.value);
    // «بالتكلفة» cards are at cost now
    expect(inv.deviceValue).toBe(deviceCounts(devices) && stockValue(devices, accessories).deviceCost);
  });
});

describe('dashboard loading and failure', () => {
  it('reports a failed query instead of zeros', async () => {
    tables.devices = { data: null, error: { message: 'permission denied for table devices' } };
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('permission denied');
    expect(result.current.metrics).toBeNull();
  });

  it('stays loading until the shop is known', async () => {
    const saved = auth.merchant; auth.merchant = null;
    const { result } = renderHook(() => useDashboardData());
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.loading).toBe(true);
    expect(result.current.metrics).toBeNull();
    auth.merchant = saved;
  });
});

describe('wholesale names and products', () => {
  const listing = { id: 'L1', merchant_id: 'sup', device_id: 'd9', accessory_id: null, item_type: 'device', wholesale_price: 900, min_quantity: 5, is_active: true, notes: null, created_at: '', device: null, accessory: null, merchant: null };
  const order = { id: 'O1', order_number: 'WO-1', supplier_merchant_id: 'sup', buyer_merchant_id: 'm1', status: 'pending', total_amount: 4500, notes: null, created_at: '', supplier_merchant: null, buyer_merchant: null };

  it('fills the other party and the product the joins could not read', async () => {
    tables.wholesale_listings = { data: [listing], error: null };
    tables.wholesale_orders = { data: [order], error: null };
    rpcs.wholesale_parties = { data: [{ merchant_id: 'sup', name: 'موزع الشرق', phone: '0555' }], error: null };
    rpcs.wholesale_listing_items = { data: [{ listing_id: 'L1', item_type: 'device', name: 'Apple iPhone 15', brand: 'Apple', model: 'iPhone 15', sku: null }], error: null };
    const { result } = renderHook(() => useWholesale());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const m = result.current.marketplace[0];
    expect(m.merchant?.name).toBe('موزع الشرق');
    expect(`${m.device?.brand} ${m.device?.model}`).toBe('Apple iPhone 15');
    expect(result.current.myOrders[0].supplier_merchant?.name).toBe('موزع الشرق');
  });

  it('leaves a name unknown, not invented, when the functions are missing', async () => {
    tables.wholesale_listings = { data: [listing], error: null };
    tables.wholesale_orders = { data: [order], error: null };
    const { result } = renderHook(() => useWholesale());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.marketplace[0].merchant).toBeNull();
    expect(result.current.myOrders[0].supplier_merchant).toBeNull();
  });
});
