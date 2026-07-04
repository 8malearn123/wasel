import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useSubscription() {
  const { subscription, merchant, refreshMerchantData } = useAuth();
  const [loading, setLoading] = useState(false);

  const isTrialExpired = subscription?.status === 'trial' && 
    subscription?.trial_ends_at && 
    new Date(subscription.trial_ends_at) < new Date();

  const isSubscriptionExpired = subscription?.status === 'expired' ||
    (subscription?.status === 'active' && 
     subscription?.subscription_ends_at && 
     new Date(subscription.subscription_ends_at) < new Date());

  const isLocked = isTrialExpired || isSubscriptionExpired;

  const daysRemaining = (() => {
    if (!subscription) return 0;
    
    const endDate = subscription.status === 'trial' 
      ? subscription.trial_ends_at 
      : subscription.subscription_ends_at;
    
    if (!endDate) return 0;
    
    const diff = new Date(endDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const activateWithCode = async (code: string) => {
    if (!subscription || !merchant) {
      toast.error('No subscription found');
      return { error: new Error('No subscription found') };
    }

    setLoading(true);
    try {
      // Simple code validation (in production, validate against a codes table)
      // For demo: codes like "ACTIVATE-30" give 30 days, "ACTIVATE-365" gives a year
      const match = code.match(/^ACTIVATE-(\d+)$/i);
      if (!match) {
        toast.error('Invalid activation code');
        return { error: new Error('Invalid activation code') };
      }

      const days = parseInt(match[1], 10);
      if (days < 1 || days > 365) {
        toast.error('Invalid activation code');
        return { error: new Error('Invalid code duration') };
      }

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          activation_code: code,
          subscription_ends_at: endDate.toISOString()
        })
        .eq('id', subscription.id);

      if (error) {
        toast.error(error.message);
        return { error };
      }

      await refreshMerchantData();
      toast.success(`Subscription activated for ${days} days!`);
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const upgradePlan = async (plan: string, maxBranches: number, maxUsers: number) => {
    if (!subscription) {
      return { error: new Error('No subscription found') };
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan,
          max_branches: maxBranches,
          max_users: maxUsers
        })
        .eq('id', subscription.id);

      if (error) {
        toast.error(error.message);
        return { error };
      }

      await refreshMerchantData();
      toast.success('Plan upgraded successfully');
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  return {
    subscription,
    isLocked,
    isTrialExpired,
    isSubscriptionExpired,
    daysRemaining,
    loading,
    activateWithCode,
    upgradePlan
  };
}
