import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Branch, MerchantUser, Profile } from '@/types/database';
import { toast } from 'sonner';
import { loadCustomRolesConfig, storedRoleFor, CUSTOM_ROLE_BASE } from '@/lib/customRolesStore';
import { MERCHANT_USER_COLUMNS } from '@/lib/merchantUsers';

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
        .select(`${MERCHANT_USER_COLUMNS}, branch:branches(*)`)
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

      // Which custom role each 'custom' member holds, for the list and the
      // edit dialog. Read through user_roles, which every member may read.
      const customIds = (data || []).filter(mu => (mu.role as string) === 'custom').map(mu => mu.id);
      const customRoles = new Map<string, { id: string; name: string }>();
      if (customIds.length > 0) {
        const { data: grants } = await supabase
          .from('user_roles' as never)
          .select('merchant_user_id, role:roles(id, name_ar, is_system)')
          .in('merchant_user_id', customIds);
        for (const g of (grants as unknown as {
          merchant_user_id: string;
          role: { id: string; name_ar: string; is_system: boolean } | null;
        }[]) || []) {
          if (g.role && !g.role.is_system) {
            customRoles.set(g.merchant_user_id, { id: g.role.id, name: g.role.name_ar });
          }
        }
      }

      // No user_roles table yet: the custom roles are in the app's store, on
      // members the database still calls cashiers
      const { error: noRolesTable } = await supabase.from('roles' as never).select('id').limit(1);
      if (noRolesTable) {
        const config = await loadCustomRolesConfig(merchant.id);
        setUsers(usersWithProfiles.map(u => {
          const stored = u.role === CUSTOM_ROLE_BASE ? storedRoleFor(config, u.id) : null;
          return stored
            ? { ...u, role: 'custom', customRole: { id: stored.id, name: stored.name } }
            : { ...u, customRole: null };
        }) as MerchantUser[]);
        return;
      }

      setUsers(usersWithProfiles.map(u => ({
        ...u,
        customRole: customRoles.get(u.id) ?? null,
      })) as MerchantUser[]);
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
