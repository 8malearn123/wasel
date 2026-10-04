import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/** What the database says about the subscription, on the database clock. */
export interface SubscriptionState {
  found: boolean;
  status?: string;
  /** status after the server has applied the end date — 'expired' even if the row still says 'trial' */
  effective_status?: string;
  plan?: string | null;
  plan_id?: string | null;
  ends_at?: string | null;
  days_remaining?: number | null;
  is_locked?: boolean;
  server_time?: string;
}

// Errors the RPCs raise, in the user's language
const REDEEM_ERRORS: Record<string, string> = {
  invalid_code: 'كود التفعيل غير صحيح',
  code_expired: 'انتهت صلاحية هذا الكود',
  code_already_used: 'هذا الكود مستخدم من قبل',
  no_subscription: 'لا يوجد اشتراك لهذا المتجر',
  owner_role_required: 'صاحب المتجر فقط يستطيع تفعيل الاشتراك',
  not_a_merchant_user: 'الحساب غير مرتبط بمتجر',
  plan_not_found: 'الباقة غير متاحة',
};

const messageFor = (error: { message?: string } | null) => {
  const raw = error?.message || '';
  const key = Object.keys(REDEEM_ERRORS).find(k => raw.includes(k));
  return key ? REDEEM_ERRORS[key] : 'تعذّر إتمام العملية، حاول مرة أخرى';
};

export function useSubscription() {
  const { subscription, merchant, refreshMerchantData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<SubscriptionState | null>(null);

  // The dates are read from the row, but whether they have PASSED is decided by
  // the server. new Date() here is the device clock, and the device clock is
  // the user's to set.
  const loadState = useCallback(async () => {
    if (!merchant) { setState(null); return; }
    const { data, error } = await supabase.rpc('get_subscription_state' as never);
    if (error) {
      // Before the migration is applied the function does not exist yet; the
      // screens still render, and RLS is the real boundary either way.
      console.warn('[subscription] get_subscription_state unavailable:', error.message);
      setState(null);
      return;
    }
    setState(data as unknown as SubscriptionState);
  }, [merchant]);

  useEffect(() => { loadState(); }, [loadState]);

  // Fallback only for the window before the migration lands
  const clientSideExpired = (endDate?: string | null) =>
    Boolean(endDate) && new Date(endDate as string) < new Date();

  const isTrialExpired = state
    ? state.status === 'trial' && state.effective_status === 'expired'
    : subscription?.status === 'trial' && clientSideExpired(subscription?.trial_ends_at);

  const isSubscriptionExpired = state
    ? state.status !== 'trial' && state.effective_status === 'expired'
    : subscription?.status === 'expired' ||
      (subscription?.status === 'active' && clientSideExpired(subscription?.subscription_ends_at));

  const isLocked = state ? Boolean(state.is_locked) : isTrialExpired || isSubscriptionExpired;

  const daysRemaining = state?.days_remaining ?? (() => {
    if (!subscription) return 0;
    const endDate = subscription.status === 'trial'
      ? subscription.trial_ends_at
      : subscription.subscription_ends_at;
    if (!endDate) return 0;
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  /**
   * Redeem an activation code. The code is checked, consumed and applied by
   * redeem_activation_code() inside the database — the browser never decides
   * whether a code is valid, how many days it is worth, or when it expires.
   */
  const activateWithCode = async (code: string) => {
    if (!code?.trim()) {
      toast.error(REDEEM_ERRORS.invalid_code);
      return { error: new Error('invalid_code') };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('redeem_activation_code' as never, { _code: code.trim() } as never);

      if (error) {
        toast.error(messageFor(error));
        return { error: new Error(error.message) };
      }

      const result = data as unknown as { days?: number } | null;
      toast.success(result?.days ? `تم تفعيل الاشتراك لمدة ${result.days} يوم` : 'تم تفعيل الاشتراك');
      await refreshMerchantData();
      await loadState();
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ask for a different plan. This records a request for the platform admin to
   * act on after payment; it does not grant the plan. The subscription row is
   * no longer writable from a merchant session at all — RLS refuses it.
   */
  const requestPlanChange = async (planId: string, note?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('request_plan_change' as never, { _plan_id: planId, _note: note ?? null } as never);

      if (error) {
        toast.error(messageFor(error));
        return { error: new Error(error.message) };
      }

      toast.success('تم إرسال طلب تغيير الباقة، وسيتواصل معك فريق وصل');
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  return {
    subscription,
    state,
    isLocked,
    isTrialExpired,
    isSubscriptionExpired,
    daysRemaining,
    loading,
    activateWithCode,
    requestPlanChange,
    refreshState: loadState,
  };
}
