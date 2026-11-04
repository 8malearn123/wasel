import { amountProblem } from '@/lib/amounts';
import { columnsOnly } from '@/lib/rowColumns';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseStatus, PaymentStatus } from '@/types/database';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/errors';

interface PurchaseItem {
  type: 'device' | 'accessory';
  quantity: number;
  unitCost: number;
  // For devices
  imei?: string;
  model?: string;
  brand?: string;
  color?: string;
  storage?: string;
  price?: number;
  // Catalog reference for devices (an existing device row of the same model)
  deviceId?: string;
  // For accessories
  accessoryId?: string;
}

export function useSuppliers() {
  const { merchant } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSuppliers = useCallback(async () => {
    if (!merchant) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('name');

      if (error) throw error;
      setSuppliers((data || []) as Supplier[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const addSupplier = async (supplier: Omit<Supplier, 'id' | 'merchant_id' | 'created_at' | 'updated_at' | 'balance'>) => {
    if (!merchant) return { error: new Error('No merchant') };

    const { data, error } = await supabase
      .from('suppliers')
      .insert({ ...supplier, merchant_id: merchant.id, balance: 0 })
      .select()
      .single();

    if (!error) {
      await fetchSuppliers();
      toast.success('تمت إضافة المورد');
    } else {
      toast.error(friendlyError(error));
    }

    return { data, error };
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      await fetchSuppliers();
      toast.success('تم تحديث المورد');
    } else {
      toast.error(friendlyError(error));
    }

    return { data, error };
  };

  const deleteSupplier = async (id: string) => {
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: false })
      .eq('id', id);

    if (!error) {
      await fetchSuppliers();
      toast.success('تم حذف المورد');
    } else {
      toast.error(friendlyError(error));
    }

    return { error };
  };

  return {
    suppliers,
    loading,
    error,
    refetch: fetchSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier
  };
}

export function usePurchaseOrders() {
  const { merchant, currentBranch, user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!merchant) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(*), branch:branches(*), items:purchase_order_items(*, device:devices(*), accessory:accessories(*))')
        .eq('merchant_id', merchant.id)
        .order('order_date', { ascending: false });

      if (error) throw error;
      setOrders((data || []) as PurchaseOrder[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching purchase orders:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const createPurchaseOrder = async (
    supplierId: string,
    items: PurchaseItem[],
    notes?: string
  ) => {
    if (!merchant || !currentBranch || !user) {
      return { error: new Error('Missing merchant, branch, or user') };
    }

    for (const item of items) {
      const invalid = amountProblem([
        { label: 'الكمية', value: item.quantity, min: 1, integer: true },
        { label: 'تكلفة الوحدة', value: item.unitCost },
      ]);
      if (invalid) { toast.error(invalid); return { error: new Error(invalid) }; }
    }

    const totalAmount = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);

    // Generate PO number
    const { data: orderNumber } = await supabase
      .rpc('generate_po_number', { _merchant_id: merchant.id });

    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .insert({
        merchant_id: merchant.id,
        supplier_id: supplierId,
        branch_id: currentBranch.id,
        order_number: orderNumber || `PO-${Date.now()}`,
        status: 'draft',
        payment_status: 'unpaid',
        total_amount: totalAmount,
        paid_amount: 0,
        notes,
        created_by: user.id
      })
      .select()
      .single();

    if (orderError) {
      toast.error(friendlyError(orderError));
      return { error: orderError };
    }

    // Persist order lines referencing the actual inventory products
    const itemRows = items.map(item => ({
      purchase_order_id: order.id,
      accessory_id: item.type === 'accessory' ? item.accessoryId ?? null : null,
      device_id: item.type === 'device' ? item.deviceId ?? null : null,
      quantity: item.quantity,
      unit_cost: item.unitCost,
    }));
    if (itemRows.length > 0) {
      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemRows);
      if (itemsError) console.error('Error saving purchase order items:', itemsError);
    }

    await fetchOrders();
    toast.success(`تم إنشاء أمر الشراء ${order.order_number}`);

    return { data: order, error: null };
  };

  const updateOrderStatus = async (orderId: string, status: PurchaseStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { error: new Error('Order not found') };

    const updates: Partial<PurchaseOrder> = { status };

    if (status === 'received') {
      updates.received_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('purchase_orders')
      .update(columnsOnly(updates))
      .eq('id', orderId);

    if (error) {
      toast.error(friendlyError(error));
      return { error };
    }

    await fetchOrders();
    toast.success(({ draft: 'تم حفظ أمر الشراء كمسودة', pending: 'أمر الشراء بانتظار الاعتماد', approved: 'تم اعتماد أمر الشراء', received: 'تم استلام أمر الشراء', cancelled: 'تم إلغاء أمر الشراء' } as Record<string, string>)[status] ?? 'تم تحديث أمر الشراء');
    
    return { error: null };
  };

  const recordPayment = async (orderId: string, amount: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { error: new Error('Order not found') };

    const newPaidAmount = Number(order.paid_amount) + amount;
    const paymentStatus: PaymentStatus = 
      newPaidAmount >= Number(order.total_amount) ? 'paid' :
      newPaidAmount > 0 ? 'partial' : 'unpaid';

    const { error } = await supabase
      .from('purchase_orders')
      .update({ 
        paid_amount: newPaidAmount,
        payment_status: paymentStatus
      })
      .eq('id', orderId);

    if (error) {
      toast.error(friendlyError(error));
      return { error };
    }

    // Update supplier balance
    const remaining = Number(order.total_amount) - newPaidAmount;
    const { error: balanceError } = await supabase
      .from('suppliers')
      .update({ balance: remaining })
      .eq('id', order.supplier_id);

    await fetchOrders();
    if (balanceError) {
      toast.warning(`سُجّلت الدفعة على أمر الشراء، لكن تعذّر تحديث رصيد المورد: ${friendlyError(balanceError)}`);
    } else {
      toast.success('تم تسجيل الدفعة');
    }
    
    return { error: null };
  };

  // Receive purchase and add to inventory
  const receivePurchase = async (
    orderId: string,
    items: PurchaseItem[],
    // استلام جزئي: نضيف المستلم للمخزون ونترك الطلب مفتوحاً للباقي
    opts?: { markReceived?: boolean; note?: string }
  ) => {
    if (!merchant || !currentBranch) {
      return { error: new Error('Missing merchant or branch') };
    }

    const order = orders.find(o => o.id === orderId);
    if (!order) return { error: new Error('Order not found') };

    // Orders created from the inventory picker already have their item rows;
    // don't insert them again on receipt.
    const hasExistingItems = (order.items?.length ?? 0) > 0;

    // Add items to inventory. Each write is checked: a refused device (an
    // IMEI already in stock, say) used to be skipped silently and the order
    // marked received anyway. Now the receipt stops there, says what was
    // added before it, and the order is not marked received.
    let added = 0;
    const stop = (err: unknown, what: string) => {
      toast.error(`توقّف الاستلام عند «${what}»${added ? ` بعد إضافة ${added} صنف للمخزون` : ''}، ولم يُعلَّم الطلب كمستلَم. ${friendlyError(err)}`, { duration: 10000 });
      void fetchOrders();
      return { error: err as Error };
    };
    for (const item of items) {
      if (item.type === 'device' && item.imei && item.model) {
        // Create device
        const { data: device, error: deviceError } = await supabase
          .from('devices')
          .insert({
            merchant_id: merchant.id,
            branch_id: currentBranch.id,
            imei: item.imei,
            model: item.model,
            brand: item.brand,
            color: item.color,
            storage: item.storage,
            cost: item.unitCost,
            price: item.price || item.unitCost * 1.3, // Default 30% markup
            status: 'available',
            supplier_id: order.supplier_id,
            purchase_id: orderId
          })
          .select()
          .single();
        if (deviceError) return stop(deviceError, `${item.model} (${item.imei})`);
        added++;

        if (device && !hasExistingItems) {
          const { error: lineError } = await supabase
            .from('purchase_order_items')
            .insert({
              purchase_order_id: orderId,
              device_id: device.id,
              quantity: 1,
              unit_cost: item.unitCost
            });
          if (lineError) return stop(lineError, `${item.model} (${item.imei})`);
        }
      } else if (item.type === 'accessory' && item.accessoryId) {
        // Update accessory quantity
        const { data: acc, error: readError } = await supabase
          .from('accessories')
          .select('quantity')
          .eq('id', item.accessoryId)
          .single();
        if (readError) return stop(readError, 'إكسسوار');

        if (acc) {
          const { error: qtyError } = await supabase
            .from('accessories')
            .update({ quantity: acc.quantity + item.quantity })
            .eq('id', item.accessoryId);
          if (qtyError) return stop(qtyError, 'إكسسوار');
          added++;
        }

        if (!hasExistingItems) {
          const { error: lineError } = await supabase
            .from('purchase_order_items')
            .insert({
              purchase_order_id: orderId,
              accessory_id: item.accessoryId,
              quantity: item.quantity,
              unit_cost: item.unitCost
            });
          if (lineError) return stop(lineError, 'إكسسوار');
        }
      }
    }

    // استلام كامل → الطلب مستلم · استلام جزئي → يظل مفتوحاً مع ملاحظة بالباقي
    if (opts?.markReceived === false) {
      if (opts?.note) {
        const prev = order.notes ? `${order.notes}\n` : '';
        const { error: noteError } = await supabase.from('purchase_orders').update({ notes: `${prev}${opts.note}` } as any).eq('id', orderId);
        if (noteError) toast.warning(`أُضيفت الكميات المستلمة، لكن تعذّر حفظ ملاحظة الباقي: ${friendlyError(noteError)}`);
      }
      await fetchOrders();
    } else {
      await updateOrderStatus(orderId, 'received');
    }

    return { error: null };
  };

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    createPurchaseOrder,
    updateOrderStatus,
    recordPayment,
    receivePurchase
  };
}
