import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Device, Accessory } from '@/types/database';
import { applySaleToStock, isNetworkError, type OfflineSale } from '@/lib/offline/offlineSales';
import { loadStock, saveStock } from '@/lib/offline/storage';

/**
 * Branch stock for the POS. Every successful load is also kept on the device, so the
 * till can keep selling from it when the connection drops (`offline`).
 */
export function usePOSInventory({ offline = false }: { offline?: boolean } = {}) {
  const { merchant, currentBranch } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const stockRef = useRef({ devices, accessories });
  stockRef.current = { devices, accessories };

  const loadCachedStock = useCallback(() => {
    const cached = currentBranch ? loadStock(currentBranch.id) : null;
    if (cached) {
      setDevices(cached.devices);
      setAccessories(cached.accessories);
    }
    setFromCache(true);
  }, [currentBranch]);

  const fetchInventory = useCallback(async () => {
    if (!merchant) {
      setDevices([]);
      setAccessories([]);
      setLoading(false);
      return;
    }
    if (offline) {
      loadCachedStock();
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

      const [{ data: devData, error: devErr }, { data: accData, error: accErr }] = await Promise.all([devQuery, accQuery]);
      const error = devErr || accErr;
      if (error) {
        if (isNetworkError(error)) loadCachedStock();
        else console.error('Error fetching POS inventory:', error);
        return;
      }

      const fresh = { devices: (devData || []) as Device[], accessories: (accData || []) as Accessory[] };
      setDevices(fresh.devices);
      setAccessories(fresh.accessories);
      setFromCache(false);
      if (currentBranch) saveStock(currentBranch.id, fresh);
    } catch (err) {
      if (isNetworkError(err)) loadCachedStock();
      else console.error('Error fetching POS inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant, currentBranch, offline, loadCachedStock]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  /** Takes an offline sale out of the shelf and the device's copy of the stock. */
  const applyOfflineSale = useCallback((sale: OfflineSale) => {
    const next = applySaleToStock(stockRef.current, sale);
    setDevices(next.devices);
    setAccessories(next.accessories);
    if (currentBranch) saveStock(currentBranch.id, next);
  }, [currentBranch]);

  // Scoped to the current branch: a unit can only be sold where it physically is
  // (pos_checkout enforces the same rule server-side).
  const searchByIMEI = useCallback(async (imei: string) => {
    if (!merchant) return null;
    const code = imei.trim();
    if (!/^[A-Za-z0-9-]+$/.test(code)) return null;

    if (offline) {
      return stockRef.current.devices.find(d => d.imei === code || d.imei2 === code) ?? null;
    }

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
  }, [merchant, currentBranch, offline]);

  const searchBySkuOrName = useCallback(async (query: string) => {
    if (!merchant) return { devices: [] as Device[], accessories: [] as Accessory[] };

    // Strip characters that would break the PostgREST or() filter syntax.
    const term = query.replace(/[,()*%\\]/g, ' ').trim();
    if (!term) return { devices: [] as Device[], accessories: [] as Accessory[] };

    if (offline) {
      const t = term.toLowerCase();
      const has = (v?: string | null) => !!v && v.toLowerCase().includes(t);
      return {
        devices: stockRef.current.devices.filter(d => has(d.model) || has(d.brand) || has(d.imei)).slice(0, 10),
        accessories: stockRef.current.accessories.filter(a => has(a.name) || has(a.sku)).slice(0, 10),
      };
    }

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
  }, [merchant, currentBranch, offline]);

  return {
    devices,
    accessories,
    loading,
    fromCache,
    refetch: fetchInventory,
    applyOfflineSale,
    searchByIMEI,
    searchBySkuOrName,
  };
}
