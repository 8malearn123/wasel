import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MerchantDetail {
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
}

interface MerchantSubscription {
  id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  max_branches: number;
  max_users: number;
  auto_renew: boolean;
  admin_notes: string | null;
}

export interface MerchantBranch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_warehouse: boolean;
  is_active: boolean;
}

export interface MerchantUserInfo {
  id: string;
  user_id: string;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  branch?: { name: string } | null;
  profile?: { full_name: string | null } | null;
}

export interface MerchantDevice {
  id: string;
  imei: string;
  model: string;
  brand: string | null;
  color: string | null;
  storage: string | null;
  cost: number;
  price: number;
  status: string;
  branch?: { name: string } | null;
}

export interface MerchantAccessory {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  quantity: number;
  cost: number;
  price: number;
  min_quantity: number | null;
  branch?: { name: string } | null;
}

export interface MerchantSale {
  id: string;
  invoice_number: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  customer_name: string | null;
  sale_date: string;
  branch?: { name: string } | null;
}

export interface MerchantRepair {
  id: string;
  repair_number: string;
  customer_name: string;
  customer_phone: string | null;
  device_type: string;
  device_brand: string | null;
  device_model: string | null;
  status: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  warranty_days: number | null;
  warranty_ends_at: string | null;
  received_at: string;
  branch?: { name: string } | null;
}

export interface MerchantOnlineOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_city: string;
  total_amount: number | null;
  status: string | null;
  payment_status: string | null;
  shipping_provider: string | null;
  tracking_number: string | null;
  created_at: string | null;
}

export interface MerchantActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
}

export function useMerchantDetail(merchantId: string | undefined) {
  const [merchant, setMerchant] = useState<MerchantDetail | null>(null);
  const [subscription, setSubscription] = useState<MerchantSubscription | null>(null);
  const [branches, setBranches] = useState<MerchantBranch[]>([]);
  const [users, setUsers] = useState<MerchantUserInfo[]>([]);
  const [devices, setDevices] = useState<MerchantDevice[]>([]);
  const [accessories, setAccessories] = useState<MerchantAccessory[]>([]);
  const [sales, setSales] = useState<MerchantSale[]>([]);
  const [repairs, setRepairs] = useState<MerchantRepair[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<MerchantOnlineOrder[]>([]);
  const [activityLogs, setActivityLogs] = useState<MerchantActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);

    const [
      { data: merchantData },
      { data: subData },
      { data: branchesData },
      { data: usersData },
      { data: devicesData },
      { data: accessoriesData },
      { data: salesData },
      { data: repairsData },
      { data: onlineData },
      { data: logsData },
    ] = await Promise.all([
      supabase.from('merchants').select('*').eq('id', merchantId).single(),
      supabase.from('subscriptions').select('*').eq('merchant_id', merchantId).maybeSingle(),
      supabase.from('branches').select('*').eq('merchant_id', merchantId).order('name'),
      supabase.from('merchant_users').select('*, branch:branches(name)').eq('merchant_id', merchantId),
      supabase.from('devices').select('*, branch:branches(name)').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(500),
      supabase.from('accessories').select('*, branch:branches(name)').eq('merchant_id', merchantId).order('name'),
      supabase.from('sales').select('*, branch:branches(name)').eq('merchant_id', merchantId).order('sale_date', { ascending: false }).limit(500),
      supabase.from('repair_orders').select('*, branch:branches(name)').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(500),
      supabase.from('online_orders').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(200),
      supabase.from('activity_logs').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(50),
    ]);

    setMerchant(merchantData as MerchantDetail);
    setSubscription(subData as MerchantSubscription);
    setBranches((branchesData || []) as MerchantBranch[]);
    setDevices((devicesData || []) as MerchantDevice[]);
    setAccessories((accessoriesData || []) as MerchantAccessory[]);
    setSales((salesData || []) as MerchantSale[]);
    setRepairs((repairsData || []) as MerchantRepair[]);
    setOnlineOrders((onlineData || []) as MerchantOnlineOrder[]);
    setActivityLogs((logsData || []) as MerchantActivityLog[]);

    // Fetch profiles for users
    if (usersData && usersData.length > 0) {
      const userIds = usersData.map((u: any) => u.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const enrichedUsers = usersData.map((u: any) => ({
        ...u,
        profile: profileMap.get(u.user_id) || null,
      }));
      setUsers(enrichedUsers as MerchantUserInfo[]);
    } else {
      setUsers([]);
    }

    setLoading(false);
  }, [merchantId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const totalSalesAmount = sales.reduce((s, sale) => s + sale.total_amount, 0);
  const totalOnlineAmount = onlineOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalDevices = devices.length;
  const availableDevices = devices.filter(d => d.status === 'available').length;
  const activeRepairs = repairs.filter(r => !['delivered', 'cancelled'].includes(r.status)).length;
  const lowStockAccessories = accessories.filter(a => a.quantity <= (a.min_quantity || 5)).length;
  const inventoryValue = devices.filter(d => d.status === 'available').reduce((s, d) => s + Number(d.cost), 0)
    + accessories.reduce((s, a) => s + (Number(a.cost) * a.quantity), 0);

  return {
    merchant,
    subscription,
    branches,
    users,
    devices,
    accessories,
    sales,
    repairs,
    onlineOrders,
    activityLogs,
    loading,
    totalSalesAmount,
    totalOnlineAmount,
    totalDevices,
    availableDevices,
    activeRepairs,
    lowStockAccessories,
    inventoryValue,
    refetch: fetchAll,
  };
}
