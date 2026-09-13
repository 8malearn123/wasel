import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface POSActivity {
  id: string;
  action: string;
  created_at: string;
  entity_id?: string | null;
  user_id?: string | null;
  invoice_number?: string;
  total_amount?: number;
}

/**
 * POS actions that leave no invoice behind — a shift starting, an invoice
 * edited, printed or deleted — so the sales log can show them next to the
 * invoices themselves.
 *
 * A cashier only ever sees their own, matching how the sales list is filtered.
 */
export function usePOSActivity(limit = 60) {
  const { merchant, user, merchantUser } = useAuth();
  const [activity, setActivity] = useState<POSActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const isCashier = merchantUser?.role === 'cashier';

  const fetchActivity = useCallback(async () => {
    if (!merchant) {
      setActivity([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const query = supabase
        .from('activity_logs')
        .select('id, action, created_at, entity_id, user_id, new_data')
        .eq('merchant_id', merchant.id)
        .like('action', 'pos_%')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (isCashier && user) query.eq('user_id', user.id);

      const { data, error } = await query;
      if (error) throw error;

      setActivity(
        (data || []).map(row => {
          const details = (row.new_data || {}) as Record<string, unknown>;
          return {
            id: row.id,
            action: row.action,
            created_at: row.created_at,
            entity_id: row.entity_id,
            user_id: row.user_id,
            invoice_number: details.invoice_number as string | undefined,
            total_amount: details.total_amount as number | undefined,
          };
        })
      );
    } catch (err) {
      console.error('Error fetching POS activity:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant, user, isCashier, limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { activity, loading, refetch: fetchActivity };
}
