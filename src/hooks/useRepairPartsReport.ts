import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PartsConsumptionItem {
  partName: string;
  partSku: string;
  totalUsed: number;
  totalCost: number;
  repairCount: number;
}

export interface DailyPartsUsage {
  date: string;
  totalParts: number;
  totalCost: number;
}

export function useRepairPartsReport() {
  const { merchant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderParts, setOrderParts] = useState<any[]>([]);
  const [repairParts, setRepairParts] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);

    const [partsRes, orderPartsRes] = await Promise.all([
      supabase
        .from('repair_parts')
        .select('id, name, sku, cost, quantity, min_quantity')
        .eq('merchant_id', merchant.id),
      supabase
        .from('repair_order_parts')
        .select('*, repair_part:repair_parts(name, sku, merchant_id), repair_order:repair_orders(merchant_id, created_at)')
        .order('created_at', { ascending: false })
    ]);

    setRepairParts((partsRes.data || []) as any[]);
    // Filter to merchant's data
    const filtered = (orderPartsRes.data || []).filter(
      (op: any) => op.repair_order?.merchant_id === merchant.id
    );
    setOrderParts(filtered);
    setLoading(false);
  }, [merchant]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getConsumptionByPart = useCallback((): PartsConsumptionItem[] => {
    const map = new Map<string, PartsConsumptionItem>();

    for (const op of orderParts) {
      const key = op.repair_part_id;
      const existing = map.get(key) || {
        partName: op.repair_part?.name || 'غير معروف',
        partSku: op.repair_part?.sku || '',
        totalUsed: 0,
        totalCost: 0,
        repairCount: 0,
      };
      existing.totalUsed += op.quantity;
      existing.totalCost += op.quantity * Number(op.unit_cost);
      existing.repairCount++;
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.totalUsed - a.totalUsed);
  }, [orderParts]);

  const getDailyUsage = useCallback((days: number = 30): DailyPartsUsage[] => {
    const map = new Map<string, DailyPartsUsage>();
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      map.set(dateStr, { date: dateStr, totalParts: 0, totalCost: 0 });
    }

    for (const op of orderParts) {
      const dateStr = new Date(op.created_at).toISOString().split('T')[0];
      const entry = map.get(dateStr);
      if (entry) {
        entry.totalParts += op.quantity;
        entry.totalCost += op.quantity * Number(op.unit_cost);
      }
    }

    return Array.from(map.values()).reverse();
  }, [orderParts]);

  const getSummary = useCallback(() => {
    const totalPartsUsed = orderParts.reduce((s, op) => s + op.quantity, 0);
    const totalCost = orderParts.reduce((s, op) => s + op.quantity * Number(op.unit_cost), 0);
    const lowStockParts = repairParts.filter(p => p.quantity <= (p.min_quantity || 5));
    const outOfStockParts = repairParts.filter(p => p.quantity === 0);

    return {
      totalPartsUsed,
      totalCost,
      totalRepairsWithParts: new Set(orderParts.map(op => op.repair_order_id)).size,
      lowStockCount: lowStockParts.length,
      outOfStockCount: outOfStockParts.length,
      avgCostPerRepair: orderParts.length > 0 ? totalCost / new Set(orderParts.map(op => op.repair_order_id)).size : 0,
    };
  }, [orderParts, repairParts]);

  return {
    loading,
    getConsumptionByPart,
    getDailyUsage,
    getSummary,
    refetch: fetchData,
  };
}
