/** How a customer can pay for a website order. Tabby and Tamara are shown, not yet offered. */
export type StorePaymentMethod = 'apple_pay' | 'mada' | 'card' | 'tamara' | 'tabby' | 'cod';

export const STORE_PAYMENT_METHODS: { value: StorePaymentMethod; label: string; soon?: boolean }[] = [
  { value: 'apple_pay', label: 'Apple Pay' },
  { value: 'mada', label: 'مدى' },
  { value: 'card', label: 'فيزا / ماستركارد' },
  { value: 'tamara', label: 'تمارا', soon: true },
  { value: 'tabby', label: 'تابي', soon: true },
  { value: 'cod', label: 'الدفع عند الاستلام' },
];

// Orders placed before these options keep their own names
const OLDER: Record<string, string> = { bank_transfer: 'تحويل بنكي' };

export function storePaymentLabel(method?: string | null): string {
  if (!method) return 'الدفع عند الاستلام';
  return STORE_PAYMENT_METHODS.find(m => m.value === method)?.label ?? OLDER[method] ?? method;
}

export function isStorePaymentAvailable(method: string): boolean {
  const m = STORE_PAYMENT_METHODS.find(x => x.value === method);
  return !!m && !m.soon;
}
