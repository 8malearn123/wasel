import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useFeatureAccess } from './useFeatureAccess';
import { usePermissions } from './usePermissions';
import { saleTotal, monthToDateWindows, localDayKey } from '@/lib/salesMath';
import { profitByCategory, type PatternSale } from '@/lib/salesPatterns';
import { deviceCounts, accessoryCounts, stockValue } from '@/lib/inventoryMetrics';

/**
 * The extra figures Claude Design's dashboard shows: the month so far against
 * the same stretch of last month, sales by category over 30 days, today's
 * online orders, new customers this week, and the stock summary. Read only,
 * page by page past the server's 1,000-row cap, and each figure only when the
 * plan and the role open its section — a Lite shop is never asked about online
 * orders or customers.
 */
export interface DashboardExtras {
  monthRevenue: number;
  lastMonthSameDays: number;
  /** % against the same days of last month; null when last month had nothing */
  monthChange: number | null;
  /** revenue per day of this month, 1st → today */
  monthDays: { day: string; revenue: number }[];
  categories: { category: string; revenue: number }[];
  online: { todayRevenue: number; todayCount: number; awaiting: number } | null;
  customers: { thisWeek: number; lastWeek: number } | null;
  stock: {
    retailValue: number;
    devicesForSale: number;
    accessoryLines: number;
    lowStock: number;
    outOfStock: number;
    devices: number;
    parts: number | null;
  };
}

type Row = Record<string, unknown>;
async function readAll<T = Row>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data as T[]) || [];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

export function useDashboardExtras() {
  const { merchant } = useAuth();
  const { allows, loading: plansLoading } = useFeatureAccess();
  const { can, loading: permsLoading } = usePermissions();
  const [extras, setExtras] = useState<DashboardExtras | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const wantOnline = allows('onlineStore') && can('online_orders.manage');
  const wantCustomers = allows('customers') && can('customers.manage');
  const wantParts = allows('repairs') && can('repairs.manage');

  const load = useCallback(async () => {
    if (!merchant || plansLoading || permsLoading) return;
    setLoading(true);
    setError(false);
    try {
      const { thisStart, lastStart, lastEnd } = monthToDateWindows();
      const since = new Date(Math.min(lastStart.getTime(), Date.now() - 30 * 864e5)).toISOString();
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 864e5);
      const twoWeeksAgo = new Date(Date.now() - 14 * 864e5);

      const [sales, devices, accessories, parts, online, customers] = await Promise.all([
        readAll<PatternSale>((a, b) => supabase.from('sales')
          .select('sale_date, total_amount, tax_amount, items:sale_items(quantity, unit_price, cost_at_sale, device_id, accessory:accessories(category))')
          .eq('merchant_id', merchant.id).gte('sale_date', since).order('id').range(a, b)),
        readAll<{ status: string; price: number }>((a, b) => supabase.from('devices')
          .select('status, price').eq('merchant_id', merchant.id).order('id').range(a, b)),
        readAll<{ quantity: number; price: number; min_quantity: number | null }>((a, b) => supabase.from('accessories')
          .select('quantity, price, min_quantity').eq('merchant_id', merchant.id).order('id').range(a, b)),
        wantParts
          ? supabase.from('repair_parts').select('id', { count: 'exact', head: true }).eq('merchant_id', merchant.id)
          : Promise.resolve(null),
        wantOnline
          ? readAll<{ total_amount: number; status: string; created_at: string }>((a, b) => supabase.from('online_orders')
            .select('total_amount, status, created_at').eq('merchant_id', merchant.id)
            .or(`created_at.gte.${todayStart.toISOString()},status.in.(pending,confirmed)`).order('id').range(a, b))
          : Promise.resolve(null),
        wantCustomers
          ? readAll<{ created_at: string }>((a, b) => supabase.from('customers')
            .select('created_at').eq('merchant_id', merchant.id).gte('created_at', twoWeeksAgo.toISOString()).order('id').range(a, b))
          : Promise.resolve(null),
      ]);

      const at = (s: PatternSale) => new Date(s.sale_date).getTime();
      const thisMonth = sales.filter(s => at(s) >= thisStart.getTime());
      const lastSame = sales.filter(s => at(s) >= lastStart.getTime() && at(s) <= lastEnd.getTime());
      const monthRevenue = thisMonth.reduce((t, s) => t + saleTotal(s), 0);
      const lastMonthSameDays = lastSame.reduce((t, s) => t + saleTotal(s), 0);

      const byDay = new Map<string, number>();
      for (const s of thisMonth) byDay.set(localDayKey(s.sale_date), (byDay.get(localDayKey(s.sale_date)) || 0) + saleTotal(s));
      const monthDays: { day: string; revenue: number }[] = [];
      for (const d = new Date(thisStart); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const key = localDayKey(d);
        monthDays.push({ day: key, revenue: byDay.get(key) || 0 });
      }

      const last30 = sales.filter(s => at(s) >= Date.now() - 30 * 864e5);
      const categories = profitByCategory(last30).map(c => ({ category: c.category, revenue: c.revenue }));

      const dc = deviceCounts(devices);
      const ac = accessoryCounts(accessories);
      const value = stockValue(devices, accessories);

      setExtras({
        monthRevenue,
        lastMonthSameDays,
        monthChange: lastMonthSameDays > 0 ? ((monthRevenue - lastMonthSameDays) / lastMonthSameDays) * 100 : null,
        monthDays,
        categories,
        online: online ? {
          todayRevenue: online.filter(o => new Date(o.created_at) >= todayStart && o.status !== 'cancelled').reduce((t, o) => t + Number(o.total_amount || 0), 0),
          todayCount: online.filter(o => new Date(o.created_at) >= todayStart).length,
          awaiting: online.filter(o => o.status === 'pending' || o.status === 'confirmed').length,
        } : null,
        customers: customers ? {
          thisWeek: customers.filter(c => new Date(c.created_at) >= weekAgo).length,
          lastWeek: customers.filter(c => new Date(c.created_at) < weekAgo).length,
        } : null,
        stock: {
          retailValue: value.retail,
          devicesForSale: dc.available,
          accessoryLines: ac.lines,
          lowStock: accessories.filter(a => Number(a.quantity) > 0 && Number(a.quantity) <= Number(a.min_quantity ?? 0)).length,
          outOfStock: accessories.filter(a => Number(a.quantity) <= 0).length,
          devices: dc.inStock,
          parts: parts && 'count' in parts ? (parts.count ?? 0) : null,
        },
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [merchant, plansLoading, permsLoading, wantOnline, wantCustomers, wantParts]);

  useEffect(() => { load(); }, [load]);

  return { extras, loading, error, refresh: load };
}
