import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface StoreSettings {
  id: string;
  merchant_id: string;
  slug: string;
  store_name: string | null;
  description: string | null;
  primary_color: string;
  secondary_color: string;
  banner_url: string | null;
  logo_url: string | null;
  is_published: boolean;
  shipping_cost: number;
  free_shipping_threshold: number | null;
  whatsapp_number: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  return_policy: string | null;
  // New fields (Phase 1)
  theme_id: string | null;
  font_family: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  featured_section_enabled: boolean | null;
  featured_product_ids: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  og_image_url: string | null;
  currency_symbol: string | null;
  announcement_bar_text: string | null;
  announcement_bar_enabled: boolean | null;
  show_cr_number: boolean;
  show_vat_number: boolean;
  show_vat_status: boolean;
  additional_banners: Array<{ image_url: string; title?: string; subtitle?: string; link?: string }>;
  created_at: string;
  updated_at: string;
}

// إعدادات التصميم الحر (باقة ماكس) — تُخزَّن كصفحة مخفية بدل عمود جديد
// لأن تعديل مخطط قاعدة البيانات غير متاح من هنا
export const DESIGN_EXTRAS_SLUG = '__design';

export interface DesignExtras {
  gallery: Array<{ image_url: string; caption?: string }>;
  custom_heading?: string;
  custom_text?: string;
  product_motion?: 'none' | 'float' | 'marquee';
  font_color?: string;
  // أقسام الصفحة الرئيسية (تصميم ماكس)
  wide_banners?: Array<{ image_url?: string; title?: string; subtitle?: string }>;
  feature_images?: Array<{ image_url: string; caption?: string }>;
  divider?: { enabled?: boolean; text?: string };
  store_perks?: Array<{ icon: string; title: string; desc?: string }>;
}

export function parseDesignExtras(pages: StorePage[]): DesignExtras | null {
  const p = pages.find(pg => pg.slug === DESIGN_EXTRAS_SLUG);
  if (!p?.content) return null;
  try {
    const parsed = JSON.parse(p.content);
    return { gallery: [], ...parsed };
  } catch {
    return null;
  }
}

export interface StorePage {
  id: string;
  merchant_id: string;
  slug: string;
  title: string;
  content: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StoreCategory {
  id: string;
  merchant_id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface OnlineOrder {
  id: string;
  merchant_id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_address: string;
  shipping_city: string;
  shipping_provider: string | null;
  tracking_number: string | null;
  shipping_cost: number;
  payment_method: string;
  payment_status: string;
  payment_reference: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payout_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OnlineOrderItem[];
}

export interface OnlineOrderItem {
  id: string;
  order_id: string;
  device_id: string | null;
  accessory_id: string | null;
  item_name: string;
  item_image: string | null;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface MerchantPayout {
  id: string;
  merchant_id: string;
  amount: number;
  status: string;
  bank_name: string | null;
  iban: string | null;
  reference_number: string | null;
  notes: string | null;
  period_from: string | null;
  period_to: string | null;
  orders_count: number;
  platform_fee: number;
  net_amount: number;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  merchant?: { name: string } | null;
}

// ===== Merchant Store Settings Hook =====
export function useStoreSettings() {
  const { merchant } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    const { data } = await supabase
      .from('store_settings')
      .select('*')
      .eq('merchant_id', merchant.id)
      .maybeSingle();
    setSettings(data as unknown as StoreSettings | null);

    const { data: cats } = await supabase
      .from('store_categories')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('sort_order');
    setCategories((cats || []) as unknown as StoreCategory[]);
    setLoading(false);
  }, [merchant]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const initStore = async () => {
    if (!merchant) return;
    const slug = merchant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `store-${Date.now()}`;
    const { data, error } = await supabase
      .from('store_settings')
      .insert({ merchant_id: merchant.id, slug, store_name: merchant.name } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setSettings(data as unknown as StoreSettings);
    toast.success('تم إنشاء المتجر الإلكتروني');
  };

  const updateSettings = async (updates: Partial<StoreSettings>) => {
    if (!settings) return;
    const { error } = await supabase
      .from('store_settings')
      .update(updates as any)
      .eq('id', settings.id);
    if (error) { toast.error(error.message); return; }
    setSettings({ ...settings, ...updates });
    toast.success('تم حفظ الإعدادات');
  };

  const addCategory = async (name: string) => {
    if (!merchant) return;
    const { error } = await supabase
      .from('store_categories')
      .insert({ merchant_id: merchant.id, name, sort_order: categories.length } as any);
    if (error) { toast.error(error.message); return; }
    await fetchSettings();
    toast.success('تمت إضافة التصنيف');
  };

  const removeCategory = async (id: string) => {
    await supabase.from('store_categories').delete().eq('id', id);
    await fetchSettings();
    toast.success('تم حذف التصنيف');
  };

  return { settings, categories, loading, initStore, updateSettings, addCategory, removeCategory, refetch: fetchSettings };
}

// ===== Store Pages Hook (custom pages: about, terms, return, faq) =====
export function useStorePages() {
  const { merchant } = useAuth();
  const [pages, setPages] = useState<StorePage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = useCallback(async () => {
    if (!merchant) { setPages([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('store_pages')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('sort_order');
    setPages((data || []) as unknown as StorePage[]);
    setLoading(false);
  }, [merchant]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const upsertPage = async (page: Partial<StorePage> & { slug: string; title: string }) => {
    if (!merchant) return;
    const payload: any = { ...page, merchant_id: merchant.id };
    const { error } = await supabase.from('store_pages').upsert(payload, { onConflict: 'merchant_id,slug' });
    if (error) { toast.error(error.message); return; }
    await fetchPages();
    toast.success('تم حفظ الصفحة');
  };

  const deletePage = async (id: string) => {
    const { error } = await supabase.from('store_pages').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    await fetchPages();
    toast.success('تم حذف الصفحة');
  };

  const designExtras = parseDesignExtras(pages);

  const saveDesignExtras = async (extras: DesignExtras) => {
    if (!merchant) return;
    const { error } = await supabase.from('store_pages').upsert({
      merchant_id: merchant.id,
      slug: DESIGN_EXTRAS_SLUG,
      title: 'إعدادات التصميم',
      content: JSON.stringify(extras),
      is_published: true,
      sort_order: 999,
    } as any, { onConflict: 'merchant_id,slug' });
    if (error) { toast.error(error.message); return; }
    await fetchPages();
    toast.success('تم حفظ التصميم');
  };

  return {
    pages: pages.filter(p => p.slug !== DESIGN_EXTRAS_SLUG),
    loading, upsertPage, deletePage, refetch: fetchPages,
    designExtras, saveDesignExtras,
  };
}

// ===== Storage Upload Helper =====
export async function uploadStoreAsset(merchantId: string, file: File, kind: 'logo' | 'banner' | 'hero' | 'og' | 'category' | 'gallery'): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${merchantId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('store-assets').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) { toast.error(error.message); return null; }
  const { data } = supabase.storage.from('store-assets').getPublicUrl(path);
  return data.publicUrl;
}

// ===== Merchant Orders Hook =====
export function useOnlineOrders() {
  const { merchant } = useAuth();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    const { data } = await supabase
      .from('online_orders')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    setOrders((data || []) as unknown as OnlineOrder[]);
    setLoading(false);
  }, [merchant]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from('online_orders')
      .update({ status } as any)
      .eq('id', orderId);
    if (error) { toast.error(error.message); return; }
    await fetchOrders();
    toast.success('تم تحديث حالة الطلب');
  };

  const updateTracking = async (orderId: string, provider: string, trackingNumber: string) => {
    const { error } = await supabase
      .from('online_orders')
      .update({
        shipping_provider: provider,
        tracking_number: trackingNumber,
        status: 'shipped',
      } as any)
      .eq('id', orderId);
    if (error) { toast.error(error.message); return; }
    await fetchOrders();
    toast.success('تم إضافة رقم التتبع');
  };

  const updatePaymentStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from('online_orders')
      .update({ payment_status: status } as any)
      .eq('id', orderId);
    if (error) { toast.error(error.message); return; }
    await fetchOrders();
    toast.success('تم تحديث حالة الدفع');
  };

  const getOrderItems = async (orderId: string): Promise<OnlineOrderItem[]> => {
    const { data } = await supabase
      .from('online_order_items')
      .select('*')
      .eq('order_id', orderId);
    return (data || []) as unknown as OnlineOrderItem[];
  };

  return { orders, loading, refetch: fetchOrders, updateOrderStatus, updateTracking, updatePaymentStatus, getOrderItems };
}

// ===== Public Store Hook (no auth needed) =====
export interface MerchantLegalInfo {
  name: string | null;
  cr_number: string | null;
  vat_number: string | null;
  vat_enabled: boolean | null;
}

export function usePublicStore(slug: string) {
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [pages, setPages] = useState<StorePage[]>([]);
  const [designExtras, setDesignExtras] = useState<DesignExtras | null>(null);
  const [merchantLegal, setMerchantLegal] = useState<MerchantLegalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data: storeData, error: storeErr } = await supabase
        .from('store_settings')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (storeErr || !storeData) {
        setError('المتجر غير موجود');
        setLoading(false);
        return;
      }

      setStore(storeData as unknown as StoreSettings);
      const merchantId = (storeData as any).merchant_id;

      const [devRes, accRes, catRes, pagesRes, legalRes] = await Promise.all([
        supabase.from('public_store_devices').select('*').eq('merchant_id', merchantId),
        supabase.from('public_store_accessories').select('*').eq('merchant_id', merchantId),
        supabase.from('store_categories').select('*').eq('merchant_id', merchantId).eq('is_active', true).order('sort_order'),
        supabase.from('store_pages').select('*').eq('merchant_id', merchantId).eq('is_published', true).order('sort_order'),
        supabase.rpc('get_public_merchant_legal', { _slug: slug } as any),
      ]);

      setDevices(devRes.data || []);
      setAccessories(accRes.data || []);
      setCategories((catRes.data || []) as unknown as StoreCategory[]);
      const rawPages = (pagesRes.data || []) as unknown as StorePage[];
      setDesignExtras(parseDesignExtras(rawPages));
      setPages(rawPages.filter(p => p.slug !== DESIGN_EXTRAS_SLUG));
      const legalRow = Array.isArray(legalRes.data) ? legalRes.data[0] : legalRes.data;
      setMerchantLegal((legalRow || null) as MerchantLegalInfo | null);
      setLoading(false);
    })();
  }, [slug]);

  const placeOrder = async (orderData: {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    shipping_address: string;
    shipping_city: string;
    payment_method: string;
    items: { device_id?: string; accessory_id?: string; item_name: string; quantity: number; unit_price: number }[];
  }) => {
    if (!store) return null;

    const { data: numData } = await supabase.rpc('generate_online_order_number', {
      _merchant_id: store.merchant_id,
    });
    const orderNumber = numData || `ORD-${Date.now()}`;

    const subtotal = orderData.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const shippingCost = store.free_shipping_threshold && subtotal >= store.free_shipping_threshold ? 0 : store.shipping_cost;
    const taxAmount = Math.round(subtotal * 0.15 * 100) / 100;
    const totalAmount = subtotal + taxAmount + shippingCost;

    const { data: order, error: orderErr } = await supabase
      .from('online_orders')
      .insert({
        merchant_id: store.merchant_id,
        order_number: orderNumber,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        customer_email: orderData.customer_email || null,
        shipping_address: orderData.shipping_address,
        shipping_city: orderData.shipping_city,
        shipping_cost: shippingCost,
        payment_method: orderData.payment_method,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      } as any)
      .select()
      .single();

    if (orderErr) { toast.error(orderErr.message); return null; }

    const items = orderData.items.map(i => ({
      order_id: (order as any).id,
      device_id: i.device_id || null,
      accessory_id: i.accessory_id || null,
      item_name: i.item_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }));

    await supabase.from('online_order_items').insert(items as any);

    return { orderNumber, totalAmount, shippingCost };
  };

  return { store, devices, accessories, categories, pages, designExtras, merchantLegal, loading, error, placeOrder };
}

// ===== Public Order Tracking (no auth, verifies via last 4 digits of phone) =====
export async function trackPublicOrder(orderNumber: string, phoneLast4: string) {
  const { data: order, error } = await supabase
    .from('online_orders')
    .select('*')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error || !order) return { error: 'الطلب غير موجود' };
  const phone = (order as any).customer_phone as string;
  if (!phone || phone.replace(/\D/g, '').slice(-4) !== phoneLast4) {
    return { error: 'بيانات التحقق غير صحيحة' };
  }

  const { data: items } = await supabase
    .from('online_order_items')
    .select('*')
    .eq('order_id', (order as any).id);

  return { order: order as unknown as OnlineOrder, items: (items || []) as unknown as OnlineOrderItem[] };
}

// ===== Platform Admin Payouts Hook =====
export function useMerchantPayouts() {
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('merchant_payouts')
      .select('*, merchant:merchants(name)')
      .order('created_at', { ascending: false });
    setPayouts((data || []) as unknown as MerchantPayout[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  const createPayout = async (opts: {
    merchant_id: string; amount: number; bank_name?: string;
    iban?: string; period_from?: string; period_to?: string;
    orders_count?: number; platform_fee?: number; net_amount?: number; notes?: string;
  }) => {
    const { error } = await supabase.from('merchant_payouts').insert(opts as any);
    if (error) { toast.error(error.message); return; }
    await fetchPayouts();
    toast.success('تم إنشاء التحويل');
  };

  const updatePayoutStatus = async (id: string, status: string, reference?: string) => {
    const update: any = { status, processed_at: new Date().toISOString() };
    if (reference) update.reference_number = reference;
    const { error } = await supabase.from('merchant_payouts').update(update).eq('id', id);
    if (error) { toast.error(error.message); return; }
    await fetchPayouts();
    toast.success('تم تحديث حالة التحويل');
  };

  return { payouts, loading, createPayout, updatePayoutStatus, refetch: fetchPayouts };
}
