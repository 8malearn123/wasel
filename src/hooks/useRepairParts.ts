import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface RepairPart {
  id: string;
  merchant_id: string;
  branch_id: string | null;
  name: string;
  sku: string;
  category: string | null;
  brand: string | null;
  cost: number;
  price: number;
  quantity: number;
  min_quantity: number;
  compatible_models: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  branch?: { name: string } | null;
}

export interface RepairOrderPart {
  id: string;
  repair_order_id: string;
  repair_part_id: string;
  quantity: number;
  unit_cost: number;
  created_at: string;
  repair_part?: RepairPart | null;
}

export function useRepairParts() {
  const { merchant } = useAuth();
  const [parts, setParts] = useState<RepairPart[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchParts = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('repair_parts')
      .select('*, branch:branches(name)')
      .eq('merchant_id', merchant.id)
      .order('name');

    if (error) {
      console.error('Error fetching repair parts:', error);
    } else {
      setParts((data || []) as RepairPart[]);
    }
    setLoading(false);
  }, [merchant]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const addPart = async (part: Omit<RepairPart, 'id' | 'merchant_id' | 'created_at' | 'updated_at' | 'branch'>) => {
    if (!merchant) return { error: new Error('No merchant') };

    const { data, error } = await supabase
      .from('repair_parts')
      .insert({ ...part, merchant_id: merchant.id } as any)
      .select()
      .single();

    if (!error) {
      await fetchParts();
      toast.success('تم إضافة القطعة بنجاح');
    } else {
      toast.error(error.message);
    }
    return { data, error };
  };

  const updatePart = async (id: string, updates: Partial<RepairPart>) => {
    const { data, error } = await supabase
      .from('repair_parts')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      await fetchParts();
      toast.success('تم تحديث القطعة');
    } else {
      toast.error(error.message);
    }
    return { data, error };
  };

  const deletePart = async (id: string) => {
    const { error } = await supabase
      .from('repair_parts')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchParts();
      toast.success('تم حذف القطعة');
    } else {
      toast.error(error.message);
    }
    return { error };
  };

  // Use parts in a repair order - deduct from inventory
  const usePartsInRepair = async (repairOrderId: string, items: { partId: string; quantity: number }[]) => {
    for (const item of items) {
      const part = parts.find(p => p.id === item.partId);
      if (!part) continue;
      if (part.quantity < item.quantity) {
        toast.error(`الكمية غير كافية: ${part.name}`);
        return { error: new Error('Insufficient quantity') };
      }

      // Insert repair_order_parts record
      const { error: insertError } = await supabase
        .from('repair_order_parts')
        .insert({
          repair_order_id: repairOrderId,
          repair_part_id: item.partId,
          quantity: item.quantity,
          unit_cost: part.cost,
        } as any);

      if (insertError) {
        toast.error(insertError.message);
        return { error: insertError };
      }

      // Deduct quantity
      const { error: updateError } = await supabase
        .from('repair_parts')
        .update({ quantity: part.quantity - item.quantity } as any)
        .eq('id', item.partId);

      if (updateError) {
        toast.error(updateError.message);
        return { error: updateError };
      }
    }

    await fetchParts();
    toast.success('تم سحب القطع من المخزون');
    return { error: null };
  };

  // Get parts used in a specific repair order
  const getRepairOrderParts = async (repairOrderId: string): Promise<RepairOrderPart[]> => {
    const { data, error } = await supabase
      .from('repair_order_parts')
      .select('*, repair_part:repair_parts(*)')
      .eq('repair_order_id', repairOrderId);

    if (error) {
      console.error('Error fetching repair order parts:', error);
      return [];
    }
    return (data || []) as RepairOrderPart[];
  };

  return {
    parts,
    loading,
    refetch: fetchParts,
    addPart,
    updatePart,
    deletePart,
    usePartsInRepair,
    getRepairOrderParts,
  };
}
