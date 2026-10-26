// شركات الشحن المدعومة في السعودية مع روابط التتبع الرسمية
export interface Carrier {
  id: string;
  name: string;
  nameEn: string;
  // رابط تتبع الشحنة — {n} يُستبدل برقم التتبع
  track: string;
  site: string;
}

export const CARRIERS: Carrier[] = [
  { id: 'smsa', name: 'سمسا إكسبريس', nameEn: 'SMSA Express', track: 'https://www.smsaexpress.com/ar/track?tracknumbers={n}', site: 'https://smsaexpress.com' },
  { id: 'aramex', name: 'أرامكس', nameEn: 'Aramex', track: 'https://www.aramex.com/sa/ar/track/results?ShipmentNumber={n}', site: 'https://aramex.com' },
  { id: 'naqel', name: 'ناقل إكسبريس', nameEn: 'Naqel Express', track: 'https://www.naqelexpress.com/ar/track-shipment/?waybill={n}', site: 'https://naqelexpress.com' },
  { id: 'spl', name: 'البريد السعودي (سبل)', nameEn: 'Saudi Post (SPL)', track: 'https://splonline.com.sa/ar/track/?trackingNumber={n}', site: 'https://splonline.com.sa' },
  { id: 'jt', name: 'J&T إكسبريس', nameEn: 'J&T Express', track: 'https://www.jtexpress.sa/index/query/gjquery.html?bills={n}', site: 'https://jtexpress.sa' },
  { id: 'imile', name: 'آي مايل', nameEn: 'iMile', track: 'https://www.imile.com/track?billCode={n}', site: 'https://imile.com' },
  { id: 'dhl', name: 'دي إتش إل', nameEn: 'DHL', track: 'https://www.dhl.com/sa-ar/home/tracking.html?tracking-id={n}', site: 'https://dhl.com' },
  { id: 'fedex', name: 'فيدكس', nameEn: 'FedEx', track: 'https://www.fedex.com/fedextrack/?trknbr={n}', site: 'https://fedex.com' },
  { id: 'thabit', name: 'ثابت للتوصيل', nameEn: 'Thabit', track: '', site: '' },
  { id: 'own', name: 'مندوب المحل', nameEn: 'Own driver', track: '', site: '' },
];

export function carrierById(id?: string | null): Carrier | undefined {
  if (!id) return undefined;
  return CARRIERS.find(c => c.id === id.toLowerCase());
}

// رابط تتبع جاهز للشحنة (فارغ إذا الشركة ما لها نظام تتبع)
export function trackingUrl(carrierId?: string | null, number?: string | null): string | null {
  const c = carrierById(carrierId);
  if (!c || !c.track || !number) return null;
  return c.track.replace('{n}', encodeURIComponent(number));
}

// إعدادات شركات الشحن الخاصة بالتاجر
export interface CarrierSetting {
  id: string;          // معرّف الشركة
  enabled: boolean;
  account?: string;    // رقم الحساب لدى الشركة
  cost?: number;       // تكلفة الشحن مع هذه الشركة
  days?: string;       // مدة التوصيل المتوقعة
}

/**
 * How an order keeps its carrier.
 *
 * online_orders.shipping_provider is a database enum of 'aramex', 'smsa' and
 * 'other' only, so writing 'naqel', 'spl', 'jt'… failed the whole statement:
 * a customer who chose one of them at checkout could not place the order, and
 * a merchant could not ship with them. Those carriers are stored as 'other',
 * with the carrier's id in front of the tracking number — «naqel:1234567», or
 * «naqel:» before there is a number — and read back by orderShipment().
 */
const ENUM_PROVIDERS = new Set(['aramex', 'smsa']);

export function toOrderShipping(carrierId?: string | null, trackingNumber?: string | null): {
  shipping_provider: 'aramex' | 'smsa' | 'other' | null;
  tracking_number: string | null;
} {
  const number = trackingNumber?.trim() || '';
  const id = carrierId?.toLowerCase() || '';
  if (!id) return { shipping_provider: null, tracking_number: number || null };
  if (ENUM_PROVIDERS.has(id)) return { shipping_provider: id as 'aramex' | 'smsa', tracking_number: number || null };
  return { shipping_provider: 'other', tracking_number: carrierById(id) ? `${id}:${number}` : number || null };
}

export interface OrderShipment {
  /** the carrier, when it is one we know */
  carrier?: Carrier;
  /** the tracking number alone, without the carrier prefix */
  number: string | null;
  /** the carrier's own tracking page for this shipment */
  url: string | null;
}

export function orderShipment(order: { shipping_provider?: string | null; tracking_number?: string | null }): OrderShipment {
  let id = order.shipping_provider?.toLowerCase() || '';
  let number = order.tracking_number?.trim() || '';
  const prefixed = /^([a-z]+):(.*)$/.exec(number);
  if (prefixed && carrierById(prefixed[1])) {
    id = prefixed[1];
    number = prefixed[2].trim();
  }
  const carrier = carrierById(id);
  return { carrier, number: number || null, url: trackingUrl(carrier?.id, number) };
}
