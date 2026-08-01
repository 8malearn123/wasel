import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// إعدادات الأهداف والعمولات — تُخزَّن كصفحة مخفية مثل إعدادات التصميم
// لأن تعديل مخطط قاعدة البيانات غير متاح من هنا، وبهذي الطريقة تكون
// محفوظة على السيرفر ومشتركة بين كل أجهزة التاجر (مو محلية في المتصفح)
const HR_SETTINGS_SLUG = '__hr';

export interface HRSettings {
  targets: {
    daily: number;
    monthly: number;
    // أهداف خاصة لكل موظف (اختياري) — المفتاح هو user_id
    perEmployee?: Record<string, { daily?: number; monthly?: number }>;
  };
  commission: {
    enabled: boolean;
    rate: number;                    // النسبة المئوية
    period: 'daily' | 'monthly';     // تُحتسب يومياً أو شهرياً
    basis: 'sales' | 'profit';       // من المبيعات أو من الأرباح
    // نسبة مخصصة لموظف معيّن تتجاوز النسبة العامة
    perEmployee?: Record<string, { rate?: number; enabled?: boolean }>;
  };
}

export const DEFAULT_HR_SETTINGS: HRSettings = {
  targets: { daily: 0, monthly: 0 },
  commission: { enabled: false, rate: 2, period: 'monthly', basis: 'sales' },
};

export function useHRSettings() {
  const { merchant } = useAuth();
  const [settings, setSettings] = useState<HRSettings>(DEFAULT_HR_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!merchant) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('store_pages')
      .select('content')
      .eq('merchant_id', merchant.id)
      .eq('slug', HR_SETTINGS_SLUG)
      .maybeSingle();
    if (data?.content) {
      try {
        const parsed = JSON.parse(data.content);
        setSettings({
          targets: { ...DEFAULT_HR_SETTINGS.targets, ...(parsed.targets || {}) },
          commission: { ...DEFAULT_HR_SETTINGS.commission, ...(parsed.commission || {}) },
        });
      } catch { /* محتوى تالف — نكمّل بالافتراضي */ }
    }
    setLoading(false);
  }, [merchant]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async (next: HRSettings) => {
    if (!merchant) return;
    const { error } = await supabase.from('store_pages').upsert({
      merchant_id: merchant.id,
      slug: HR_SETTINGS_SLUG,
      title: 'إعدادات الموارد البشرية',
      content: JSON.stringify(next),
      is_published: false,
      sort_order: 998,
    } as any, { onConflict: 'merchant_id,slug' });
    if (error) { toast.error(error.message); return; }
    setSettings(next);
    toast.success('تم حفظ الأهداف والعمولات');
  };

  return { settings, loading, save, refetch: fetch };
}

// حساب العمولة لموظف حسب الإعدادات
export function commissionFor(
  settings: HRSettings,
  userId: string,
  amount: number,
): { rate: number; value: number; enabled: boolean } {
  const per = settings.commission.perEmployee?.[userId];
  const enabled = settings.commission.enabled && per?.enabled !== false;
  const rate = per?.rate ?? settings.commission.rate;
  return { rate, enabled, value: enabled ? (amount * rate) / 100 : 0 };
}
