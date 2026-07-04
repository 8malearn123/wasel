import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface MerchantCategory {
  id: string;
  merchant_id: string;
  name: string;
  name_ar?: string;
  type: 'all' | 'device' | 'accessory';
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCategories() {
  const { merchant } = useAuth();
  const [categories, setCategories] = useState<MerchantCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!merchant) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('merchant_categories')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('is_active', true)
        .order('sort_order')
        .order('name');

      if (error) throw error;
      setCategories((data || []) as MerchantCategory[]);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = async (category: { name: string; name_ar?: string; type?: string }) => {
    if (!merchant) return { error: new Error('No merchant') };

    const { data, error } = await supabase
      .from('merchant_categories')
      .insert({
        merchant_id: merchant.id,
        name: category.name,
        name_ar: category.name_ar || null,
        type: category.type || 'all',
      })
      .select()
      .single();

    if (!error) {
      await fetchCategories();
      toast.success('Category added');
    } else {
      toast.error(error.message);
    }

    return { data, error };
  };

  const updateCategory = async (id: string, updates: Partial<MerchantCategory>) => {
    const { data, error } = await supabase
      .from('merchant_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      await fetchCategories();
      toast.success('Category updated');
    } else {
      toast.error(error.message);
    }

    return { data, error };
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase
      .from('merchant_categories')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchCategories();
      toast.success('Category deleted');
    } else {
      toast.error(error.message);
    }

    return { error };
  };

  // Get categories filtered by type
  const deviceCategories = categories.filter(c => c.type === 'all' || c.type === 'device');
  const accessoryCategories = categories.filter(c => c.type === 'all' || c.type === 'accessory');

  return {
    categories,
    deviceCategories,
    accessoryCategories,
    loading,
    refetch: fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}
