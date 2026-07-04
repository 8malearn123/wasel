import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { StockTransfer, StockTransferItem, TransferStatus } from '@/types/database';
import { toast } from 'sonner';

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
      toast.error(transferError.message);
      return { error: transferError };
    }

    // Create transfer items
    for (const item of items) {
      await supabase
        .from('stock_transfer_items')
        .insert({
          transfer_id: transfer.id,
          device_id: item.type === 'device' ? item.id : null,
          accessory_id: item.type === 'accessory' ? item.id : null,
          quantity: item.quantity
        });

      // Mark devices as transferred
      if (item.type === 'device') {
        await supabase
          .from('devices')
          .update({ status: 'transferred' })
          .eq('id', item.id);
      }
    }

    await fetchTransfers();
    toast.success(`Transfer request created: ${transfer.transfer_number}`);
    
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
      
      // Move items to destination branch
      const { data: items } = await supabase
        .from('stock_transfer_items')
        .select('*, device:devices(*), accessory:accessories(*)')
        .eq('transfer_id', transferId);

      if (items) {
        for (const item of items) {
          if (item.device_id) {
            await supabase
              .from('devices')
              .update({ 
                branch_id: transfer.to_branch_id,
                status: 'available'
              })
              .eq('id', item.device_id);
          } else if (item.accessory_id) {
            // For accessories, we need to handle quantity transfers
            // Decrease from source branch, increase at destination
            const { data: sourceAcc } = await supabase
              .from('accessories')
              .select('quantity')
              .eq('id', item.accessory_id)
              .single();

            if (sourceAcc) {
              await supabase
                .from('accessories')
                .update({ quantity: Math.max(0, sourceAcc.quantity - item.quantity) })
                .eq('id', item.accessory_id);
            }

            // Check if accessory exists at destination branch, if not create it
            const { data: destAcc } = await supabase
              .from('accessories')
              .select('*')
              .eq('merchant_id', transfer.merchant_id)
              .eq('branch_id', transfer.to_branch_id)
              .eq('sku', (item as any).accessory?.sku)
              .maybeSingle();

            if (destAcc) {
              await supabase
                .from('accessories')
                .update({ quantity: destAcc.quantity + item.quantity })
                .eq('id', destAcc.id);
            } else if ((item as any).accessory) {
              const acc = (item as any).accessory;
              await supabase
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
            }
          }
        }
      }
    }

    const { error } = await supabase
      .from('stock_transfers')
      .update(updates)
      .eq('id', transferId);

    if (error) {
      toast.error(error.message);
      return { error };
    }

    await fetchTransfers();
    toast.success(`Transfer ${status}`);
    
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
