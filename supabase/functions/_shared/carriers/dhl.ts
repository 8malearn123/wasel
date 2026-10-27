/**
 * DHL Express — the official MyDHL API (REST, Basic auth).
 * Reference: https://developer.dhl.com/api-reference/dhl-express-mydhl-api
 *
 * Needs a DHL Express account and a MyDHL API key/secret issued for it, plus
 * the account number. DHL_BASE_URL may point at the test environment
 * (https://express.api.dhl.com/mydhlapi/test); production is the default.
 *
 * Not yet run against DHL: no account is configured. The unit tests cover the
 * requests this sends and how it reads DHL's documented responses.
 */
import type { CarrierAdapter, HttpCall } from './types.ts';
import { CarrierError } from './types.ts';

const BASE = 'https://express.api.dhl.com/mydhlapi';

const auth = (env: Record<string, string>) => {
  const raw = `${env.DHL_API_KEY}:${env.DHL_API_SECRET}`;
  return `Basic ${typeof btoa === 'function' ? btoa(raw) : Buffer.from(raw).toString('base64')}`;
};

async function call(http: HttpCall, env: Record<string, string>, method: string, path: string, body?: unknown) {
  const res = await http(`${env.DHL_BASE_URL || BASE}${path}`, {
    method,
    headers: { Authorization: auth(env), Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as Record<string, any>;
  if (res.status >= 400) throw new CarrierError('dhl', data?.detail || data?.title || `HTTP ${res.status}`, data);
  return data;
}

const today = () => new Date().toISOString().slice(0, 10);

export const dhl: CarrierAdapter = {
  id: 'dhl',
  secrets: ['DHL_API_KEY', 'DHL_API_SECRET', 'DHL_ACCOUNT_NUMBER'],

  async rate(http, env, from, to, parcel) {
    const q = new URLSearchParams({
      accountNumber: env.DHL_ACCOUNT_NUMBER,
      originCountryCode: from.countryCode, originCityName: from.city,
      destinationCountryCode: to.countryCode, destinationCityName: to.city,
      weight: String(parcel.weightKg), length: '20', width: '15', height: '10',
      plannedShippingDate: today(), isCustomsDeclarable: String(from.countryCode !== to.countryCode),
      unitOfMeasurement: 'metric',
    });
    const data = await call(http, env, 'GET', `/rates?${q}`);
    const product = data.products?.[0];
    const price = product?.totalPrice?.find((p: any) => p.currencyType === 'BILLC') ?? product?.totalPrice?.[0];
    if (!price) throw new CarrierError('dhl', 'no price in the response', data);
    return {
      amount: Number(price.price),
      currency: price.priceCurrency ?? 'SAR',
      transitDays: product?.deliveryCapabilities?.totalTransitDays != null ? String(product.deliveryCapabilities.totalTransitDays) : null,
    };
  },

  async create(http, env, from, to, parcel) {
    const party = (a: typeof from) => ({
      postalAddress: { cityName: a.city, countryCode: a.countryCode, addressLine1: a.line1, postalCode: a.postalCode ?? '' },
      contactInformation: { fullName: a.name, companyName: a.name, phone: a.phone, email: a.email ?? undefined },
    });
    const data = await call(http, env, 'POST', '/shipments', {
      plannedShippingDateAndTime: `${today()}T12:00:00 GMT+03:00`,
      pickup: { isRequested: false },
      productCode: env.DHL_PRODUCT_CODE || (from.countryCode === to.countryCode ? 'N' : 'P'),
      accounts: [{ typeCode: 'shipper', number: env.DHL_ACCOUNT_NUMBER }],
      customerDetails: { shipperDetails: party(from), receiverDetails: party(to) },
      content: {
        packages: [{ weight: parcel.weightKg, dimensions: { length: 20, width: 15, height: 10 } }],
        isCustomsDeclarable: from.countryCode !== to.countryCode,
        description: parcel.description,
        incoterm: 'DAP',
        unitOfMeasurement: 'metric',
      },
      ...(parcel.reference ? { customerReferences: [{ value: parcel.reference, typeCode: 'CU' }] } : {}),
      outputImageProperties: { imageOptions: [{ typeCode: 'label', templateName: 'ECOM26_84_001' }] },
    });
    if (!data.shipmentTrackingNumber) throw new CarrierError('dhl', 'no tracking number in the response', data);
    return { trackingNumber: String(data.shipmentTrackingNumber), labelUrl: data.documents?.[0]?.url ?? null };
  },

  async track(http, env, trackingNumber) {
    const data = await call(http, env, 'GET', `/shipments/${encodeURIComponent(trackingNumber)}/tracking?trackingView=all-checkpoints`);
    const events = data.shipments?.[0]?.events ?? [];
    return events.map((e: any) => ({
      at: `${e.date}T${e.time ?? '00:00:00'}`,
      code: String(e.typeCode ?? ''),
      description: String(e.description ?? ''),
      location: e.serviceArea?.[0]?.description ?? null,
    }));
  },
};
