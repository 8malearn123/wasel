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
  /** 'shifts' = summed from the day's shifts by close_day(); 'manual' = closed by the old page. */
  source: 'manual' | 'shifts';
  shifts_count: number | null;
  opening_cash: number | null;
  cash_in: number | null;
  cash_out: number | null;
  expenses: number | null;
  expected_cash: number | null;
  closed_at: string | null;
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

/** daily_summary() result. Expected / difference are null for cashiers until the shifts are approved. */
export interface DaySummary {
  date: string;
  branch_id: string;
  shift_counts: { total: number; open: number; pending: number; closed: number };
  shifts: {
    id: string;
    shift_no: number;
    status: 'open' | 'pending_approval' | 'closed';
    opened_at: string;
    closed_at: string | null;
    opened_by_name: string | null;
    opening_cash: number;
    cash_sales: number;
    cash_in: number;
    cash_out: number;
    expenses: number;
    expected_cash: number | null;
    counted_cash: number | null;
    difference: number | null;
  }[];
  cash: {
    opening: number;
    sales: number;
    cash_in: number;
    cash_out: number;
    expenses: number;
    expected: number | null;
    counted: number | null;
    difference: number | null;
  };
  sales: { count: number; total: number; tax: number; discount: number; outside_shifts: number };
  tenders: { cash: number; card: number; bank_transfer: number };
  by_method: { method: string; amount: number }[];
  devices_sold: number;
  accessories_sold: number;
  items: {
    name: string;
    type: 'device' | 'accessory';
    quantity: number;
    unit_price: number;
    total: number;
    payment_method: string;
    invoice_number: string;
    customer_name: string | null;
    sale_time: string;
  }[];
  closing: {
    status: string;
    source: 'manual' | 'shifts';
    closed_at: string | null;
    closed_by_name: string | null;
    cash_counted: number | null;
    cash_difference: number | null;
    notes: string | null;
  } | null;
  /** Why the day can't be closed now: NO_SHIFTS, OPEN_SHIFTS, PENDING_SHIFTS, MANAGER_REQUIRED, ALREADY_CLOSED. */
  blockers: string[];
  can_close: boolean;
}

/** Shapes a day summary for the charts and tables of the closing page. */
export function toDaySalesData(s: DaySummary): DaySalesData {
  return {
    cashTotal: Number(s.tenders.cash),
    cardTotal: Number(s.tenders.card),
    bankTransferTotal: Number(s.tenders.bank_transfer),
    totalSales: Number(s.sales.total),
    totalTax: Number(s.sales.tax),
    totalDiscount: Number(s.sales.discount),
    transactionsCount: s.sales.count,
    devicesSold: s.devices_sold,
    accessoriesSold: s.accessories_sold,
    soldItems: s.items.map((i) => ({
      name: i.name,
      type: i.type,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      total: Number(i.total),
      paymentMethod: i.payment_method,
      invoiceNumber: i.invoice_number,
      customerName: i.customer_name || undefined,
      saleTime: i.sale_time,
    })),
  };
}

/**
 * The daily closing is the sum of the branch's shifts for a business day (Asia/Riyadh).
 * Figures come from daily_summary(); closing goes through close_day() (managers, after
 * every shift is approved).
 */
export function useDailyClosings() {
  const { merchant, currentBranch } = useAuth();
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosings = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    try {
      let query = supabase
        .from('daily_closings')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('closing_date', { ascending: false })
        .limit(30);
      if (currentBranch) query = query.eq('branch_id', currentBranch.id);

      const { data, error } = await query;
      if (error) throw error;
      setClosings((data || []) as unknown as DailyClosing[]);
    } catch (err) {
      console.error('Error fetching closings:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant, currentBranch]);

  useEffect(() => {
    fetchClosings();
  }, [fetchClosings]);

  const fetchDaySummary = useCallback(async (date: string): Promise<DaySummary | null> => {
    if (!currentBranch) return null;
    const { data, error } = await supabase.rpc('daily_summary', { _branch_id: currentBranch.id, _date: date });
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data as unknown as DaySummary;
  }, [currentBranch]);

  const closeDay = async (date: string, notes: string): Promise<DaySummary | null> => {
    if (!currentBranch) return null;
    const { data, error } = await supabase.rpc('close_day', {
      _branch_id: currentBranch.id,
      _date: date,
      _notes: notes || undefined,
    });
    if (error) {
      toast.error(error.message);
      return null;
    }
    toast.success('تم إغلاق اليوم بنجاح');
    await fetchClosings();
    return data as unknown as DaySummary;
  };

  return { closings, loading, fetchClosings, fetchDaySummary, closeDay };
}
