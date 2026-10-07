import type { ShippingService, ShippingCarrier, CarrierInput, Result } from '../contracts';
import { mockCarriers, mockShipments } from '@/mock/fixtures';

/** Mock. See src/mock/README.md. Replace in src/services/index.ts. */
const delay = (ms = 400) => new Promise(r => setTimeout(r, ms));
const ok = <T,>(data: T): Result<T> => ({ status: 'ok', data });

let carriers = [...mockCarriers];

export const mockShippingService: ShippingService = {
  async listCarriers() {
    await delay();
    return ok(carriers);
  },

  async createCarrier(input: CarrierInput) {
    await delay();
    if (!input.name?.trim()) {
      return { status: 'error' as const, error: { code: 'validation', message: 'اسم الشركة مطلوب' } };
    }
    const carrier: ShippingCarrier = {
      id: `mock-carrier-${Date.now()}`,
      name: input.name.trim(),
      logoUrl: input.logoUrl ?? null,
      serviceType: input.serviceType ?? null,
      isActive: input.isActive,
      // A carrier only becomes connected once the backend holds its
      // credentials; the frontend never sets this itself.
      connectionStatus: 'not_configured',
      credentialsSet: false,
      lastSyncAt: null,
      shipmentCount: null,
      createdAt: new Date().toISOString(),
    };
    carriers = [carrier, ...carriers];
    return ok(carrier);
  },

  async updateCarrier(id, input) {
    await delay();
    const found = carriers.find(c => c.id === id);
    if (!found) return { status: 'error' as const, error: { code: 'not_found', message: 'الشركة غير موجودة' } };
    const updated = { ...found, ...input } as ShippingCarrier;
    carriers = carriers.map(c => (c.id === id ? updated : c));
    return ok(updated);
  },

  async setCarrierActive(id, isActive) {
    return this.updateCarrier(id, { isActive });
  },

  async testConnection() {
    await delay(700);
    // Honest: there is no carrier account to reach, so the mock reports exactly
    // that rather than faking a green tick.
    return {
      status: 'error' as const,
      error: {
        code: 'unavailable',
        message: 'لا توجد بيانات اتصال محفوظة لهذه الشركة بعد — يحفظها الخادم بعد تزويده بمفاتيح الشركة',
      },
    };
  },

  async listShipments(query) {
    await delay();
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 25;
    return ok({ items: mockShipments, total: mockShipments.length, page, pageSize });
  },

  async refreshTracking() {
    await delay();
    return { status: 'error' as const, error: { code: 'unavailable', message: 'التتبع يحتاج اتصالاً فعلياً بشركة الشحن' } };
  },
};
