import { describe, it, expect } from 'vitest';
import { STORE_PAYMENT_METHODS, storePaymentLabel, isStorePaymentAvailable, payButtonLabel } from './storePayments';

describe('store payment methods', () => {
  it('shows the six options, in order', () => {
    expect(STORE_PAYMENT_METHODS.map(m => m.value)).toEqual(['apple_pay', 'mada', 'card', 'tamara', 'tabby', 'cod']);
  });

  it('offers only what can really be taken without a payment gateway', () => {
    expect(STORE_PAYMENT_METHODS.filter(m => isStorePaymentAvailable(m.value)).map(m => m.value)).toEqual(['cod']);
    expect(isStorePaymentAvailable('mixed')).toBe(false);
  });

  it('the button follows the method', () => {
    expect(payButtonLabel('apple_pay')).toBe('الدفع باستخدام Apple Pay');
    expect(payButtonLabel('cod')).toBe('إتمام الطلب');
  });

  it('names new and older orders', () => {
    expect(storePaymentLabel('mada')).toBe('مدى');
    expect(storePaymentLabel('bank_transfer')).toBe('تحويل بنكي');
    expect(storePaymentLabel('cod')).toBe('الدفع عند الاستلام');
  });
});
