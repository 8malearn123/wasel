import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface PlatformCompany {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  logo_url: string | null;
  platform_fee_percentage: number | null;
  bank_name: string | null;
  iban: string | null;
  subscription?: {
    id: string;
    plan: string;
    plan_id: string | null;
    status: string;
    trial_ends_at: string | null;
    subscription_ends_at: string | null;
    max_branches: number;
    max_users: number;
    auto_renew: boolean;
    admin_notes: string | null;
    activation_code: string | null;
  };
  branch_count: number;
  user_count: number;
  device_count: number;
  sales_total: number;
  repair_count: number;
}

interface BranchRequest {
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
  merchant?: { name: string };
}

interface PlatformStats {
  totalMerchants: number;
  activeSubs: number;
  trialSubs: number;
  expiredSubs: number;
  totalRevenue: number;
  totalDevices: number;
  totalRepairs: number;
  totalOnlineOrders: number;
  pendingBranchRequests: number;
  pendingPayouts: number;
  recentSignups: number; // last 7 days
}

interface ActivityLog {
  id: string;
  merchant_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  merchant?: { name: string };
}

interface Payout {
  id: string;
  merchant_id: string;
  amount: number;
  net_amount: number | null;
  platform_fee: number | null;
  orders_count: number | null;
  status: string | null;
  period_from: string | null;
  period_to: string | null;
  reference_number: string | null;
  bank_name: string | null;
  iban: string | null;
  notes: string | null;
  processed_at: string | null;
  created_at: string | null;
  merchant?: { name: string };
}

export function usePlatformAdmin() {
  const { user } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [branchRequests, setBranchRequests] = useState<BranchRequest[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    totalMerchants: 0, activeSubs: 0, trialSubs: 0, expiredSubs: 0,
    totalRevenue: 0, totalDevices: 0, totalRepairs: 0, totalOnlineOrders: 0,
    pendingBranchRequests: 0, pendingPayouts: 0, recentSignups: 0,
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        setIsPlatformAdmin(!!data);
        setLoading(false);
      });
  }, [user]);

  const fetchCompanies = useCallback(async () => {
    if (!isPlatformAdmin) return;
    const { data: merchants } = await supabase
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: false });

    if (!merchants) return;

    const enriched: PlatformCompany[] = await Promise.all(
      merchants.map(async (m: any) => {
        const [
          { data: sub },
          { count: branchCount },
          { count: userCount },
          { count: deviceCount },
          { count: repairCount },
        ] = await Promise.all([
          supabase.from('subscriptions').select('*').eq('merchant_id', m.id).maybeSingle(),
          supabase.from('branches').select('*', { count: 'exact', head: true }).eq('merchant_id', m.id).eq('is_active', true),
          supabase.from('merchant_users').select('*', { count: 'exact', head: true }).eq('merchant_id', m.id).eq('is_active', true),
          supabase.from('devices').select('*', { count: 'exact', head: true }).eq('merchant_id', m.id),
          supabase.from('repair_orders').select('*', { count: 'exact', head: true }).eq('merchant_id', m.id),
        ]);

        // Get total sales
        const { data: salesAgg } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('merchant_id', m.id);
        const salesTotal = (salesAgg || []).reduce((s: number, sale: any) => s + Number(sale.total_amount), 0);

        return {
          ...m,
          subscription: sub || undefined,
          branch_count: branchCount || 0,
          user_count: userCount || 0,
          device_count: deviceCount || 0,
          sales_total: salesTotal,
          repair_count: repairCount || 0,
        };
      })
    );

    setCompanies(enriched);

    // Calculate platform stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    setPlatformStats({
      totalMerchants: enriched.length,
      activeSubs: enriched.filter(c => c.subscription?.status === 'active').length,
      trialSubs: enriched.filter(c => c.subscription?.status === 'trial').length,
      expiredSubs: enriched.filter(c => c.subscription?.status === 'expired' || c.subscription?.status === 'cancelled').length,
      totalRevenue: enriched.reduce((s, c) => s + c.sales_total, 0),
      totalDevices: enriched.reduce((s, c) => s + c.device_count, 0),
      totalRepairs: enriched.reduce((s, c) => s + c.repair_count, 0),
      totalOnlineOrders: 0, // will be updated below
      pendingBranchRequests: 0, // will be updated by fetchBranchRequests
      pendingPayouts: 0, // will be updated by fetchPayouts
      recentSignups: enriched.filter(c => new Date(c.created_at) >= sevenDaysAgo).length,
    });

    // Get online orders count
    const { count: onlineCount } = await supabase
      .from('online_orders')
      .select('*', { count: 'exact', head: true });
    
    setPlatformStats(prev => ({ ...prev, totalOnlineOrders: onlineCount || 0 }));
  }, [isPlatformAdmin]);

  const fetchBranchRequests = useCallback(async () => {
    if (!isPlatformAdmin) return;
    const { data } = await supabase
      .from('branch_requests')
      .select('*, merchant:merchants(name)')
      .order('created_at', { ascending: false });

    const requests = (data as any[]) || [];
    setBranchRequests(requests);
    setPlatformStats(prev => ({
      ...prev,
      pendingBranchRequests: requests.filter(r => r.status === 'pending_review' || r.status === 'pending_payment').length,
    }));
  }, [isPlatformAdmin]);

  const fetchActivityLogs = useCallback(async () => {
    if (!isPlatformAdmin) return;
    const { data } = await supabase
      .from('activity_logs')
      .select('*, merchant:merchants(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    setActivityLogs((data as any[]) || []);
  }, [isPlatformAdmin]);

  const fetchPayouts = useCallback(async () => {
    if (!isPlatformAdmin) return;
    const { data } = await supabase
      .from('merchant_payouts')
      .select('*, merchant:merchants(name)')
      .order('created_at', { ascending: false });
    const payoutList = (data as any[]) || [];
    setPayouts(payoutList);
    setPlatformStats(prev => ({
      ...prev,
      pendingPayouts: payoutList.filter(p => p.status === 'pending').length,
    }));
  }, [isPlatformAdmin]);

  // Admin actions
  const updateSubscriptionStatus = async (subId: string, status: 'trial' | 'active' | 'expired' | 'cancelled') => {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status })
      .eq('id', subId);
    if (!error) await fetchCompanies();
    return { error };
  };

  const updateSubscriptionPlan = async (subId: string, planId: string, maxBranches: number, maxUsers: number, plan: string) => {
    const { error } = await supabase
      .from('subscriptions')
      .update({ plan_id: planId, plan, max_branches: maxBranches, max_users: maxUsers })
      .eq('id', subId);
    if (!error) await fetchCompanies();
    return { error };
  };

  const extendSubscription = async (subId: string, days: number) => {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('subscription_ends_at')
      .eq('id', subId)
      .single();

    const base = sub?.subscription_ends_at ? new Date(sub.subscription_ends_at) : new Date();
    if (base < new Date()) base.setTime(new Date().getTime());
    base.setDate(base.getDate() + days);

    const { error } = await supabase
      .from('subscriptions')
      .update({ subscription_ends_at: base.toISOString(), status: 'active' })
      .eq('id', subId);
    if (!error) await fetchCompanies();
    return { error };
  };

  const addAdminNote = async (subId: string, note: string) => {
    const { error } = await supabase
      .from('subscriptions')
      .update({ admin_notes: note })
      .eq('id', subId);
    if (!error) await fetchCompanies();
    return { error };
  };

  const updateMerchantFee = async (merchantId: string, fee: number) => {
    const { error } = await supabase
      .from('merchants')
      .update({ platform_fee_percentage: fee })
      .eq('id', merchantId);
    if (error) return { error };
    await fetchCompanies();
    return { error: null };
  };

  // Payout actions
  const updatePayoutStatus = async (payoutId: string, status: string, refNumber?: string) => {
    const update: any = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') update.processed_at = new Date().toISOString();
    if (refNumber) update.reference_number = refNumber;

    const { error } = await supabase
      .from('merchant_payouts')
      .update(update)
      .eq('id', payoutId);
    if (!error) await fetchPayouts();
    return { error };
  };

  // Branch request actions
  const approveBranchRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('branch_requests')
      .update({ status: 'pending_payment' })
      .eq('id', requestId);
    if (!error) await fetchBranchRequests();
    return { error };
  };

  const rejectBranchRequest = async (requestId: string, adminNotes: string) => {
    const { error } = await supabase
      .from('branch_requests')
      .update({ status: 'rejected', admin_notes: adminNotes })
      .eq('id', requestId);
    if (!error) await fetchBranchRequests();
    return { error };
  };

  const issueInvoice = async (requestId: string, amount: number) => {
    const { error } = await supabase
      .from('branch_requests')
      .update({ invoice_amount: amount, status: 'pending_payment' })
      .eq('id', requestId);
    if (!error) await fetchBranchRequests();
    return { error };
  };

  const confirmPaymentAndActivate = async (requestId: string) => {
    const { data: req } = await supabase
      .from('branch_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (!req) return { error: new Error('Request not found') };

    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({
        merchant_id: req.merchant_id,
        name: req.branch_name,
        address: req.city,
        is_warehouse: false,
        is_active: true,
      })
      .select()
      .single();

    if (branchError) return { error: branchError };

    const { error } = await supabase
      .from('branch_requests')
      .update({
        status: 'activated',
        payment_confirmed: true,
        branch_id: branch.id,
      })
      .eq('id', requestId);

    await supabase.from('activity_logs').insert({
      merchant_id: req.merchant_id,
      action: 'branch_activated',
      entity_type: 'branch',
      entity_id: branch.id,
      new_data: { branch_name: req.branch_name, request_id: requestId },
    });

    if (!error) await fetchBranchRequests();
    return { error };
  };

  return {
    isPlatformAdmin,
    loading,
    companies,
    branchRequests,
    platformStats,
    activityLogs,
    payouts,
    fetchCompanies,
    fetchBranchRequests,
    fetchActivityLogs,
    fetchPayouts,
    updateSubscriptionStatus,
    updateSubscriptionPlan,
    extendSubscription,
    addAdminNote,
    updateMerchantFee,
    updatePayoutStatus,
    approveBranchRequest,
    rejectBranchRequest,
    issueInvoice,
    confirmPaymentAndActivate,
  };
}
