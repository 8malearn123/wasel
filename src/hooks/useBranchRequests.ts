import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface BranchRequest {
  id: string;
  merchant_id: string;
  requested_by: string;
  branch_name: string;
  city: string | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  invoice_amount: number | null;
  payment_confirmed: boolean;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useBranchRequests() {
  const { merchant, user } = useAuth();
  const [requests, setRequests] = useState<BranchRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    const { data } = await supabase
      .from('branch_requests')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    setRequests((data as any[]) || []);
    setLoading(false);
  }, [merchant]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const submitRequest = async (branchName: string, city: string, notes: string) => {
    if (!merchant || !user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('branch_requests')
      .insert({
        merchant_id: merchant.id,
        requested_by: user.id,
        branch_name: branchName,
        city: city || null,
        notes: notes || null,
      });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('تم إرسال طلب إضافة الفرع بنجاح');
      await fetchRequests();
    }
    return { error };
  };

  return { requests, loading, submitRequest, refetch: fetchRequests };
}
