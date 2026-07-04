import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type StocktakeStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type StocktakeItemType = 'device' | 'accessory' | 'repair_part';

export interface Stocktake {
  id: string;
  merchant_id: string;
  branch_id: string | null;
  stocktake_number: string;
  status: StocktakeStatus;
  item_types: StocktakeItemType[];
  notes: string | null;
  created_by: string | null;
  completed_by: string | null;
  started_at: string;
  completed_at: string | null;
  total_items: number;
  counted_items: number;
  discrepancy_count: number;
  created_at: string;
  updated_at: string;
  branch?: { name: string } | null;
}

export interface StocktakeItem {
  id: string;
  stocktake_id: string;
  item_type: StocktakeItemType;
  item_id: string;
  item_name: string;
  item_sku: string | null;
  system_quantity: number;
  counted_quantity: number | null;
  discrepancy: number;
  notes: string | null;
  counted_at: string | null;
  created_at: string;
}

export function useStocktake() {
  const { merchant, user } = useAuth();
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStocktakes = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('stocktakes')
      .select('*, branch:branches(name)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching stocktakes:', error);
    } else {
      setStocktakes((data || []) as unknown as Stocktake[]);
    }
    setLoading(false);
  }, [merchant]);

  useEffect(() => {
    fetchStocktakes();
  }, [fetchStocktakes]);

  const createStocktake = async (opts: {
    branch_id?: string;
    item_types: StocktakeItemType[];
    notes?: string;
  }) => {
    if (!merchant || !user) return null;

    // Generate number
    const { data: numData } = await supabase.rpc('generate_stocktake_number', {
      _merchant_id: merchant.id,
    });
    const stocktake_number = numData || `STK-${Date.now()}`;

    // Create stocktake
    const { data: stocktake, error } = await supabase
      .from('stocktakes')
      .insert({
        merchant_id: merchant.id,
        branch_id: opts.branch_id || null,
        stocktake_number,
        status: 'in_progress' as any,
        item_types: opts.item_types as any,
        notes: opts.notes || null,
        created_by: user.id,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return null;
    }

    // Populate items based on types
    const items: any[] = [];

    if (opts.item_types.includes('device')) {
      let q = supabase.from('devices').select('id, imei, model, brand, status')
        .eq('merchant_id', merchant.id)
        .in('status', ['available', 'reserved']);
      if (opts.branch_id) q = q.eq('branch_id', opts.branch_id);
      const { data: devices } = await q;
      
      for (const d of devices || []) {
        items.push({
          stocktake_id: (stocktake as any).id,
          item_type: 'device',
          item_id: d.id,
          item_name: `${d.brand || ''} ${d.model}`.trim(),
          item_sku: d.imei,
          system_quantity: 1,
        });
      }
    }

    if (opts.item_types.includes('accessory')) {
      let q = supabase.from('accessories').select('id, name, sku, quantity')
        .eq('merchant_id', merchant.id);
      if (opts.branch_id) q = q.eq('branch_id', opts.branch_id);
      const { data: accessories } = await q;
      
      for (const a of accessories || []) {
        items.push({
          stocktake_id: (stocktake as any).id,
          item_type: 'accessory',
          item_id: a.id,
          item_name: a.name,
          item_sku: a.sku,
          system_quantity: a.quantity,
        });
      }
    }

    if (opts.item_types.includes('repair_part')) {
      let q = supabase.from('repair_parts').select('id, name, sku, quantity')
        .eq('merchant_id', merchant.id);
      if (opts.branch_id) q = q.eq('branch_id', opts.branch_id);
      const { data: parts } = await q;
      
      for (const p of parts || []) {
        items.push({
          stocktake_id: (stocktake as any).id,
          item_type: 'repair_part',
          item_id: p.id,
          item_name: p.name,
          item_sku: p.sku,
          system_quantity: p.quantity,
        });
      }
    }

    if (items.length > 0) {
      await supabase.from('stocktake_items').insert(items as any);
      await supabase.from('stocktakes').update({
        total_items: items.length,
      } as any).eq('id', (stocktake as any).id);
    }

    await fetchStocktakes();
    toast.success(`تم إنشاء الجرد ${stocktake_number} (${items.length} عنصر)`);
    return stocktake;
  };

  const getStocktakeItems = async (stocktakeId: string): Promise<StocktakeItem[]> => {
    const { data, error } = await supabase
      .from('stocktake_items')
      .select('*')
      .eq('stocktake_id', stocktakeId)
      .order('item_type')
      .order('item_name');

    if (error) {
      console.error('Error:', error);
      return [];
    }
    return (data || []) as unknown as StocktakeItem[];
  };

  const updateItemCount = async (itemId: string, counted_quantity: number, notes?: string) => {
    const { error } = await supabase
      .from('stocktake_items')
      .update({
        counted_quantity,
        notes: notes || null,
        counted_at: new Date().toISOString(),
      } as any)
      .eq('id', itemId);

    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const finalizeStocktake = async (stocktakeId: string, adjustInventory: boolean) => {
    if (!user) return false;

    const items = await getStocktakeItems(stocktakeId);
    const countedItems = items.filter(i => i.counted_quantity !== null);
    const discrepancies = countedItems.filter(i => i.discrepancy !== 0);

    // Update stocktake summary
    await supabase.from('stocktakes').update({
      status: 'completed' as any,
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      counted_items: countedItems.length,
      discrepancy_count: discrepancies.length,
    } as any).eq('id', stocktakeId);

    // Adjust inventory if requested
    if (adjustInventory) {
      for (const item of discrepancies) {
        if (item.counted_quantity === null) continue;
        
        if (item.item_type === 'accessory') {
          await supabase.from('accessories')
            .update({ quantity: item.counted_quantity } as any)
            .eq('id', item.item_id);
        } else if (item.item_type === 'repair_part') {
          await supabase.from('repair_parts')
            .update({ quantity: item.counted_quantity } as any)
            .eq('id', item.item_id);
        }
        // Devices: if counted_quantity is 0, mark as missing (we skip for now)
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        merchant_id: merchant!.id,
        user_id: user.id,
        action: 'stocktake_completed',
        entity_type: 'stocktake',
        entity_id: stocktakeId,
        new_data: {
          total_items: items.length,
          counted_items: countedItems.length,
          discrepancies: discrepancies.length,
          inventory_adjusted: true,
        },
      } as any);
    }

    await fetchStocktakes();
    toast.success(adjustInventory 
      ? 'تم إنهاء الجرد وتعديل المخزون بنجاح' 
      : 'تم إنهاء الجرد بنجاح');
    return true;
  };

  const cancelStocktake = async (stocktakeId: string) => {
    await supabase.from('stocktakes').update({
      status: 'cancelled' as any,
    } as any).eq('id', stocktakeId);
    await fetchStocktakes();
    toast.success('تم إلغاء الجرد');
  };

  return {
    stocktakes,
    loading,
    refetch: fetchStocktakes,
    createStocktake,
    getStocktakeItems,
    updateItemCount,
    finalizeStocktake,
    cancelStocktake,
  };
}
