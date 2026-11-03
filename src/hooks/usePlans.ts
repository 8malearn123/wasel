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
  // Both columns exist in the plans table already; they were simply missing
  // from this type, which is why usePlanEnforcement had to cast to any.
  has_wholesale: boolean;
  has_loyalty: boolean;
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

// The plans table changes rarely and every guard, menu and banner asks for it:
// one request is shared by all of them for a minute instead of one per mount.
const PLANS_TTL_MS = 60_000;
let plansCache: { at: number; promise: Promise<Plan[]> } | null = null;

function loadPlans(): Promise<Plan[]> {
  if (plansCache && Date.now() - plansCache.at < PLANS_TTL_MS) return plansCache.promise;
  const promise = Promise.resolve(
    supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
  ).then(({ data, error }) => {
    // a failed read is not kept: the next screen asks again
    if (error) plansCache = null;
    // باقة بلس (Professional) ملغاة — مميزاتها انتقلت لباقة برو
    return ((data as any[]) || [])
      .filter((p) => p.name !== 'Professional')
      .map((p) => ({
        ...p,
        name_ar: PLAN_DISPLAY_NAMES[p.name] || p.name_ar,
      })) as Plan[];
  });
  plansCache = { at: Date.now(), promise };
  return promise;
}

/** for tests */
export const resetPlansCache = () => { plansCache = null; };

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadPlans().then(rows => {
      if (!alive) return;
      setPlans(rows);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  return { plans, loading };
}
