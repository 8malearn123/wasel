/**
 * Aramex — the official «Shipping Services API» (JSON endpoints of the
 * ShippingAPI.V2 services: RateCalculator, Shipping, Tracking).
 * Reference: https://www.aramex.com/developers (Shipping Services API manual).
 *
 * Needs an Aramex account with API access: user name and password of the API
 * user, account number, account PIN, account entity (e.g. RUH) and country
 * code (SA). ARAMEX_BASE_URL may point at Aramex's test environment
 * (https://ws.sbx.aramex.net) while testing; production is the default.
 *
 * Not yet run against Aramex: no account is configured. The unit tests cover
 * the requests this sends and how it reads Aramex's documented responses.
 */
import type { Address, CarrierAdapter, HttpCall, Parcel } from './types.ts';
import { CarrierError } from './types.ts';

const BASE = 'https://ws.aramex.net';

const clientInfo = (env: Record<string, string>) => ({
  UserName: env.ARAMEX_USERNAME,
  Password: env.ARAMEX_PASSWORD,
  Version: 'v1.0',
  AccountNumber: env.ARAMEX_ACCOUNT_NUMBER,
  AccountPin: env.ARAMEX_ACCOUNT_PIN,
  AccountEntity: env.ARAMEX_ACCOUNT_ENTITY,
  AccountCountryCode: env.ARAMEX_ACCOUNT_COUNTRY_CODE,
  Source: 24,
});

const domestic = (from: Address, to: Address) => from.countryCode === to.countryCode;

const details = (env: Record<string, string>, from: Address, to: Address, parcel: Parcel) => ({
  ActualWeight: { Unit: 'KG', Value: parcel.weightKg },
  ChargeableWeight: { Unit: 'KG', Value: parcel.weightKg },
  NumberOfPieces: parcel.pieces,
  ProductGroup: domestic(from, to) ? 'DOM' : 'EXP',
  ProductType: env.ARAMEX_PRODUCT_TYPE || (domestic(from, to) ? 'ONP' : 'PPX'),
  PaymentType: 'P',
  DescriptionOfGoods: parcel.description,
  GoodsOriginCountry: from.countryCode,
  Services: parcel.codAmount ? 'CODS' : '',
  ...(parcel.codAmount ? { CashOnDeliveryAmount: { CurrencyCode: 'SAR', Value: parcel.codAmount } } : {}),
});

const party = (a: Address, account?: string) => ({
  Reference1: '',
  AccountNumber: account ?? '',
  PartyAddress: { Line1: a.line1, City: a.city, CountryCode: a.countryCode, PostCode: a.postalCode ?? '' },
  Contact: { PersonName: a.name, CompanyName: a.name, PhoneNumber1: a.phone, CellPhone: a.phone, EmailAddress: a.email ?? '' },
});

async function post(http: HttpCall, env: Record<string, string>, path: string, body: unknown) {
  const res = await http(`${env.ARAMEX_BASE_URL || BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, any>;
  if (res.status >= 400 || data?.HasErrors) {
    const notes = (data?.Notifications ?? []).map((n: any) => `${n.Code}: ${n.Message}`).join('; ');
    throw new CarrierError('aramex', notes || `HTTP ${res.status}`, data);
  }
  return data;
}

/** Aramex dates look like «/Date(1730000000000+0300)/» */
export const aramexDate = (v: string) => {
  const ms = /\/Date\((\d+)/.exec(v ?? '')?.[1];
  return ms ? new Date(Number(ms)).toISOString() : v;
};

export const aramex: CarrierAdapter = {
  id: 'aramex',
  secrets: ['ARAMEX_USERNAME', 'ARAMEX_PASSWORD', 'ARAMEX_ACCOUNT_NUMBER', 'ARAMEX_ACCOUNT_PIN', 'ARAMEX_ACCOUNT_ENTITY', 'ARAMEX_ACCOUNT_COUNTRY_CODE'],

  async rate(http, env, from, to, parcel) {
    const data = await post(http, env, '/ShippingAPI.V2/RateCalculator/Service_1_0.svc/json/CalculateRate', {
      ClientInfo: clientInfo(env),
      OriginAddress: { City: from.city, CountryCode: from.countryCode },
      DestinationAddress: { City: to.city, CountryCode: to.countryCode },
      ShipmentDetails: details(env, from, to, parcel),
      PreferredCurrencyCode: 'SAR',
    });
    return { amount: Number(data.TotalAmount?.Value), currency: data.TotalAmount?.CurrencyCode ?? 'SAR', transitDays: null };
  },

  async create(http, env, from, to, parcel) {
    const data = await post(http, env, '/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments', {
      ClientInfo: clientInfo(env),
      LabelInfo: { ReportID: 9201, ReportType: 'URL' },
      Shipments: [{
        Reference1: parcel.reference ?? '',
        Shipper: party(from, env.ARAMEX_ACCOUNT_NUMBER),
        Consignee: party(to),
        ShippingDateTime: `/Date(${Date.now()})/`,
        Details: details(env, from, to, parcel),
      }],
    });
    const s = data.Shipments?.[0];
    if (!s?.ID) throw new CarrierError('aramex', 'no shipment number in the response', data);
    return { trackingNumber: String(s.ID), labelUrl: s.ShipmentLabel?.LabelURL ?? null };
  },

  async track(http, env, trackingNumber) {
    const data = await post(http, env, '/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments', {
      ClientInfo: clientInfo(env),
      GetLastTrackingUpdateOnly: false,
      Shipments: [trackingNumber],
    });
    const result = (data.TrackingResults ?? []).find((r: any) => String(r.Key) === trackingNumber);
    return (result?.Value ?? []).map((e: any) => ({
      at: aramexDate(e.UpdateDateTime),
      code: String(e.UpdateCode ?? ''),
      description: String(e.UpdateDescription ?? ''),
      location: e.UpdateLocation ?? null,
    }));
  },
};
