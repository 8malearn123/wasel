import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface DailyClosing {
  id: string;
  merchant_id: string;
  branch_id: string;
  closing_date: string;
  cash_sales: number;
  card_sales: number;
  bank_transfer_sales: number;
  total_sales: number;
  total_tax: number;
  total_discount: number;
  transactions_count: number;
  devices_sold: number;
  accessories_sold: number;
  cash_counted: number | null;
  cash_difference: number | null;
  notes: string | null;
  closed_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DaySalesData {
  cashTotal: number;
  cardTotal: number;
  bankTransferTotal: number;
  totalSales: number;
  totalTax: number;
  totalDiscount: number;
  transactionsCount: number;
  devicesSold: number;
  accessoriesSold: number;
  soldItems: SoldItem[];
}

export interface SoldItem {
  name: string;
  type: 'device' | 'accessory';
  quantity: number;
  unitPrice: number;
  total: number;
  paymentMethod: string;
  invoiceNumber: string;
  customerName?: string;
  saleTime: string;
}

export function useDailyClosings() {
  const { merchant, currentBranch, user } = useAuth();
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosings = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_closings')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('closing_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setClosings((data || []) as DailyClosing[]);
    } catch (err) {
      console.error('Error fetching closings:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchClosings();
  }, [fetchClosings]);

  const fetchDaySalesData = useCallback(async (date: string): Promise<DaySalesData> => {
    if (!merchant || !currentBranch) {
      return { cashTotal: 0, cardTotal: 0, bankTransferTotal: 0, totalSales: 0, totalTax: 0, totalDiscount: 0, transactionsCount: 0, devicesSold: 0, accessoriesSold: 0, soldItems: [] };
    }

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data: sales, error } = await supabase
      .from('sales')
      .select('*, items:sale_items(*, device:devices(*), accessory:accessories(*))')
      .eq('merchant_id', merchant.id)
      .eq('branch_id', currentBranch.id)
      .gte('sale_date', startOfDay)
      .lte('sale_date', endOfDay)
      .order('sale_date', { ascending: true });

    if (error) {
      console.error('Error fetching day sales:', error);
      return { cashTotal: 0, cardTotal: 0, bankTransferTotal: 0, totalSales: 0, totalTax: 0, totalDiscount: 0, transactionsCount: 0, devicesSold: 0, accessoriesSold: 0, soldItems: [] };
    }

    let cashTotal = 0, cardTotal = 0, bankTransferTotal = 0;
    let totalTax = 0, totalDiscount = 0;
    let devicesSold = 0, accessoriesSold = 0;
    const soldItems: SoldItem[] = [];

    for (const sale of (sales || [])) {
      const amount = Number(sale.total_amount);
      if (sale.payment_method === 'cash') cashTotal += amount;
      else if (sale.payment_method === 'card') cardTotal += amount;
      else if (sale.payment_method === 'bank_transfer') bankTransferTotal += amount;
      else if (sale.payment_method === 'mixed') {
        cashTotal += amount / 2;
        cardTotal += amount / 2;
      }

      totalTax += Number(sale.tax_amount || 0);
      totalDiscount += Number(sale.discount_amount || 0);

      const items = (sale as any).items || [];
      for (const item of items) {
        const isDevice = !!item.device_id;
        if (isDevice) devicesSold += item.quantity;
        else accessoriesSold += item.quantity;

        const deviceData = item.device;
        const accessoryData = item.accessory;

        soldItems.push({
          name: isDevice
            ? `${deviceData?.brand || ''} ${deviceData?.model || ''}`.trim() || 'جهاز'
            : accessoryData?.name || 'إكسسوار',
          type: isDevice ? 'device' : 'accessory',
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          total: Number(item.unit_price) * item.quantity,
          paymentMethod: sale.payment_method,
          invoiceNumber: sale.invoice_number,
          customerName: sale.customer_name || undefined,
          saleTime: sale.sale_date,
        });
      }
    }

    return {
      cashTotal,
      cardTotal,
      bankTransferTotal,
      totalSales: cashTotal + cardTotal + bankTransferTotal,
      totalTax,
      totalDiscount,
      transactionsCount: (sales || []).length,
      devicesSold,
      accessoriesSold,
      soldItems,
    };
  }, [merchant, currentBranch]);

  const createClosing = async (date: string, data: DaySalesData, cashCounted: number | null, notes: string) => {
    if (!merchant || !currentBranch || !user) return { error: 'Missing data' };

    const cashDifference = cashCounted !== null ? cashCounted - data.cashTotal : null;

    const { error } = await supabase
      .from('daily_closings')
      .upsert({
        merchant_id: merchant.id,
        branch_id: currentBranch.id,
        closing_date: date,
        cash_sales: data.cashTotal,
        card_sales: data.cardTotal,
        bank_transfer_sales: data.bankTransferTotal,
        total_sales: data.totalSales,
        total_tax: data.totalTax,
        total_discount: data.totalDiscount,
        transactions_count: data.transactionsCount,
        devices_sold: data.devicesSold,
        accessories_sold: data.accessoriesSold,
        cash_counted: cashCounted,
        cash_difference: cashDifference,
        notes: notes || null,
        closed_by: user.id,
        status: 'closed',
      }, { onConflict: 'branch_id,closing_date' });

    if (error) {
      toast.error(error.message);
      return { error: error.message };
    }

    toast.success('تم إغلاق اليوم بنجاح');
    await fetchClosings();
    return { error: null };
  };

  return { closings, loading, fetchClosings, fetchDaySalesData, createClosing };
}
