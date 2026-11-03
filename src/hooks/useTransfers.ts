import { useState, useEffect, useCallback } from 'react';
import { columnsOnly } from '@/lib/rowColumns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { StockTransfer, StockTransferItem, TransferStatus } from '@/types/database';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/errors';

interface TransferItem {
  type: 'device' | 'accessory';
  id: string;
  quantity: number;
}

export function useTransfers() {
  const { merchant, user } = useAuth();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransfers = useCallback(async () => {
    if (!merchant) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          from_branch:branches!stock_transfers_from_branch_id_fkey(*),
          to_branch:branches!stock_transfers_to_branch_id_fkey(*),
          items:stock_transfer_items(*, device:devices(*), accessory:accessories(*))
        `)
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransfers((data || []) as StockTransfer[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching transfers:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const createTransfer = async (
    fromBranchId: string,
    toBranchId: string,
    items: TransferItem[],
    notes?: string
  ) => {
    if (!merchant || !user) {
      return { error: new Error('Missing merchant or user') };
    }

    // Generate transfer number
    const { data: transferNumber } = await supabase
      .rpc('generate_transfer_number', { _merchant_id: merchant.id });

    const { data: transfer, error: transferError } = await supabase
      .from('stock_transfers')
      .insert({
        merchant_id: merchant.id,
        transfer_number: transferNumber || `TRF-${Date.now()}`,
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        status: 'pending',
        notes,
        requested_by: user.id
      })
      .select()
      .single();

    if (transferError) {
      toast.error(friendlyError(transferError));
      return { error: transferError };
    }

    // The lines in one insert: a transfer without its lines is removed again
    // rather than left behind empty (it used to report success either way)
    const { error: itemsError } = await supabase
      .from('stock_transfer_items')
      .insert(items.map(item => ({
        transfer_id: transfer.id,
        device_id: item.type === 'device' ? item.id : null,
        accessory_id: item.type === 'accessory' ? item.id : null,
        quantity: item.quantity
      })));
    if (itemsError) {
      await supabase.from('stock_transfers').delete().eq('id', transfer.id);
      toast.error(friendlyError(itemsError));
      return { error: itemsError };
    }

    // Mark devices as transferred
    const deviceIds = items.filter(i => i.type === 'device').map(i => i.id);
    if (deviceIds.length > 0) {
      const { error: deviceError } = await supabase
        .from('devices')
        .update({ status: 'transferred' })
        .in('id', deviceIds);
      if (deviceError) {
        toast.warning(`أُنشئ طلب التحويل ${transfer.transfer_number}، لكن تعذّر تعليم الأجهزة كمحوّلة: ${friendlyError(deviceError)}`);
      }
    }

    await fetchTransfers();
    toast.success(`تم إنشاء طلب التحويل ${transfer.transfer_number}`);
    
    return { data: transfer, error: null };
  };

  const updateTransferStatus = async (transferId: string, status: TransferStatus) => {
    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) return { error: new Error('Transfer not found') };

    const updates: Partial<StockTransfer> = { status };
    
    if (status === 'approved' && user) {
      updates.approved_by = user.id;
    } else if (status === 'dispatched') {
      updates.dispatched_at = new Date().toISOString();
    } else if (status === 'received') {
      updates.received_at = new Date().toISOString();
      
      // Move items to destination branch. Several separate writes from the
      // browser — not one transaction (a server function would make it one;
      // see docs/API_CONTRACTS_PENDING.md). Each step is checked now, and the
      // transfer is NOT marked received if any of them failed, so the stock
      // screen and the transfer never disagree silently.
      const { data: items, error: itemsReadError } = await supabase
        .from('stock_transfer_items')
        .select('*, device:devices(*), accessory:accessories(*)')
        .eq('transfer_id', transferId);
      if (itemsReadError) {
        toast.error(friendlyError(itemsReadError));
        return { error: itemsReadError };
      }

      const stop = (err: unknown) => {
        toast.error(`توقّف استلام التحويل قبل اكتماله، ولم يُعلَّم كمستلَم. راجع كميات الفرعين قبل إعادة المحاولة. ${friendlyError(err)}`, { duration: 10000 });
        return { error: err as Error };
      };

      for (const item of items || []) {
        if (item.device_id) {
          const { error: e1 } = await supabase
            .from('devices')
            .update({ 
              branch_id: transfer.to_branch_id,
              status: 'available'
            })
            .eq('id', item.device_id);
          if (e1) return stop(e1);
        } else if (item.accessory_id) {
          // For accessories, we need to handle quantity transfers
          // Decrease from source branch, increase at destination
          const { data: sourceAcc, error: e2 } = await supabase
            .from('accessories')
            .select('quantity')
            .eq('id', item.accessory_id)
            .single();
          if (e2) return stop(e2);

          if (sourceAcc) {
            const { error: e3 } = await supabase
              .from('accessories')
              .update({ quantity: Math.max(0, sourceAcc.quantity - item.quantity) })
              .eq('id', item.accessory_id);
            if (e3) return stop(e3);
          }

          // Check if accessory exists at destination branch, if not create it
          const { data: destAcc, error: e4 } = await supabase
            .from('accessories')
            .select('*')
            .eq('merchant_id', transfer.merchant_id)
            .eq('branch_id', transfer.to_branch_id)
            .eq('sku', (item as any).accessory?.sku)
            .maybeSingle();
          if (e4) return stop(e4);

          if (destAcc) {
            const { error: e5 } = await supabase
              .from('accessories')
              .update({ quantity: destAcc.quantity + item.quantity })
              .eq('id', destAcc.id);
            if (e5) return stop(e5);
          } else if ((item as any).accessory) {
            const acc = (item as any).accessory;
            const { error: e6 } = await supabase
              .from('accessories')
              .insert({
                merchant_id: transfer.merchant_id,
                branch_id: transfer.to_branch_id,
                sku: acc.sku,
                name: acc.name,
                category: acc.category,
                brand: acc.brand,
                cost: acc.cost,
                price: acc.price,
                quantity: item.quantity,
                min_quantity: acc.min_quantity
              });
            if (e6) return stop(e6);
          }
        }
      }
    }

    const { error } = await supabase
      .from('stock_transfers')
      .update(columnsOnly(updates))
      .eq('id', transferId);

    if (error) {
      toast.error(friendlyError(error));
      return { error };
    }

    await fetchTransfers();
    const STATUS_AR: Record<string, string> = {
      approved: 'تم اعتماد التحويل', dispatched: 'تم شحن التحويل', received: 'تم استلام التحويل',
      cancelled: 'تم إلغاء التحويل', rejected: 'تم رفض التحويل', pending: 'تم تحديث التحويل',
    };
    toast.success(STATUS_AR[status] ?? 'تم تحديث التحويل');
    
    return { error: null };
  };

  return {
    transfers,
    loading,
    error,
    refetch: fetchTransfers,
    createTransfer,
    updateTransferStatus
  };
}
