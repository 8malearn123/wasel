import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Device, Accessory, DeviceStatus } from '@/types/database';
import { toast } from 'sonner';

export function useDevices() {
  const { merchant, currentBranch } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!merchant) {
      setDevices([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      let query = supabase
        .from('devices')
        .select('*, branch:branches(*), supplier:suppliers(*)')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      // Optionally filter by branch
      // if (currentBranch) {
      //   query = query.eq('branch_id', currentBranch.id);
      // }

      const { data, error } = await query;

      if (error) throw error;
      setDevices((data || []) as Device[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const addDevice = async (device: Omit<Device, 'id' | 'merchant_id' | 'created_at' | 'updated_at'>) => {
    if (!merchant) return { error: new Error('No merchant') };

    const { data, error } = await supabase
      .from('devices')
      .insert({ ...device, merchant_id: merchant.id })
      .select()
      .single();

    if (!error) {
      await fetchDevices();
      toast.success('Device added successfully');
    } else {
      toast.error(error.message);
    }

    return { data, error };
  };

  const updateDevice = async (id: string, updates: Partial<Device>) => {
    const { data, error } = await supabase
      .from('devices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      await fetchDevices();
      toast.success('Device updated');
    } else {
      toast.error(error.message);
    }

    return { data, error };
  };

  const updateDeviceStatus = async (id: string, status: DeviceStatus) => {
    return updateDevice(id, { status });
  };

  const deleteDevice = async (id: string) => {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchDevices();
      toast.success('Device deleted');
    } else {
      toast.error(error.message);
    }

    return { error };
  };

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
    addDevice,
    updateDevice,
    updateDeviceStatus,
    deleteDevice
  };
}

export function useAccessories() {
  const { merchant, currentBranch } = useAuth();
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccessories = useCallback(async () => {
    if (!merchant) {
      setAccessories([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accessories')
        .select('*, branch:branches(*), supplier:suppliers(*)')
        .eq('merchant_id', merchant.id)
        .order('name');

      if (error) throw error;
      setAccessories((data || []) as Accessory[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching accessories:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant]);

  useEffect(() => {
    fetchAccessories();
  }, [fetchAccessories]);

  const addAccessory = async (accessory: Omit<Accessory, 'id' | 'merchant_id' | 'created_at' | 'updated_at'>) => {
    if (!merchant) return { error: new Error('No merchant') };

    const { data, error } = await supabase
      .from('accessories')
      .insert({ ...accessory, merchant_id: merchant.id })
      .select()
      .single();

    if (!error) {
      await fetchAccessories();
      toast.success('Accessory added successfully');
    } else {
      toast.error(error.message);
    }

    return { data, error };
  };

  const updateAccessory = async (id: string, updates: Partial<Accessory>) => {
    const { data, error } = await supabase
      .from('accessories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      await fetchAccessories();
      toast.success('Accessory updated');
    } else {
      toast.error(error.message);
    }

    return { data, error };
  };

  const adjustQuantity = async (id: string, delta: number) => {
    const accessory = accessories.find(a => a.id === id);
    if (!accessory) return { error: new Error('Accessory not found') };

    const newQuantity = Math.max(0, accessory.quantity + delta);
    return updateAccessory(id, { quantity: newQuantity });
  };

  const deleteAccessory = async (id: string) => {
    const { error } = await supabase
      .from('accessories')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchAccessories();
      toast.success('Accessory deleted');
    } else {
      toast.error(error.message);
    }

    return { error };
  };

  return {
    accessories,
    loading,
    error,
    refetch: fetchAccessories,
    addAccessory,
    updateAccessory,
    adjustQuantity,
    deleteAccessory
  };
}
