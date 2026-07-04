import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface WholesaleListing {
  id: string;
  merchant_id: string;
  device_id: string | null;
  accessory_id: string | null;
  item_type: string;
  wholesale_price: number;
  min_quantity: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  device?: { id: string; imei: string; model: string; brand: string | null; price: number; status: string } | null;
  accessory?: { id: string; name: string; sku: string; brand: string | null; price: number; quantity: number } | null;
  merchant?: { id: string; name: string; phone: string | null } | null;
}

export interface WholesaleOrder {
  id: string;
  order_number: string;
  supplier_merchant_id: string;
  buyer_merchant_id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  supplier_merchant?: { name: string } | null;
  buyer_merchant?: { name: string } | null;
}

export interface CreditTransaction {
  id: string;
  supplier_merchant_id: string;
  buyer_merchant_id: string;
  order_id: string | null;
  transaction_type: string;
  credit_type: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  paid_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  supplier_merchant?: { name: string } | null;
  buyer_merchant?: { name: string } | null;
}

export function useWholesale() {
  const { merchant, user } = useAuth();
  const [myListings, setMyListings] = useState<WholesaleListing[]>([]);
  const [marketplace, setMarketplace] = useState<WholesaleListing[]>([]);
  const [myOrders, setMyOrders] = useState<WholesaleOrder[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<WholesaleOrder[]>([]);
  const [myCredits, setMyCredits] = useState<CreditTransaction[]>([]);
  const [receivedCredits, setReceivedCredits] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);

    const [listingsRes, marketRes, buyerRes, supplierRes, creditsOutRes, creditsInRes] = await Promise.all([
      supabase.from('wholesale_listings').select('*, device:devices(id, imei, model, brand, price, status), accessory:accessories(id, name, sku, brand, price, quantity)').eq('merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('wholesale_listings').select('*, device:devices(id, imei, model, brand, price, status), accessory:accessories(id, name, sku, brand, price, quantity), merchant:merchants(id, name, phone)').eq('is_active', true).neq('merchant_id', merchant.id),
      supabase.from('wholesale_orders').select('*, supplier_merchant:merchants!wholesale_orders_supplier_merchant_id_fkey(name), buyer_merchant:merchants!wholesale_orders_buyer_merchant_id_fkey(name)').eq('buyer_merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('wholesale_orders').select('*, supplier_merchant:merchants!wholesale_orders_supplier_merchant_id_fkey(name), buyer_merchant:merchants!wholesale_orders_buyer_merchant_id_fkey(name)').eq('supplier_merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('wholesale_credit_transactions' as any).select('*, buyer_merchant:merchants!wholesale_credit_transactions_buyer_merchant_id_fkey(name)').eq('supplier_merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('wholesale_credit_transactions' as any).select('*, supplier_merchant:merchants!wholesale_credit_transactions_supplier_merchant_id_fkey(name)').eq('buyer_merchant_id', merchant.id).order('created_at', { ascending: false }),
    ]);

    setMyListings((listingsRes.data || []) as WholesaleListing[]);
    setMarketplace((marketRes.data || []) as WholesaleListing[]);
    setMyOrders((buyerRes.data || []) as WholesaleOrder[]);
    setIncomingOrders((supplierRes.data || []) as WholesaleOrder[]);
    setMyCredits((creditsOutRes.data || []) as unknown as CreditTransaction[]);
    setReceivedCredits((creditsInRes.data || []) as unknown as CreditTransaction[]);
    setLoading(false);
  }, [merchant]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createListing = async (data: { device_id?: string; accessory_id?: string; item_type: string; wholesale_price: number; min_quantity: number; notes?: string }) => {
    if (!merchant) return;
    const { error } = await supabase.from('wholesale_listings').insert({ merchant_id: merchant.id, ...data } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('تمت إضافة المنتج للبيع بالجملة');
    fetchAll();
  };

  const toggleListing = async (id: string, is_active: boolean) => {
    await supabase.from('wholesale_listings').update({ is_active } as any).eq('id', id);
    fetchAll();
  };

  const deleteListing = async (id: string) => {
    await supabase.from('wholesale_listings').delete().eq('id', id);
    toast.success('تم حذف المنتج');
    fetchAll();
  };

  const createOrder = async (listingId: string, quantity: number, listing: WholesaleListing, creditType?: 'invoice' | 'consignment', dueDate?: string) => {
    if (!merchant || !user) return;
    const orderNumber = `WO-${Date.now().toString(36).toUpperCase()}`;
    const totalAmount = listing.wholesale_price * quantity;

    const { data: order, error } = await supabase.from('wholesale_orders').insert({
      order_number: orderNumber,
      supplier_merchant_id: listing.merchant_id,
      buyer_merchant_id: merchant.id,
      total_amount: totalAmount,
      created_by: user.id,
    } as any).select().single();

    if (error) { toast.error(error.message); return; }

    await supabase.from('wholesale_order_items').insert({
      order_id: (order as any).id,
      listing_id: listingId,
      quantity,
      unit_price: listing.wholesale_price,
    } as any);

    // If credit type specified, create credit transaction
    if (creditType) {
      await supabase.from('wholesale_credit_transactions' as any).insert({
        supplier_merchant_id: listing.merchant_id,
        buyer_merchant_id: merchant.id,
        order_id: (order as any).id,
        transaction_type: 'credit',
        credit_type: creditType,
        amount: totalAmount,
        remaining_amount: totalAmount,
        due_date: dueDate || null,
        status: 'unpaid',
        created_by: user.id,
      } as any);
    }

    toast.success(`تم إرسال الطلب #${orderNumber}`);
    fetchAll();
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await supabase.from('wholesale_orders').update({ status } as any).eq('id', orderId);
    toast.success('تم تحديث حالة الطلب');
    fetchAll();
  };

  const recordPayment = async (creditId: string, amount: number) => {
    const credit = myCredits.find(c => c.id === creditId) || receivedCredits.find(c => c.id === creditId);
    if (!credit) return;

    const newPaid = credit.paid_amount + amount;
    const newRemaining = credit.amount - newPaid;
    const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

    await supabase.from('wholesale_credit_transactions' as any).update({
      paid_amount: newPaid,
      remaining_amount: Math.max(0, newRemaining),
      status: newStatus,
      paid_at: newRemaining <= 0 ? new Date().toISOString() : null,
    } as any).eq('id', creditId);

    toast.success('تم تسجيل الدفعة');
    fetchAll();
  };

  // Credit stats
  const getCreditStats = useCallback(() => {
    const totalOwed = myCredits.filter(c => c.status !== 'paid').reduce((s, c) => s + c.remaining_amount, 0);
    const totalOwing = receivedCredits.filter(c => c.status !== 'paid').reduce((s, c) => s + c.remaining_amount, 0);
    const overdueCount = myCredits.filter(c => c.due_date && new Date(c.due_date) < new Date() && c.status !== 'paid').length;
    return { totalOwed, totalOwing, overdueCount };
  }, [myCredits, receivedCredits]);

  return { myListings, marketplace, myOrders, incomingOrders, myCredits, receivedCredits, loading, createListing, toggleListing, deleteListing, createOrder, updateOrderStatus, recordPayment, getCreditStats, refetch: fetchAll };
}
