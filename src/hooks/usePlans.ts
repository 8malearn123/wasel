import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Plan {
  id: string;
  name: string;
  name_ar: string;
  price: number;
  branch_limit: number;
  user_limit: number;
  has_online_store: boolean;
  advanced_reports: boolean;
  priority_support: boolean;
  is_active: boolean;
  sort_order: number;
}

// Display names override what is stored in the plans table, so renames
// take effect without a database migration
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  Basic: 'باقة لايت',
  Professional: 'باقة بلس',
  Enterprise: 'باقة برو',
  Distributor: 'باقة ماكس',
};

// Arabic display name for a plan's English key (e.g. "Basic"), falling
// back to the key itself for unknown values like "trial"
export function planDisplayName(name?: string | null): string {
  if (!name) return 'تجريبي';
  return PLAN_DISPLAY_NAMES[name] || name;
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        // باقة بلس (Professional) ملغاة — مميزاتها انتقلت لباقة برو
        const rows = ((data as any[]) || [])
          .filter((p) => p.name !== 'Professional')
          .map((p) => ({
            ...p,
            name_ar: PLAN_DISPLAY_NAMES[p.name] || p.name_ar,
          }));
        setPlans(rows);
        setLoading(false);
      });
  }, []);

  return { plans, loading };
}
