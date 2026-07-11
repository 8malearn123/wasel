import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseStatus, PaymentStatus } from '@/types/database';
import { toast } from 'sonner';

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
      toast.success('Supplier added');
    } else {
      toast.error(error.message);
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
      toast.success('Supplier updated');
    } else {
      toast.error(error.message);
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
      toast.success('Supplier removed');
    } else {
      toast.error(error.message);
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
      toast.error(orderError.message);
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
    toast.success(`Purchase order created: ${order.order_number}`);

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
      .update(updates)
      .eq('id', orderId);

    if (error) {
      toast.error(error.message);
      return { error };
    }

    await fetchOrders();
    toast.success(`Order ${status}`);
    
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
      toast.error(error.message);
      return { error };
    }

    // Update supplier balance
    const remaining = Number(order.total_amount) - newPaidAmount;
    await supabase
      .from('suppliers')
      .update({ balance: remaining })
      .eq('id', order.supplier_id);

    await fetchOrders();
    toast.success('Payment recorded');
    
    return { error: null };
  };

  // Receive purchase and add to inventory
  const receivePurchase = async (
    orderId: string,
    items: PurchaseItem[]
  ) => {
    if (!merchant || !currentBranch) {
      return { error: new Error('Missing merchant or branch') };
    }

    const order = orders.find(o => o.id === orderId);
    if (!order) return { error: new Error('Order not found') };

    // Orders created from the inventory picker already have their item rows;
    // don't insert them again on receipt.
    const hasExistingItems = (order.items?.length ?? 0) > 0;

    // Add items to inventory
    for (const item of items) {
      if (item.type === 'device' && item.imei && item.model) {
        // Create device
        const { data: device } = await supabase
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

        if (device && !hasExistingItems) {
          await supabase
            .from('purchase_order_items')
            .insert({
              purchase_order_id: orderId,
              device_id: device.id,
              quantity: 1,
              unit_cost: item.unitCost
            });
        }
      } else if (item.type === 'accessory' && item.accessoryId) {
        // Update accessory quantity
        const { data: acc } = await supabase
          .from('accessories')
          .select('quantity')
          .eq('id', item.accessoryId)
          .single();

        if (acc) {
          await supabase
            .from('accessories')
            .update({ quantity: acc.quantity + item.quantity })
            .eq('id', item.accessoryId);
        }

        if (!hasExistingItems) {
          await supabase
            .from('purchase_order_items')
            .insert({
              purchase_order_id: orderId,
              accessory_id: item.accessoryId,
              quantity: item.quantity,
              unit_cost: item.unitCost
            });
        }
      }
    }

    // Update order status
    await updateOrderStatus(orderId, 'received');
    
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
