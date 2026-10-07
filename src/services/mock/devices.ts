import type { DeviceService, ConnectedDevice, DeviceInput, Result } from '../contracts';
import { mockDevices } from '@/mock/fixtures';

/** Mock. See src/mock/README.md. Replace in src/services/index.ts. */
const delay = (ms = 350) => new Promise(r => setTimeout(r, ms));
const ok = <T,>(data: T): Result<T> => ({ status: 'ok', data });

let devices = [...mockDevices];

export const mockDeviceService: DeviceService = {
  async list() {
    await delay();
    return ok(devices);
  },

  async create(input: DeviceInput) {
    await delay();
    if (!input.name?.trim()) {
      return { status: 'error' as const, error: { code: 'validation', message: 'اسم الجهاز مطلوب' } };
    }
    const device: ConnectedDevice = {
      id: `mock-device-${Date.now()}`,
      name: input.name.trim(),
      kind: input.kind?.trim() || 'غير محدد',
      model: input.model ?? null,
      branchName: null,
      status: 'never_connected',
      lastSeenAt: null,
      lastSyncAt: null,
      createdAt: new Date().toISOString(),
    };
    devices = [device, ...devices];
    return ok(device);
  },

  async update(id, input) {
    await delay();
    const found = devices.find(d => d.id === id);
    if (!found) return { status: 'error' as const, error: { code: 'not_found', message: 'الجهاز غير موجود' } };
    const updated = { ...found, ...input } as ConnectedDevice;
    devices = devices.map(d => (d.id === id ? updated : d));
    return ok(updated);
  },

  async remove(id) {
    await delay();
    devices = devices.filter(d => d.id !== id);
    return ok(undefined);
  },

  async testConnection() {
    await delay(800);
    // No device type has been chosen, so there is nothing to reach.
    return {
      status: 'error' as const,
      error: {
        code: 'unavailable',
        message: 'لم يُحدَّد نوع الجهاز ولا طريقة اتصاله بعد',
      },
    };
  },
};
