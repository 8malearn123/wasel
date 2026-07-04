import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { startOfDay, subDays, format, startOfWeek, endOfWeek } from 'date-fns';

export interface DashboardMetrics {
  todaysRevenue: number;
  yesterdaysRevenue: number;
  unitsSoldToday: number;
  unitsSoldYesterday: number;
  devicesInStock: number;
  devicesLastWeek: number;
  accessoriesInStock: number;
  accessoriesLastWeek: number;
  totalProfit: number;
  pendingRepairs: number;
  unpaidPurchaseOrders: number;
  supplierDebt: number;
}

export interface DailySalesData {
  date: string;
  label: string;
  revenue: number;
  count: number;
  profit: number;
}

export interface RecentSale {
  id: string;
  type: 'device' | 'accessory';
  name: string;
  identifier: string;
  price: number;
  time: string;
  paymentMethod: string;
}

export interface BranchStats {
  id: string;
  name: string;
  address: string | null;
  todaySales: number;
  todayRevenue: number;
  isWarehouse: boolean;
}

export function useDashboardData() {
  const { merchant } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesChart, setSalesChart] = useState<DailySalesData[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    if (!merchant) return;

    const today = startOfDay(new Date()).toISOString();
    const yesterday = startOfDay(subDays(new Date(), 1)).toISOString();
    const todayEnd = new Date().toISOString();

    // Parallel queries
    const [
      todaySalesRes,
      yesterdaySalesRes,
      devicesRes,
      accessoriesRes,
      pendingRepairsRes,
      unpaidPORes,
    ] = await Promise.all([
      // Today's sales
      supabase
        .from('sales')
        .select('total_amount, subtotal, discount_amount')
        .eq('merchant_id', merchant.id)
        .gte('sale_date', today),
      // Yesterday's sales
      supabase
        .from('sales')
        .select('total_amount')
        .eq('merchant_id', merchant.id)
        .gte('sale_date', yesterday)
        .lt('sale_date', today),
      // Devices in stock
      supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'available'),
      // Accessories in stock
      supabase
        .from('accessories')
        .select('quantity')
        .eq('merchant_id', merchant.id),
      // Pending repairs
      supabase
        .from('repair_orders')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .in('status', ['received', 'diagnosing', 'in_progress', 'waiting_parts']),
      // Unpaid purchase orders
      supabase
        .from('purchase_orders')
        .select('total_amount, paid_amount')
        .eq('merchant_id', merchant.id)
        .neq('payment_status', 'paid'),
    ]);

    const todayRevenue = (todaySalesRes.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const yesterdayRevenue = (yesterdaySalesRes.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const unitsSoldToday = todaySalesRes.data?.length || 0;
    const devicesInStock = devicesRes.count || 0;
    const totalAccessories = (accessoriesRes.data || []).reduce((s, a) => s + Number(a.quantity || 0), 0);

    const supplierDebt = (unpaidPORes.data || []).reduce((s, po) => {
      return s + (Number(po.total_amount || 0) - Number(po.paid_amount || 0));
    }, 0);

    setMetrics({
      todaysRevenue: todayRevenue,
      yesterdaysRevenue: yesterdayRevenue,
      unitsSoldToday,
      unitsSoldYesterday: yesterdaySalesRes.data?.length || 0,
      devicesInStock,
      devicesLastWeek: 0,
      accessoriesInStock: totalAccessories,
      accessoriesLastWeek: 0,
      totalProfit: 0,
      pendingRepairs: pendingRepairsRes.count || 0,
      unpaidPurchaseOrders: unpaidPORes.data?.length || 0,
      supplierDebt,
    });
  }, [merchant]);

  const fetchSalesChart = useCallback(async () => {
    if (!merchant) return;

    const days: DailySalesData[] = [];
    const dayNames = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStart = startOfDay(date).toISOString();
      const dayEnd = i === 0 ? new Date().toISOString() : startOfDay(subDays(new Date(), i - 1)).toISOString();

      const { data } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('merchant_id', merchant.id)
        .gte('sale_date', dayStart)
        .lt('sale_date', dayEnd);

      const revenue = (data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
      days.push({
        date: format(date, 'yyyy-MM-dd'),
        label: dayNames[date.getDay()],
        revenue,
        count: data?.length || 0,
        profit: 0,
      });
    }

    setSalesChart(days);
  }, [merchant]);

  const fetchRecentSales = useCallback(async () => {
    if (!merchant) return;

    const { data: sales } = await supabase
      .from('sales')
      .select('id, total_amount, payment_method, created_at, invoice_number')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!sales || sales.length === 0) {
      setRecentSales([]);
      return;
    }

    const items: RecentSale[] = [];
    for (const sale of sales) {
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('device_id, accessory_id, unit_price, quantity')
        .eq('sale_id', sale.id)
        .limit(1);

      const si = saleItems?.[0];
      let name = sale.invoice_number;
      let identifier = '';
      let type: 'device' | 'accessory' = 'device';

      if (si?.device_id) {
        const { data: dev } = await supabase.from('devices').select('model, imei, brand').eq('id', si.device_id).single();
        if (dev) {
          name = `${dev.brand || ''} ${dev.model}`.trim();
          identifier = dev.imei;
        }
      } else if (si?.accessory_id) {
        const { data: acc } = await supabase.from('accessories').select('name, sku').eq('id', si.accessory_id).single();
        if (acc) {
          name = acc.name;
          identifier = acc.sku;
          type = 'accessory';
        }
      }

      const now = new Date();
      const saleDate = new Date(sale.created_at);
      const diffMin = Math.floor((now.getTime() - saleDate.getTime()) / 60000);
      let time = '';
      if (diffMin < 1) time = 'الآن';
      else if (diffMin < 60) time = `منذ ${diffMin} دقيقة`;
      else if (diffMin < 1440) time = `منذ ${Math.floor(diffMin / 60)} ساعة`;
      else time = format(saleDate, 'MM/dd');

      items.push({
        id: sale.id,
        type,
        name,
        identifier,
        price: Number(sale.total_amount),
        time,
        paymentMethod: sale.payment_method,
      });
    }

    setRecentSales(items);
  }, [merchant]);

  const fetchBranchStats = useCallback(async () => {
    if (!merchant) return;

    const { data: branches } = await supabase
      .from('branches')
      .select('id, name, address, is_warehouse')
      .eq('merchant_id', merchant.id)
      .eq('is_active', true);

    if (!branches) return;

    const today = startOfDay(new Date()).toISOString();
    const stats: BranchStats[] = [];

    for (const branch of branches) {
      const { data: sales } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('branch_id', branch.id)
        .gte('sale_date', today);

      const todayRevenue = (sales || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

      stats.push({
        id: branch.id,
        name: branch.name,
        address: branch.address,
        todaySales: sales?.length || 0,
        todayRevenue,
        isWarehouse: branch.is_warehouse || false,
      });
    }

    setBranchStats(stats.sort((a, b) => b.todayRevenue - a.todayRevenue));
  }, [merchant]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchMetrics(),
      fetchSalesChart(),
      fetchRecentSales(),
      fetchBranchStats(),
    ]);
    setLoading(false);
  }, [fetchMetrics, fetchSalesChart, fetchRecentSales, fetchBranchStats]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    metrics,
    salesChart,
    recentSales,
    branchStats,
    loading,
    refresh: fetchAll,
  };
}
