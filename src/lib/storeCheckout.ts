import { CARRIERS } from './shipping';
import { mapsLink, type DeliveryPoint } from './deliveryLocation';
import { getOrders } from './storeOrdersHistory';

// ── The customer ───────────────────────────────────────────────────────────
// The store has no customer accounts: what a shopper entered is kept on their
// own device, per store, and offered back at their next checkout.

/** A Saudi national address, as the customer wrote it — not verified by any service. */
export interface NationalAddress {
  city: string;
  district: string;
  street: string;
  building: string;
  /** الرقم الإضافي */
  additional: string;
  postal: string;
  /** العنوان المختصر: 4 letters, 4 digits (e.g. RRRD2929) */
  shortCode: string;
  location: DeliveryPoint | null;
}

export interface CheckoutCustomer {
  name: string;
  phone: string;
  email: string;
  address: NationalAddress | null;
}

export const EMPTY_ADDRESS: NationalAddress = {
  city: '', district: '', street: '', building: '', additional: '', postal: '', shortCode: '', location: null,
};

const key = (slug: string) => `wasil_store_customer_${slug}`;

export function loadCustomer(slug: string): CheckoutCustomer {
  try {
    const raw = localStorage.getItem(key(slug));
    if (raw) {
      const c = JSON.parse(raw) as Partial<CheckoutCustomer>;
      return { name: c.name || '', phone: c.phone || '', email: c.email || '', address: c.address ?? null };
    }
  } catch { /* storage off */ }
  // Someone who ordered here before, from before this was remembered
  const last = getOrders(slug)[0];
  return { name: last?.customer_name || '', phone: last?.customer_phone || '', email: '', address: null };
}

export function saveCustomer(slug: string, customer: CheckoutCustomer) {
  try { localStorage.setItem(key(slug), JSON.stringify(customer)); } catch { /* storage off */ }
}

export const normaliseShortCode = (s: string) => s.replace(/\s+/g, '').toUpperCase();
export const isShortCode = (s: string) => /^[A-Z]{4}\d{4}$/.test(normaliseShortCode(s));

export function addressProblem(a: NationalAddress): string | null {
  if (!a.city.trim()) return 'المدينة مطلوبة';
  if (!a.district.trim()) return 'الحي مطلوب';
  if (!a.street.trim()) return 'اسم الشارع مطلوب';
  if (a.building && !/^\d{4}$/.test(a.building.trim())) return 'رقم المبنى 4 أرقام';
  if (a.additional && !/^\d{4}$/.test(a.additional.trim())) return 'الرقم الإضافي 4 أرقام';
  if (a.postal && !/^\d{5}$/.test(a.postal.trim())) return 'الرمز البريدي 5 أرقام';
  if (a.shortCode && !isShortCode(a.shortCode)) return 'العنوان المختصر 4 حروف ثم 4 أرقام، مثل RRRD2929';
  return null;
}

/** One readable line: building, street, district — city, postal code */
export function addressLine(a: NationalAddress): string {
  const first = [a.building && `مبنى ${a.building}`, a.street, a.district && `حي ${a.district}`].filter(Boolean).join('، ');
  const second = [a.city, a.postal && `الرمز البريدي ${a.postal}`, a.additional && `الرقم الإضافي ${a.additional}`].filter(Boolean).join('، ');
  return [first, second].filter(Boolean).join(' — ');
}

/**
 * The order's address text. The carrier and the map pin ride along in it, so
 * the order needs no new column; the pin stays last, where the shop's orders
 * screen looks for it.
 */
export function orderAddress(a: NationalAddress, carrierNote?: string): string {
  return [
    addressLine(a),
    a.shortCode && `العنوان المختصر: ${normaliseShortCode(a.shortCode)}`,
    carrierNote && `🚚 شركة الشحن: ${carrierNote}`,
    a.location && `📍 الموقع على الخريطة: ${mapsLink(a.location)}`,
  ].filter(Boolean).join('\n');
}

// ── Shipping ───────────────────────────────────────────────────────────────

export interface ShippingOption {
  /** a carrier's id, or 'store' when the shop delivers at its own rate */
  id: string;
  name: string;
  days?: string;
  /** before the free-shipping threshold */
  cost: number;
}

type CarrierSetting = { id: string; enabled: boolean; cost?: number; days?: string };

/** The carriers the merchant switched on; the store's own rate when there are none. */
export function shippingOptions(
  store: { shipping_cost: number | null },
  carriers: CarrierSetting[] | undefined,
): ShippingOption[] {
  const base = Number(store.shipping_cost || 0);
  const on = (carriers || [])
    .filter(c => c.enabled)
    .map((c): ShippingOption | null => {
      const known = CARRIERS.find(k => k.id === c.id);
      return known ? { id: c.id, name: known.name, days: c.days?.trim() || undefined, cost: c.cost ?? base } : null;
    })
    .filter((o): o is ShippingOption => !!o);
  return on.length ? on : [{ id: 'store', name: 'توصيل المتجر', cost: base }];
}

export function shippingCost(
  option: ShippingOption | undefined,
  subtotal: number,
  store: { shipping_cost: number | null; free_shipping_threshold: number | null },
): number {
  if (store.free_shipping_threshold && subtotal >= store.free_shipping_threshold) return 0;
  return Number(option?.cost ?? store.shipping_cost ?? 0);
}
