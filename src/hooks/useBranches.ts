import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Branch, MerchantUser, Profile } from '@/types/database';
import { toast } from 'sonner';

export function useBranches() {
  const { merchant, refreshMerchantData } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBranches = useCallback(async () => {
    if (!merchant) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('name');

      if (error) throw error;
      setBranches((data || []) as Branch[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching branches:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const addBranch = async (branch: Omit<Branch, 'id' | 'merchant_id' | 'created_at' | 'updated_at'>) => {
    if (!merchant) return { error: new Error('No merchant') };

    const { data, error } = await supabase
      .from('branches')
      .insert({ ...branch, merchant_id: merchant.id })
      .select()
      .single();

    if (!error) {
      await fetchBranches();
      await refreshMerchantData();
      toast.success('Branch added');
    } else {
      toast.error(error.message);
    }

    return { data, error };
  };

  const updateBranch = async (id: string, updates: Partial<Branch>) => {
    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      await fetchBranches();
      await refreshMerchantData();
      toast.success('Branch updated');
    } else {
      toast.error(error.message);
    }

    return { data, error };
  };

  const deleteBranch = async (id: string) => {
    // Soft delete
    const { error } = await supabase
      .from('branches')
      .update({ is_active: false })
      .eq('id', id);

    if (!error) {
      await fetchBranches();
      await refreshMerchantData();
      toast.success('Branch removed');
    } else {
      toast.error(error.message);
    }

    return { error };
  };

  return {
    branches,
    loading,
    error,
    refetch: fetchBranches,
    addBranch,
    updateBranch,
    deleteBranch
  };
}

export function useMerchantUsers() {
  const { merchant } = useAuth();
  const [users, setUsers] = useState<MerchantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!merchant) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('merchant_users')
        .select('*, branch:branches(*)')
        .eq('merchant_id', merchant.id)
        .order('created_at');

      if (error) throw error;
      
      // Fetch profiles separately
      const usersWithProfiles = await Promise.all(
        (data || []).map(async (mu) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', mu.user_id)
            .maybeSingle();
          return { ...mu, profile: profile as Profile | undefined };
        })
      );
      setUsers(usersWithProfiles as MerchantUser[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUserRole = async (userId: string, role: MerchantUser['role']) => {
    const { error } = await supabase
      .from('merchant_users')
      .update({ role })
      .eq('id', userId);

    if (!error) {
      await fetchUsers();
      toast.success('User role updated');
    } else {
      toast.error(error.message);
    }

    return { error };
  };

  const updateUserBranch = async (userId: string, branchId: string | null) => {
    const { error } = await supabase
      .from('merchant_users')
      .update({ branch_id: branchId })
      .eq('id', userId);

    if (!error) {
      await fetchUsers();
      toast.success('User branch updated');
    } else {
      toast.error(error.message);
    }

    return { error };
  };

  const deactivateUser = async (userId: string) => {
    const { error } = await supabase
      .from('merchant_users')
      .update({ is_active: false })
      .eq('id', userId);

    if (!error) {
      await fetchUsers();
      toast.success('User deactivated');
    } else {
      toast.error(error.message);
    }

    return { error };
  };

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    updateUserRole,
    updateUserBranch,
    deactivateUser
  };
}
