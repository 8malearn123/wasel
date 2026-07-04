import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Coupon {
  id: string;
  merchant_id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  applies_to: 'all' | 'devices' | 'accessories';
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  campaign_type: 'discount' | 'bundle' | 'flash_sale' | 'buy_x_get_y';
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  buy_quantity: number | null;
  get_quantity: number | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useMarketing() {
  const { merchant } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoupons = async () => {
    if (!merchant) return;
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching coupons:', error);
      return;
    }
    setCoupons((data as unknown as Coupon[]) || []);
  };

  const fetchCampaigns = async () => {
    if (!merchant) return;
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching campaigns:', error);
      return;
    }
    setCampaigns((data as unknown as Campaign[]) || []);
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchCoupons(), fetchCampaigns()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [merchant?.id]);

  const createCoupon = async (coupon: Omit<Coupon, 'id' | 'merchant_id' | 'used_count' | 'created_at' | 'updated_at'>) => {
    if (!merchant) return;
    const { error } = await supabase.from('coupons').insert({
      ...coupon,
      merchant_id: merchant.id,
    } as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchCoupons();
    return true;
  };

  const updateCoupon = async (id: string, updates: Partial<Coupon>) => {
    const { error } = await supabase.from('coupons').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchCoupons();
    return true;
  };

  const deleteCoupon = async (id: string) => {
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchCoupons();
    return true;
  };

  const createCampaign = async (campaign: Omit<Campaign, 'id' | 'merchant_id' | 'created_at' | 'updated_at'>) => {
    if (!merchant) return;
    const { error } = await supabase.from('campaigns').insert({
      ...campaign,
      merchant_id: merchant.id,
    } as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchCampaigns();
    return true;
  };

  const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
    const { error } = await supabase.from('campaigns').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchCampaigns();
    return true;
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchCampaigns();
    return true;
  };

  const toggleCoupon = async (id: string, is_active: boolean) => {
    return updateCoupon(id, { is_active } as any);
  };

  const toggleCampaign = async (id: string, is_active: boolean) => {
    return updateCampaign(id, { is_active } as any);
  };

  return {
    coupons,
    campaigns,
    loading,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCoupon,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    toggleCampaign,
    refresh: fetchAll,
  };
}
