import { describe, it, expect } from 'vitest';
import { aramex, aramexDate } from './aramex';
import { dhl } from './dhl';
import { carrierStatus } from './index';
import { CarrierError, type HttpCall } from './types';

const from = { name: 'متجر الأنام', phone: '0551000000', line1: 'طريق الملك فهد', city: 'Riyadh', countryCode: 'SA' };
const to = { name: 'نورة السالم', phone: '0554443332', line1: 'حي النرجس', city: 'Riyadh', countryCode: 'SA' };
const parcel = { weightKg: 1.5, pieces: 2, description: 'iPhone 14 Pro', codAmount: 1150, reference: 'ON-DEMO-001' };

const ARAMEX_ENV = { ARAMEX_USERNAME: 'u', ARAMEX_PASSWORD: 'p', ARAMEX_ACCOUNT_NUMBER: '123', ARAMEX_ACCOUNT_PIN: '321', ARAMEX_ACCOUNT_ENTITY: 'RUH', ARAMEX_ACCOUNT_COUNTRY_CODE: 'SA' };
const DHL_ENV = { DHL_API_KEY: 'k', DHL_API_SECRET: 's', DHL_ACCOUNT_NUMBER: '960000000' };

/** records the request and answers with a fixture */
function fake(status: number, response: unknown) {
  const calls: { url: string; init: any }[] = [];
  const http: HttpCall = async (url, init) => { calls.push({ url, init }); return { status, json: async () => response }; };
  return { http, calls };
}

describe('aramex', () => {
  it('asks for a domestic COD rate with the account in ClientInfo', async () => {
    const { http, calls } = fake(200, { HasErrors: false, TotalAmount: { CurrencyCode: 'SAR', Value: 27.5 } });
    expect(await aramex.rate(http, ARAMEX_ENV, from, to, parcel)).toEqual({ amount: 27.5, currency: 'SAR', transitDays: null });
    expect(calls[0].url).toBe('https://ws.aramex.net/ShippingAPI.V2/RateCalculator/Service_1_0.svc/json/CalculateRate');
    const body = JSON.parse(calls[0].init.body);
    expect(body.ClientInfo).toMatchObject({ UserName: 'u', AccountNumber: '123', AccountPin: '321', AccountEntity: 'RUH', AccountCountryCode: 'SA', Version: 'v1.0' });
    expect(body.ShipmentDetails).toMatchObject({ ProductGroup: 'DOM', ProductType: 'ONP', NumberOfPieces: 2, Services: 'CODS', CashOnDeliveryAmount: { CurrencyCode: 'SAR', Value: 1150 } });
  });

  it('creates a shipment and returns its number and label', async () => {
    const { http, calls } = fake(200, { HasErrors: false, Shipments: [{ ID: '44015555555', ShipmentLabel: { LabelURL: 'https://label' } }] });
    expect(await aramex.create(http, ARAMEX_ENV, from, to, parcel)).toEqual({ trackingNumber: '44015555555', labelUrl: 'https://label' });
    const s = JSON.parse(calls[0].init.body).Shipments[0];
    expect(s.Reference1).toBe('ON-DEMO-001');
    expect(s.Consignee.Contact).toMatchObject({ PersonName: 'نورة السالم', PhoneNumber1: '0554443332' });
  });

  it('reads tracking events and Aramex dates', async () => {
    const { http } = fake(200, { HasErrors: false, TrackingResults: [{ Key: '440', Value: [{ UpdateCode: 'SH005', UpdateDescription: 'Delivered', UpdateDateTime: '/Date(1730000000000+0300)/', UpdateLocation: 'Riyadh' }] }] });
    expect(await aramex.track(http, ARAMEX_ENV, '440')).toEqual([{ at: '2024-10-27T03:33:20.000Z', code: 'SH005', description: 'Delivered', location: 'Riyadh' }]);
    expect(aramexDate('not a date')).toBe('not a date');
  });

  it('turns Aramex notifications into an error, never a fake success', async () => {
    const { http } = fake(200, { HasErrors: true, Notifications: [{ Code: 'ERR01', Message: 'Invalid credentials' }] });
    await expect(aramex.rate(http, ARAMEX_ENV, from, to, parcel)).rejects.toThrow(CarrierError);
    await expect(aramex.rate(http, ARAMEX_ENV, from, to, parcel)).rejects.toThrow('ERR01: Invalid credentials');
  });
});

describe('dhl', () => {
  it('asks for rates with Basic auth and reads the billing-currency price', async () => {
    const { http, calls } = fake(200, { products: [{ totalPrice: [{ currencyType: 'BILLC', priceCurrency: 'SAR', price: 64.2 }], deliveryCapabilities: { totalTransitDays: 2 } }] });
    expect(await dhl.rate(http, DHL_ENV, from, to, parcel)).toEqual({ amount: 64.2, currency: 'SAR', transitDays: '2' });
    expect(calls[0].url).toContain('https://express.api.dhl.com/mydhlapi/rates?accountNumber=960000000');
    expect(calls[0].init.headers.Authorization).toBe(`Basic ${btoa('k:s')}`);
  });

  it('creates a shipment and tracks it', async () => {
    const created = fake(201, { shipmentTrackingNumber: '1234567890', documents: [{ url: 'https://doc' }] });
    expect(await dhl.create(created.http, DHL_ENV, from, to, parcel)).toEqual({ trackingNumber: '1234567890', labelUrl: 'https://doc' });
    const tracked = fake(200, { shipments: [{ events: [{ date: '2026-10-27', time: '10:00:00', typeCode: 'OK', description: 'Delivered', serviceArea: [{ description: 'Riyadh-SA' }] }] }] });
    expect(await dhl.track(tracked.http, DHL_ENV, '1234567890')).toEqual([{ at: '2026-10-27T10:00:00', code: 'OK', description: 'Delivered', location: 'Riyadh-SA' }]);
  });

  it('reports DHL errors', async () => {
    const { http } = fake(401, { title: 'Unauthorized', detail: 'Invalid credentials' });
    await expect(dhl.track(http, DHL_ENV, '1')).rejects.toThrow('dhl: Invalid credentials');
  });
});

describe('carrier status', () => {
  it('a carrier is configured only when every one of its secrets is set', () => {
    const none = carrierStatus({});
    expect(none.find(c => c.id === 'aramex')).toMatchObject({ api: 'adapter', configured: false, missingSecrets: expect.arrayContaining(['ARAMEX_PASSWORD']) });
    expect(none.find(c => c.id === 'smsa')).toMatchObject({ api: 'contract', configured: false });
    const partial = carrierStatus({ ...ARAMEX_ENV, ARAMEX_ACCOUNT_PIN: '' });
    expect(partial.find(c => c.id === 'aramex')).toMatchObject({ configured: false, missingSecrets: ['ARAMEX_ACCOUNT_PIN'] });
    expect(carrierStatus({ ...ARAMEX_ENV, ...DHL_ENV }).filter(c => c.configured).map(c => c.id)).toEqual(['aramex', 'dhl']);
  });
});
