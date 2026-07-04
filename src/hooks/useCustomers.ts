import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Customer {
  id: string;
  merchant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  loyalty_points: number;
  total_spent: number;
  total_purchases: number;
  loyalty_tier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  merchant_id: string;
  customer_id: string;
  points: number;
  type: string;
  description: string | null;
  sale_id: string | null;
  created_by: string | null;
  created_at: string;
}

function getTier(points: number): string {
  if (points >= 5000) return 'platinum';
  if (points >= 2000) return 'gold';
  if (points >= 500) return 'silver';
  return 'bronze';
}

export function useCustomers() {
  const { merchant, user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
    } else {
      setCustomers((data || []) as Customer[]);
    }
    setLoading(false);
  }, [merchant]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const createCustomer = async (data: { name: string; phone?: string; email?: string; address?: string; notes?: string }) => {
    if (!merchant) return;
    const { error } = await supabase.from('customers').insert({
      merchant_id: merchant.id,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      notes: data.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('تمت إضافة العميل');
    fetchCustomers();
  };

  const updateCustomer = async (id: string, data: Partial<Customer>) => {
    const { error } = await supabase.from('customers').update(data).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('تم تحديث العميل');
    fetchCustomers();
  };

  const addLoyaltyPoints = async (customerId: string, points: number, description: string) => {
    if (!merchant || !user) return;
    const { error: txError } = await supabase.from('loyalty_transactions').insert({
      merchant_id: merchant.id,
      customer_id: customerId,
      points,
      type: points > 0 ? 'earn' : 'redeem',
      description,
      created_by: user.id,
    });
    if (txError) { toast.error(txError.message); return; }

    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      const newPoints = customer.loyalty_points + points;
      await supabase.from('customers').update({
        loyalty_points: Math.max(0, newPoints),
        loyalty_tier: getTier(Math.max(0, newPoints)),
      }).eq('id', customerId);
    }

    toast.success(points > 0 ? `تمت إضافة ${points} نقطة` : `تم استبدال ${Math.abs(points)} نقطة`);
    fetchCustomers();
  };

  const getLoyaltyHistory = async (customerId: string): Promise<LoyaltyTransaction[]> => {
    const { data } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data || []) as LoyaltyTransaction[];
  };

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.is_active).length,
    totalPoints: customers.reduce((s, c) => s + c.loyalty_points, 0),
    totalSpent: customers.reduce((s, c) => s + Number(c.total_spent), 0),
    platinum: customers.filter(c => c.loyalty_tier === 'platinum').length,
    gold: customers.filter(c => c.loyalty_tier === 'gold').length,
    silver: customers.filter(c => c.loyalty_tier === 'silver').length,
    bronze: customers.filter(c => c.loyalty_tier === 'bronze').length,
  };

  return { customers, loading, stats, createCustomer, updateCustomer, addLoyaltyPoints, getLoyaltyHistory, refetch: fetchCustomers };
}
