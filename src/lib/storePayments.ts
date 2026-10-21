/** How a customer can pay for a website order. */
export type StorePaymentMethod = 'apple_pay' | 'mada' | 'card' | 'tamara' | 'tabby' | 'cod';

/**
 * No payment gateway is connected to the store yet (Apple Pay, mada and cards
 * need one such as Moyasar or HyperPay; Tamara and Tabby their own). Until one
 * is, only cash on delivery can really be taken — the others are shown, not offered.
 */
export const PAYMENT_GATEWAY_CONNECTED = false;

export const STORE_PAYMENT_METHODS: { value: StorePaymentMethod; label: string; gateway: boolean; payLabel: string }[] = [
  { value: 'apple_pay', label: 'Apple Pay', gateway: true, payLabel: 'الدفع باستخدام Apple Pay' },
  { value: 'mada', label: 'مدى', gateway: true, payLabel: 'الدفع بمدى' },
  { value: 'card', label: 'فيزا / ماستركارد', gateway: true, payLabel: 'الدفع بالبطاقة' },
  { value: 'tamara', label: 'تمارا', gateway: true, payLabel: 'الدفع عبر تمارا' },
  { value: 'tabby', label: 'تابي', gateway: true, payLabel: 'الدفع عبر تابي' },
  { value: 'cod', label: 'الدفع عند الاستلام', gateway: false, payLabel: 'إتمام الطلب' },
];

// Orders placed before these options keep their own names
const OLDER: Record<string, string> = { bank_transfer: 'تحويل بنكي' };

export function storePaymentLabel(method?: string | null): string {
  if (!method) return 'الدفع عند الاستلام';
  return STORE_PAYMENT_METHODS.find(m => m.value === method)?.label ?? OLDER[method] ?? method;
}

export function isStorePaymentAvailable(method: string): boolean {
  const m = STORE_PAYMENT_METHODS.find(x => x.value === method);
  return !!m && (!m.gateway || PAYMENT_GATEWAY_CONNECTED);
}

/** What the checkout's button says for the chosen method */
export function payButtonLabel(method: string): string {
  return STORE_PAYMENT_METHODS.find(m => m.value === method)?.payLabel ?? 'إتمام الطلب';
}
