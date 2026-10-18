import type { PaymentMethod } from '@/types/database';

/** Tender methods a cashier can pick at the POS. store_credit / trade_in arrive with their modules. */
export const POS_TENDER_METHODS = ['cash', 'mada', 'card', 'apple_pay', 'stc_pay', 'bank_transfer'] as const;
export type TenderMethod = (typeof POS_TENDER_METHODS)[number];

/** One tender line of a sale, e.g. { method: 'mada', amount: 650 } — mirrors public.sale_payments. */
export interface PaymentLine {
  method: TenderMethod;
  amount: number;
  reference?: string;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { ar: string; en: string }> = {
  cash: { ar: 'نقداً', en: 'Cash' },
  card: { ar: 'بطاقة', en: 'Card' },
  mada: { ar: 'مدى', en: 'Mada' },
  apple_pay: { ar: 'Apple Pay', en: 'Apple Pay' },
  stc_pay: { ar: 'STC Pay', en: 'STC Pay' },
  bank_transfer: { ar: 'تحويل', en: 'Transfer' },
  store_credit: { ar: 'رصيد المتجر', en: 'Store credit' },
  trade_in: { ar: 'استبدال جهاز', en: 'Trade-in' },
  mixed: { ar: 'مختلط', en: 'Mixed' },
};

export function paymentMethodLabel(method: string, isRTL = true): string {
  const label = PAYMENT_METHOD_LABELS[method as PaymentMethod];
  return label ? label[isRTL ? 'ar' : 'en'] : method;
}

/** Close-out buckets: cash in the drawer, card terminal / wallets, bank transfers. */
export type TenderBucket = 'cash' | 'card' | 'bank_transfer';

export function tenderBucket(method: string): TenderBucket | null {
  switch (method) {
    case 'cash':
      return 'cash';
    case 'card':
    case 'mada':
    case 'apple_pay':
    case 'stc_pay':
      return 'card';
    case 'bank_transfer':
      return 'bank_transfer';
    default:
      return null;
  }
}

interface SaleTenderSource {
  total_amount: number | string;
  payment_method: string;
  payments?: { method: string; amount: number | string }[] | null;
}

/**
 * Splits a sale's total into close-out buckets from its tender lines.
 * Legacy sales without lines fall back to the header method ('mixed' split 50/50, as before).
 */
export function tenderBreakdown(sale: SaleTenderSource): Record<TenderBucket, number> {
  const out: Record<TenderBucket, number> = { cash: 0, card: 0, bank_transfer: 0 };
  if (sale.payments && sale.payments.length > 0) {
    for (const p of sale.payments) {
      const bucket = tenderBucket(p.method);
      if (bucket) out[bucket] += Number(p.amount);
    }
    return out;
  }
  const amount = Number(sale.total_amount);
  if (sale.payment_method === 'mixed') {
    out.cash += amount / 2;
    out.card += amount / 2;
  } else {
    const bucket = tenderBucket(sale.payment_method);
    if (bucket) out[bucket] += amount;
  }
  return out;
}
