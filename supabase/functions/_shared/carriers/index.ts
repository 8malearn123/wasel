/**
 * The carriers the shipping page lists (src/lib/shipping.ts), and for each:
 * whether an API adapter exists here, and what the owner must obtain from the
 * carrier to switch it on. An adapter is «configured» only when every secret it
 * names is set in the function's environment — nothing is assumed to work.
 */
import type { CarrierAdapter } from './types.ts';
import { aramex } from './aramex.ts';
import { dhl } from './dhl.ts';

export const ADAPTERS: Record<string, CarrierAdapter> = { aramex, dhl };

/** What to ask each carrier for, as the carriers describe their onboarding */
export const REQUIREMENTS: Record<string, { api: 'adapter' | 'contract' | 'none'; needs: string }> = {
  aramex: { api: 'adapter', needs: 'حساب أرامكس تجاري مع صلاحية Shipping Services API: اسم مستخدم وكلمة مرور الـAPI، رقم الحساب، PIN الحساب، Entity (مثل RUH) ورمز الدولة SA' },
  dhl: { api: 'adapter', needs: 'حساب DHL Express ومفتاح وسر MyDHL API من developer.dhl.com، ورقم الحساب' },
  smsa: { api: 'contract', needs: 'حساب سمسا تجاري ومفتاح API (passkey) مع توثيق واجهتها الذي تسلّمه سمسا للعميل بعد التعاقد' },
  naqel: { api: 'contract', needs: 'حساب ناقل تجاري وبيانات الدخول لواجهتها (تُسلَّم مع التعاقد)' },
  spl: { api: 'contract', needs: 'حساب أعمال لدى البريد السعودي (سبل) واشتراك في واجهات الشحن الخاصة به' },
  jt: { api: 'contract', needs: 'حساب J&T Express السعودية وبيانات API (customer code والمفاتيح) من مدير الحساب' },
  imile: { api: 'contract', needs: 'حساب iMile وبيانات Open API (customer id والمفتاح)' },
  fedex: { api: 'contract', needs: 'حساب FedEx ومفتاح وسر من developer.fedex.com (OAuth) — يحتاج adapter إضافي' },
  thabit: { api: 'none', needs: 'لا توجد واجهة برمجية منشورة؛ يُشحن يدويًا' },
  own: { api: 'none', needs: 'مندوب المحل — لا يحتاج ربطًا' },
};

export function configured(adapter: CarrierAdapter, env: Record<string, string | undefined>): boolean {
  return adapter.secrets.every(k => !!env[k]);
}

export function carrierStatus(env: Record<string, string | undefined>) {
  return Object.entries(REQUIREMENTS).map(([id, r]) => ({
    id,
    api: r.api,
    configured: ADAPTERS[id] ? configured(ADAPTERS[id], env) : false,
    needs: r.needs,
    missingSecrets: ADAPTERS[id] ? ADAPTERS[id].secrets.filter(k => !env[k]) : [],
  }));
}
