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

  const searchByIMEI = useCallback(async (imei: string) => {
    if (!merchant) return null;

    const { data } = await supabase
      .from('devices')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('status', 'available')
      .or(`imei.eq.${imei},imei2.eq.${imei}`)
      .maybeSingle();

    return data as Device | null;
  }, [merchant]);

  const searchBySkuOrName = useCallback(async (query: string) => {
    if (!merchant) return { devices: [] as Device[], accessories: [] as Accessory[] };

    const { data: devData } = await supabase
      .from('devices')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('status', 'available')
      .or(`model.ilike.%${query}%,brand.ilike.%${query}%,imei.ilike.%${query}%`)
      .limit(10);

    const { data: accData } = await supabase
      .from('accessories')
      .select('*')
      .eq('merchant_id', merchant.id)
      .gt('quantity', 0)
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
      .limit(10);

    return {
      devices: (devData || []) as Device[],
      accessories: (accData || []) as Accessory[],
    };
  }, [merchant]);

  return {
    devices,
    accessories,
    loading,
    refetch: fetchInventory,
    searchByIMEI,
    searchBySkuOrName,
  };
}
