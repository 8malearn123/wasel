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
        setPlans((data as any[]) || []);
        setLoading(false);
      });
  }, []);

  return { plans, loading };
}
