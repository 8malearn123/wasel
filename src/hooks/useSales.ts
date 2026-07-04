import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Sale, SaleItem, Device, Accessory, PaymentMethod } from '@/types/database';
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

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxAmount = subtotal * 0.15; // 15% VAT
    const totalAmount = subtotal + taxAmount - discountAmount;

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
        discount_amount: discountAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: 'paid',
        sold_by: user.id
      })
      .select()
      .single();

    if (saleError) {
      toast.error(saleError.message);
      return { error: saleError };
    }

    // Create sale items and update inventory
    for (const item of cart) {
      // Create sale item
      await supabase
        .from('sale_items')
        .insert({
          sale_id: sale.id,
          device_id: item.type === 'device' ? item.deviceId : null,
          accessory_id: item.type === 'accessory' ? item.accessoryId : null,
          quantity: item.quantity,
          unit_price: item.price,
          cost_at_sale: item.cost
        });

      // Update inventory
      if (item.type === 'device' && item.deviceId) {
        await supabase
          .from('devices')
          .update({ status: 'sold' })
          .eq('id', item.deviceId);
      } else if (item.type === 'accessory' && item.accessoryId) {
        // Decrement accessory quantity
        const { data: acc } = await supabase
          .from('accessories')
          .select('quantity')
          .eq('id', item.accessoryId)
          .single();
        
        if (acc) {
          await supabase
            .from('accessories')
            .update({ quantity: Math.max(0, acc.quantity - item.quantity) })
            .eq('id', item.accessoryId);
        }
      }
    }

    await fetchSales();
    toast.success(`Sale completed! Invoice: ${invoiceNumber}`);
    
    return { data: sale, error: null };
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

  const updateSale = async (saleId: string, updates: { customer_name?: string; customer_phone?: string; discount_amount?: number; notes?: string }) => {
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
