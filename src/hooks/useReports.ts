import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Sale, Device, Accessory, Branch } from '@/types/database';

interface SalesReport {
  date: string;
  totalSales: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  devicesSold: number;
  accessoriesSold: number;
}

interface InventoryReport {
  totalDevices: number;
  availableDevices: number;
  reservedDevices: number;
  soldDevices: number;
  totalAccessories: number;
  lowStockAccessories: number;
  deviceValue: number;
  accessoryValue: number;
}

interface BranchReport {
  branchId: string;
  branchName: string;
  totalSales: number;
  totalRevenue: number;
  deviceCount: number;
  accessoryCount: number;
}

interface ProfitByDevice {
  model: string;
  brand: string;
  unitsSold: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  margin: number;
}

interface EmployeePerformance {
  userId: string;
  userName: string;
  totalSales: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  margin: number;
  avgSaleValue: number;
  devicesSold: number;
  accessoriesSold: number;
}

export function useReports() {
  const { merchant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    try {
      const [salesRes, devicesRes, accessoriesRes, branchesRes, merchantUsersRes] = await Promise.all([
        supabase.from('sales')
          .select('*, items:sale_items(*, device:devices(*), accessory:accessories(*))')
          .eq('merchant_id', merchant.id)
          .order('sale_date', { ascending: false }),
        supabase.from('devices').select('*').eq('merchant_id', merchant.id),
        supabase.from('accessories').select('*').eq('merchant_id', merchant.id),
        supabase.from('branches').select('*').eq('merchant_id', merchant.id).eq('is_active', true),
        supabase.from('merchant_users').select('user_id, role').eq('merchant_id', merchant.id).eq('is_active', true)
      ]);

      setSalesData((salesRes.data || []) as Sale[]);
      setDevices((devicesRes.data || []) as Device[]);
      setAccessories((accessoriesRes.data || []) as Accessory[]);
      setBranches((branchesRes.data || []) as Branch[]);

      // Fetch profiles for employee names
      const userIds = (merchantUsersRes.data || []).map((u: any) => u.user_id);
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        const profileMap: Record<string, string> = {};
        (profilesData || []).forEach((p: any) => {
          profileMap[p.id] = p.full_name || 'Unknown';
        });
        setProfiles(profileMap);
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getDailySalesReport = useCallback((days: number = 30): SalesReport[] => {
    const reports: Map<string, SalesReport> = new Map();
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      reports.set(dateStr, { date: dateStr, totalSales: 0, totalRevenue: 0, totalCost: 0, profit: 0, devicesSold: 0, accessoriesSold: 0 });
    }
    for (const sale of salesData) {
      const dateStr = new Date(sale.sale_date).toISOString().split('T')[0];
      const report = reports.get(dateStr);
      if (report) {
        report.totalSales++;
        report.totalRevenue += Number(sale.total_amount);
        for (const item of (sale.items || [])) {
          report.totalCost += Number(item.cost_at_sale) * item.quantity;
          if (item.device_id) report.devicesSold++; else report.accessoriesSold += item.quantity;
        }
        report.profit = report.totalRevenue - report.totalCost;
      }
    }
    return Array.from(reports.values()).reverse();
  }, [salesData]);

  const getMonthlySalesReport = useCallback((months: number = 12): SalesReport[] => {
    const reports: Map<string, SalesReport> = new Map();
    const today = new Date();
    for (let i = 0; i < months; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      reports.set(dateStr, { date: dateStr, totalSales: 0, totalRevenue: 0, totalCost: 0, profit: 0, devicesSold: 0, accessoriesSold: 0 });
    }
    for (const sale of salesData) {
      const saleDate = new Date(sale.sale_date);
      const dateStr = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
      const report = reports.get(dateStr);
      if (report) {
        report.totalSales++;
        report.totalRevenue += Number(sale.total_amount);
        for (const item of (sale.items || [])) {
          report.totalCost += Number(item.cost_at_sale) * item.quantity;
          if (item.device_id) report.devicesSold++; else report.accessoriesSold += item.quantity;
        }
        report.profit = report.totalRevenue - report.totalCost;
      }
    }
    return Array.from(reports.values()).reverse();
  }, [salesData]);

  const getInventoryReport = useCallback((): InventoryReport => {
    const availableDevices = devices.filter(d => d.status === 'available');
    const reservedDevices = devices.filter(d => d.status === 'reserved');
    const soldDevices = devices.filter(d => d.status === 'sold');
    const lowStockAccessories = accessories.filter(a => a.quantity <= a.min_quantity);
    return {
      totalDevices: devices.length,
      availableDevices: availableDevices.length,
      reservedDevices: reservedDevices.length,
      soldDevices: soldDevices.length,
      totalAccessories: accessories.reduce((sum, a) => sum + a.quantity, 0),
      lowStockAccessories: lowStockAccessories.length,
      deviceValue: availableDevices.reduce((sum, d) => sum + Number(d.price), 0),
      accessoryValue: accessories.reduce((sum, a) => sum + Number(a.price) * a.quantity, 0)
    };
  }, [devices, accessories]);

  const getBranchReport = useCallback((): BranchReport[] => {
    return branches.map(branch => {
      const branchSales = salesData.filter(s => s.branch_id === branch.id);
      const branchDevices = devices.filter(d => d.branch_id === branch.id && d.status === 'available');
      const branchAccessories = accessories.filter(a => a.branch_id === branch.id);
      return {
        branchId: branch.id, branchName: branch.name,
        totalSales: branchSales.length,
        totalRevenue: branchSales.reduce((sum, s) => sum + Number(s.total_amount), 0),
        deviceCount: branchDevices.length,
        accessoryCount: branchAccessories.reduce((sum, a) => sum + a.quantity, 0)
      };
    });
  }, [branches, salesData, devices, accessories]);

  const getProfitByDevice = useCallback((): ProfitByDevice[] => {
    const modelMap: Map<string, ProfitByDevice> = new Map();
    for (const sale of salesData) {
      for (const item of (sale.items || [])) {
        if (item.device && item.device_id) {
          const key = `${item.device.brand}-${item.device.model}`;
          const existing = modelMap.get(key) || {
            model: item.device.model, brand: item.device.brand || 'Unknown',
            unitsSold: 0, totalRevenue: 0, totalCost: 0, profit: 0, margin: 0
          };
          existing.unitsSold++;
          existing.totalRevenue += Number(item.unit_price);
          existing.totalCost += Number(item.cost_at_sale);
          existing.profit = existing.totalRevenue - existing.totalCost;
          existing.margin = existing.totalRevenue > 0 ? (existing.profit / existing.totalRevenue) * 100 : 0;
          modelMap.set(key, existing);
        }
      }
    }
    return Array.from(modelMap.values()).sort((a, b) => b.profit - a.profit);
  }, [salesData]);

  const getEmployeePerformance = useCallback((): EmployeePerformance[] => {
    const empMap: Map<string, EmployeePerformance> = new Map();
    
    for (const sale of salesData) {
      if (!sale.sold_by) continue;
      const userId = sale.sold_by;
      const existing = empMap.get(userId) || {
        userId,
        userName: profiles[userId] || 'Unknown',
        totalSales: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0,
        margin: 0, avgSaleValue: 0, devicesSold: 0, accessoriesSold: 0
      };

      existing.totalSales++;
      existing.totalRevenue += Number(sale.total_amount);
      
      for (const item of (sale.items || [])) {
        existing.totalCost += Number(item.cost_at_sale) * item.quantity;
        if (item.device_id) existing.devicesSold++; else existing.accessoriesSold += item.quantity;
      }

      existing.totalProfit = existing.totalRevenue - existing.totalCost;
      existing.margin = existing.totalRevenue > 0 ? (existing.totalProfit / existing.totalRevenue) * 100 : 0;
      existing.avgSaleValue = existing.totalSales > 0 ? existing.totalRevenue / existing.totalSales : 0;
      
      empMap.set(userId, existing);
    }

    return Array.from(empMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [salesData, profiles]);

  const getSummaryStats = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const todaySales = salesData.filter(s => new Date(s.sale_date) >= today);
    const thisMonthSales = salesData.filter(s => new Date(s.sale_date) >= thisMonth);
    const lastMonthSales = salesData.filter(s => {
      const d = new Date(s.sale_date);
      return d >= lastMonth && d <= lastMonthEnd;
    });

    const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const thisMonthRevenue = thisMonthSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const lastMonthRevenue = lastMonthSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const revenueChange = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

    let todayProfit = 0, thisMonthProfit = 0;
    for (const sale of todaySales) {
      const cost = (sale.items || []).reduce((sum, i) => sum + Number(i.cost_at_sale) * i.quantity, 0);
      todayProfit += Number(sale.total_amount) - cost;
    }
    for (const sale of thisMonthSales) {
      const cost = (sale.items || []).reduce((sum, i) => sum + Number(i.cost_at_sale) * i.quantity, 0);
      thisMonthProfit += Number(sale.total_amount) - cost;
    }

    const inventory = getInventoryReport();
    return {
      todaySalesCount: todaySales.length, todayRevenue, todayProfit,
      thisMonthSalesCount: thisMonthSales.length, thisMonthRevenue, thisMonthProfit,
      revenueChange,
      inventoryValue: inventory.deviceValue + inventory.accessoryValue,
      availableDevices: inventory.availableDevices,
      lowStockItems: inventory.lowStockAccessories
    };
  }, [salesData, getInventoryReport]);

  return {
    loading, salesData, devices, accessories, branches,
    refetch: fetchData,
    getDailySalesReport, getMonthlySalesReport, getInventoryReport,
    getBranchReport, getProfitByDevice, getSummaryStats,
    getEmployeePerformance
  };
}
