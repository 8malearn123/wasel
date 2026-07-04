import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type RepairStatus = 'received' | 'diagnosing' | 'waiting_parts' | 'in_progress' | 'completed' | 'delivered' | 'cancelled' | 'warranty_expired';

export interface RepairOrder {
  id: string;
  merchant_id: string;
  branch_id: string | null;
  repair_number: string;
  customer_name: string;
  customer_phone: string | null;
  device_type: string;
  device_brand: string | null;
  device_model: string | null;
  device_imei: string | null;
  device_color: string | null;
  issue_description: string;
  diagnosis_notes: string | null;
  status: RepairStatus;
  priority: string;
  estimated_cost: number;
  actual_cost: number;
  parts_cost: number;
  paid_amount: number;
  payment_status: string;
  received_at: string;
  estimated_completion: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  warranty_days: number;
  warranty_ends_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  branch?: { name: string } | null;
}

export interface CreateRepairInput {
  customer_name: string;
  customer_phone?: string;
  device_type: string;
  device_brand?: string;
  device_model?: string;
  device_imei?: string;
  device_color?: string;
  issue_description: string;
  priority?: string;
  estimated_cost?: number;
  warranty_days?: number;
  branch_id?: string;
  estimated_completion?: string;
  notes?: string;
}

export function useRepairs() {
  const { merchant, user, currentBranch } = useAuth();
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRepairs = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('repair_orders')
      .select('*, branch:branches(name)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching repairs:', error);
    } else {
      // Check warranty expiry on delivered repairs
      const now = new Date();
      const repairsData = (data as any[]) || [];
      const expiredIds: string[] = [];

      const processed = repairsData.map(r => {
        if (r.status === 'delivered' && r.warranty_ends_at && new Date(r.warranty_ends_at) < now) {
          expiredIds.push(r.id);
          return { ...r, status: 'warranty_expired' as RepairStatus };
        }
        return r;
      });

      // Update expired warranties in DB
      if (expiredIds.length > 0) {
        await supabase
          .from('repair_orders')
          .update({ status: 'warranty_expired' } as any)
          .in('id', expiredIds);
      }

      setRepairs(processed);
    }
    setLoading(false);
  }, [merchant]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  const createRepair = async (input: CreateRepairInput) => {
    if (!merchant || !user) return { error: new Error('Not authenticated') };

    const { data: repairNum } = await supabase.rpc('generate_repair_number', {
      _merchant_id: merchant.id,
    });

    const { data, error } = await supabase
      .from('repair_orders')
      .insert({
        merchant_id: merchant.id,
        branch_id: input.branch_id || currentBranch?.id || null,
        repair_number: repairNum || `RPR-${Date.now()}`,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone || null,
        device_type: input.device_type,
        device_brand: input.device_brand || null,
        device_model: input.device_model || null,
        device_imei: input.device_imei || null,
        device_color: input.device_color || null,
        issue_description: input.issue_description,
        priority: input.priority || 'normal',
        estimated_cost: input.estimated_cost || 0,
        warranty_days: input.warranty_days || 0,
        estimated_completion: input.estimated_completion || null,
        notes: input.notes || null,
        created_by: user.id,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('تم إنشاء طلب الإصلاح بنجاح');
      await fetchRepairs();
    }
    return { data, error };
  };

  const updateRepairStatus = async (id: string, status: RepairStatus) => {
    const updates: any = { status };
    if (status === 'completed') updates.completed_at = new Date().toISOString();
    if (status === 'delivered') {
      updates.delivered_at = new Date().toISOString();
      // Calculate warranty end date
      const repair = repairs.find(r => r.id === id);
      if (repair && repair.warranty_days > 0) {
        const warrantyEnd = new Date();
        warrantyEnd.setDate(warrantyEnd.getDate() + repair.warranty_days);
        updates.warranty_ends_at = warrantyEnd.toISOString();
      }
    }

    const { error } = await supabase
      .from('repair_orders')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('تم تحديث حالة الإصلاح');
      await fetchRepairs();
    }
    return { error };
  };

  const updateRepair = async (id: string, updates: Partial<RepairOrder>) => {
    const { error } = await supabase
      .from('repair_orders')
      .update(updates as any)
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('تم تحديث بيانات الإصلاح');
      await fetchRepairs();
    }
    return { error };
  };

  const deleteRepair = async (id: string) => {
    const { error } = await supabase
      .from('repair_orders')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('تم حذف طلب الإصلاح');
      await fetchRepairs();
    }
    return { error };
  };

  return {
    repairs,
    loading,
    refetch: fetchRepairs,
    createRepair,
    updateRepairStatus,
    updateRepair,
    deleteRepair,
  };
}
