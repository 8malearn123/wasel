import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';
import { readAll } from './useDashboardExtras';
import type { AssistantSale } from '@/lib/assistantMath';

/**
 * What the assistant page reads to answer its ready questions: the last six
 * weeks of sales (only for a role that may see reports) and the accessories at
 * or under their alert level (only for a role that may see products). Read
 * only; a section the role cannot open is never asked for.
 */
export interface ReorderLine { name: string; quantity: number; min_quantity: number }

export function useAssistantData() {
  const { merchant } = useAuth();
  const { can, loading: permsLoading } = usePermissions();
  const canSales = can('reports.view');
  const canStock = can('products.view');

  const [sales, setSales] = useState<AssistantSale[] | null>(null);
  const [reorder, setReorder] = useState<ReorderLine[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!merchant || permsLoading) return;
    setLoading(true);
    setError(false);
    try {
      const since = new Date(Date.now() - 42 * 864e5).toISOString();
      const [s, a] = await Promise.all([
        canSales
          ? readAll<AssistantSale>((from, to) => supabase.from('sales')
            .select('sale_date, total_amount, tax_amount, items:sale_items(quantity, unit_price, device:devices(model, brand), accessory:accessories(name))')
            .eq('merchant_id', merchant.id).gte('sale_date', since).order('id').range(from, to))
          : Promise.resolve(null),
        canStock
          ? readAll<ReorderLine>((from, to) => supabase.from('accessories')
            .select('name, quantity, min_quantity').eq('merchant_id', merchant.id).order('id').range(from, to))
          : Promise.resolve(null),
      ]);
      setSales(s);
      setReorder(a
        ? a.filter(x => Number(x.quantity) <= Number(x.min_quantity ?? 0))
          .sort((x, y) => Number(x.quantity) - Number(y.quantity))
        : null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [merchant, permsLoading, canSales, canStock]);

  useEffect(() => { load(); }, [load]);

  return { sales, reorder, canSales, canStock, loading, error, refresh: load };
}
