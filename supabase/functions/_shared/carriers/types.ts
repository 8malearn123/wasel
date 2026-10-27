/**
 * What every carrier adapter offers. An adapter only builds requests and reads
 * responses; the HTTP call is passed in, so it runs the same in the edge
 * function (Deno) and in the unit tests (vitest), and no key ever reaches the
 * browser: credentials come from the function's environment (Supabase secrets).
 */

export interface Address {
  name: string;
  phone: string;
  line1: string;
  city: string;
  countryCode: string; // ISO 3166-1 alpha-2, 'SA'
  email?: string | null;
  postalCode?: string | null;
}

export interface Parcel {
  weightKg: number;
  pieces: number;
  description: string;
  /** cash to collect on delivery, SAR; 0 when paid */
  codAmount?: number;
  reference?: string; // our order number
}

export interface Rate {
  amount: number;
  currency: string;
  /** what the carrier says about the transit time, when it says anything */
  transitDays?: string | null;
}

export interface CreatedShipment {
  trackingNumber: string;
  labelUrl?: string | null;
}

export interface TrackingEvent {
  at: string;
  code: string;
  description: string;
  location?: string | null;
}

export type HttpCall = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
  Promise<{ status: number; json: () => Promise<unknown> }>;

export class CarrierError extends Error {
  constructor(public carrier: string, message: string, public detail?: unknown) {
    super(`${carrier}: ${message}`);
  }
}

export interface CarrierAdapter {
  id: string;
  /** names of the secrets this adapter needs; all must be set */
  secrets: string[];
  rate(http: HttpCall, env: Record<string, string>, from: Address, to: Address, parcel: Parcel): Promise<Rate>;
  create(http: HttpCall, env: Record<string, string>, from: Address, to: Address, parcel: Parcel): Promise<CreatedShipment>;
  track(http: HttpCall, env: Record<string, string>, trackingNumber: string): Promise<TrackingEvent[]>;
}
