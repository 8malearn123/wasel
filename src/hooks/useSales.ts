import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Sale, SaleItem, Device, Accessory, PaymentMethod } from '@/types/database';
import { toast } from 'sonner';
import { vatInclusive } from '@/lib/money';

interface CartItem {
  id: string;
  // 'service': a charge with no stock behind it, like delivery
  type: 'device' | 'accessory' | 'warranty' | 'service';
  name: string;
  identifier: string;
  price: number;
  cost: number;
  quantity: number;
  deviceId?: string;
  accessoryId?: string;
}

/**
 * A sale's lines as one insert. PostgREST takes a list only when every row has
 * the same columns, so a device line still names accessory_id (null) and the
 * other way round.
 */
export function saleLineRows(saleId: string, cart: CartItem[]) {
  return cart.map(item => ({
    sale_id: saleId,
    device_id: item.type === 'device' ? item.deviceId ?? null : null,
    accessory_id: item.type === 'accessory' ? item.accessoryId ?? null : null,
    quantity: item.quantity,
    unit_price: item.price,
    cost_at_sale: item.cost ?? null,
  }));
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
        .select('*, branch:branches(*), items:sale_items(*, device:devices(*), accessory:accessories(*))')
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

  const createSale = async (
    cart: CartItem[],
    paymentMethod: PaymentMethod,
    customerName?: string,
    customerPhone?: string,
    discountAmount: number = 0
  ) => {
    if (!merchant || !currentBranch || !user) {
      return { error: new Error('Missing merchant, branch, or user') };
    }

    // prices include VAT: the same split the cart and the invoice show
    const gross = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const { subtotal, tax: taxAmount, discount, total: totalAmount } = vatInclusive(gross, discountAmount);

    // Generate invoice number
    const { data: invoiceData } = await supabase
      .rpc('generate_invoice_number', { _merchant_id: merchant.id });
    
    const invoiceNumber = invoiceData || `INV-${Date.now()}`;

    // Create sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        merchant_id: merchant.id,
        branch_id: currentBranch.id,
        invoice_number: invoiceNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discount,
        total_amount: totalAmount,
        payment_method: paymentMethod === 'apple_pay' ? 'card' : paymentMethod,
        ...(paymentMethod === 'apple_pay' ? { notes: 'Apple Pay' } : {}),
        payment_status: 'paid',
        sold_by: user.id
      })
      .select()
      .single();

    if (saleError) {
      toast.error(saleError.message);
      return { error: saleError };
    }

    // The lines in one request, then the stock in parallel. This used to be
    // two or three requests per line, one after the other, followed by a
    // reload of the last 100 sales with their lines and products before the
    // till could say «done» — 8–10 seconds on a mobile connection.
    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleLineRows(sale.id, cart));

    if (itemsError) {
      // an invoice without its lines would count as revenue with nothing sold
      await supabase.from('sales').delete().eq('id', sale.id);
      toast.error(itemsError.message);
      return { error: itemsError };
    }

    const deviceIds = cart.filter(i => i.type === 'device' && i.deviceId).map(i => i.deviceId as string);
    const accessoryLines = cart.filter(i => i.type === 'accessory' && i.accessoryId);
    const stockUpdates: PromiseLike<unknown>[] = [];
    if (deviceIds.length) {
      stockUpdates.push(supabase.from('devices').update({ status: 'sold' }).in('id', deviceIds));
    }
    for (const item of accessoryLines) {
      stockUpdates.push((async () => {
        const { data: acc } = await supabase
          .from('accessories')
          .select('quantity')
          .eq('id', item.accessoryId as string)
          .single();
        if (acc) {
          await supabase
            .from('accessories')
            .update({ quantity: Math.max(0, acc.quantity - item.quantity) })
            .eq('id', item.accessoryId as string);
        }
      })());
    }
    await Promise.all(stockUpdates);

    // the history refreshes on its own; the sale is confirmed already
    void fetchSales();
    toast.success(`تمت عملية البيع — فاتورة ${invoiceNumber}`);

    return { data: sale, error: null };
  };

  // Every POS action worth seeing in the sales log. Best effort: a log that
  // fails must never take the sale down with it.
  const logSaleActivity = async (
    action: 'sale_edited' | 'sale_deleted' | 'sale_printed',
    sale: Pick<Sale, 'id' | 'invoice_number' | 'total_amount'>,
    details: Record<string, unknown> = {}
  ) => {
    if (!merchant || !user) return;
    try {
      await supabase.from('activity_logs').insert({
        merchant_id: merchant.id,
        user_id: user.id,
        action: `pos_${action}`,
        entity_type: 'sale',
        entity_id: sale.id,
        new_data: {
          invoice_number: sale.invoice_number,
          total_amount: Number(sale.total_amount),
          ...details,
        },
      } as any);
    } catch { /* السجل اختياري */ }
  };

  const markAsPrinted = async (saleId: string) => {
    const { error } = await supabase
      .from('sales')
      .update({ is_printed: true } as any)
      .eq('id', saleId);
    if (error) {
      console.error('Error marking as printed:', error);
    }
    const sale = sales.find(s => s.id === saleId);
    if (!error && sale) await logSaleActivity('sale_printed', sale);
    await fetchSales();
  };

  const updateSale = async (
    saleId: string,
    updates: {
      customer_name?: string;
      customer_phone?: string;
      discount_amount?: number;
      // what the sales table stores (Apple Pay is saved as 'card')
      payment_method?: Exclude<PaymentMethod, 'apple_pay'>;
      notes?: string;
    }
  ) => {
    // Check if sale is printed - only owner/admin can edit printed sales
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return { error: new Error('Sale not found') };

    const patch: typeof updates & { total_amount?: number; subtotal?: number; tax_amount?: number } = { ...updates };

    // A changed discount has to carry through to the invoice total, or the
    // stored total stops matching its own lines
    if (updates.discount_amount !== undefined) {
      // what the lines came to before any discount, as the customer saw it
      const gross = Number(sale.total_amount) + Number(sale.discount_amount || 0);
      const next = vatInclusive(gross, updates.discount_amount);
      patch.discount_amount = next.discount;
      patch.total_amount = next.total;
      patch.subtotal = next.subtotal;
      patch.tax_amount = next.tax;
    }

    const { error } = await supabase
      .from('sales')
      .update(patch)
      .eq('id', saleId);

    if (error) {
      toast.error(error.message);
      return { error };
    }

    await logSaleActivity('sale_edited', sale, { changed: Object.keys(updates) });
    await fetchSales();
    toast.success('تم تحديث الفاتورة');
    return { error: null };
  };

  const deleteSale = async (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return { error: new Error('Sale not found') };

    // Put the stock back before the invoice goes
    const { data: items, error: itemsError } = await supabase
      .from('sale_items')
      .select('device_id, accessory_id, quantity')
      .eq('sale_id', saleId);

    if (itemsError) {
      toast.error(itemsError.message);
      return { error: itemsError };
    }

    for (const item of items || []) {
      if (item.device_id) {
        await supabase
          .from('devices')
          .update({ status: 'available' })
          .eq('id', item.device_id);
      } else if (item.accessory_id) {
        const { data: accessory } = await supabase
          .from('accessories')
          .select('quantity')
          .eq('id', item.accessory_id)
          .single();

        if (accessory) {
          await supabase
            .from('accessories')
            .update({ quantity: accessory.quantity + item.quantity })
            .eq('id', item.accessory_id);
        }
      }
    }

    // sale_items are removed with the sale by the cascade on the foreign key
    const { error } = await supabase.from('sales').delete().eq('id', saleId);

    if (error) {
      toast.error(error.message);
      return { error };
    }

    await logSaleActivity('sale_deleted', sale, { items: items?.length ?? 0 });
    await fetchSales();
    toast.success('تم حذف الفاتورة وإرجاع الأصناف للمخزون');
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
    deleteSale,
    getStats
  };
}
