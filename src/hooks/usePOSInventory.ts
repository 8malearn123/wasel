import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Device, Accessory } from '@/types/database';

export function usePOSInventory() {
  const { merchant, currentBranch } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = useCallback(async () => {
    if (!merchant) {
      setDevices([]);
      setAccessories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch available devices for current branch
      const devQuery = supabase
        .from('devices')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('status', 'available')
        .order('model');

      if (currentBranch) {
        devQuery.eq('branch_id', currentBranch.id);
      }

      const { data: devData } = await devQuery;

      // Fetch accessories with stock > 0
      const accQuery = supabase
        .from('accessories')
        .select('*')
        .eq('merchant_id', merchant.id)
        .gt('quantity', 0)
        .order('name');

      if (currentBranch) {
        accQuery.eq('branch_id', currentBranch.id);
      }

      const { data: accData } = await accQuery;

      setDevices((devData || []) as Device[]);
      setAccessories((accData || []) as Accessory[]);
    } catch (err) {
      console.error('Error fetching POS inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant, currentBranch]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Scoped to the current branch: a unit can only be sold where it physically is
  // (pos_checkout enforces the same rule server-side).
  const searchByIMEI = useCallback(async (imei: string) => {
    if (!merchant) return null;
    const code = imei.trim();
    if (!/^[A-Za-z0-9-]+$/.test(code)) return null;

    let query = supabase
      .from('devices')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('status', 'available')
      .or(`imei.eq.${code},imei2.eq.${code}`);

    if (currentBranch) {
      query = query.eq('branch_id', currentBranch.id);
    }

    const { data } = await query.limit(1).maybeSingle();
    return data as Device | null;
  }, [merchant, currentBranch]);

  const searchBySkuOrName = useCallback(async (query: string) => {
    if (!merchant) return { devices: [] as Device[], accessories: [] as Accessory[] };

    // Strip characters that would break the PostgREST or() filter syntax.
    const term = query.replace(/[,()*%\\]/g, ' ').trim();
    if (!term) return { devices: [] as Device[], accessories: [] as Accessory[] };

    let devQuery = supabase
      .from('devices')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('status', 'available')
      .or(`model.ilike.%${term}%,brand.ilike.%${term}%,imei.ilike.%${term}%`)
      .limit(10);

    let accQuery = supabase
      .from('accessories')
      .select('*')
      .eq('merchant_id', merchant.id)
      .gt('quantity', 0)
      .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
      .limit(10);

    if (currentBranch) {
      devQuery = devQuery.eq('branch_id', currentBranch.id);
      accQuery = accQuery.or(`branch_id.eq.${currentBranch.id},branch_id.is.null`);
    }

    const [{ data: devData }, { data: accData }] = await Promise.all([devQuery, accQuery]);

    return {
      devices: (devData || []) as Device[],
      accessories: (accData || []) as Accessory[],
    };
  }, [merchant, currentBranch]);

  return {
    devices,
    accessories,
    loading,
    refetch: fetchInventory,
    searchByIMEI,
    searchBySkuOrName,
  };
}
