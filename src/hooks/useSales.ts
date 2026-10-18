import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Sale, PaymentMethod } from '@/types/database';
import type { PaymentLine } from '@/lib/payments';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  type: 'device' | 'accessory';
  name: string;
  identifier: string;
  price: number;
  cost: number;
  quantity: number;
  deviceId?: string;
  accessoryId?: string;
}

/** Authoritative totals returned by the pos_checkout RPC (all prices VAT-inclusive). */
export interface CheckoutResult {
  sale_id: string;
  invoice_number: string;
  sale_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  customer_id: string | null;
  vat_enabled: boolean;
}

export function useSales() {
  const { merchant, currentBranch, user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSales = useCallback(async () => {
    if (!merchant) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, branch:branches(*), items:sale_items(*, device:devices(*), accessory:accessories(*)), payments:sale_payments(*)')
        .eq('merchant_id', merchant.id)
        .order('sale_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setSales((data || []) as Sale[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  /**
   * Completes a POS sale atomically through the pos_checkout RPC: prices, VAT,
   * stock checks, invoice number, tender lines and the IMEI ledger are handled
   * server-side in one transaction. Any failure rolls everything back.
   */
  const createSale = async (
    cart: CartItem[],
    payments: PaymentLine[],
    customerName?: string,
    customerPhone?: string,
    discountAmount: number = 0,
    customerId?: string
  ): Promise<{ data: CheckoutResult | null; error: Error | null }> => {
    if (!merchant || !currentBranch || !user) {
      return { data: null, error: new Error('Missing merchant, branch, or user') };
    }

    const items = cart.map(item =>
      item.type === 'device'
        ? { type: 'device', id: item.deviceId }
        : { type: 'accessory', id: item.accessoryId, quantity: item.quantity }
    );

    const { data, error } = await supabase.rpc('pos_checkout', {
      _branch_id: currentBranch.id,
      _items: items,
      _payments: payments.map(p => ({ method: p.method, amount: p.amount, reference: p.reference })),
      _discount: discountAmount,
      _customer_id: customerId,
      _customer_name: customerName,
      _customer_phone: customerPhone,
    });

    if (error) {
      toast.error(error.message);
      return { data: null, error: new Error(error.message) };
    }

    const result = data as unknown as CheckoutResult;
    await fetchSales();
    toast.success(`Sale completed! Invoice: ${result.invoice_number}`);

    return { data: result, error: null };
  };

  const markAsPrinted = async (saleId: string) => {
    const { error } = await supabase
      .from('sales')
      .update({ is_printed: true } as any)
      .eq('id', saleId);
    if (error) {
      console.error('Error marking as printed:', error);
    }
    await fetchSales();
  };

  // Amounts are fixed by pos_checkout; only descriptive fields stay editable.
  const updateSale = async (saleId: string, updates: { customer_name?: string; customer_phone?: string; notes?: string }) => {
    // Check if sale is printed - only owner/admin can edit printed sales
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return { error: new Error('Sale not found') };

    const { error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', saleId);

    if (error) {
      toast.error(error.message);
      return { error };
    }

    await fetchSales();
    toast.success('تم تحديث الفاتورة');
    return { error: null };
  };

  // Get sales statistics
  const getStats = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const todaySales = sales.filter(s => new Date(s.sale_date) >= today);
    const monthSales = sales.filter(s => new Date(s.sale_date) >= thisMonth);

    return {
      todayCount: todaySales.length,
      todayRevenue: todaySales.reduce((sum, s) => sum + Number(s.total_amount), 0),
      monthCount: monthSales.length,
      monthRevenue: monthSales.reduce((sum, s) => sum + Number(s.total_amount), 0),
      totalCount: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + Number(s.total_amount), 0)
    };
  }, [sales]);

  return {
    sales,
    loading,
    error,
    refetch: fetchSales,
    createSale,
    markAsPrinted,
    updateSale,
    getStats
  };
}
