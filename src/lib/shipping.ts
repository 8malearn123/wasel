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
