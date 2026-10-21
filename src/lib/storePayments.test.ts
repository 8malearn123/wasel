import { describe, it, expect } from 'vitest';
import { STORE_PAYMENT_METHODS, storePaymentLabel, isStorePaymentAvailable } from './storePayments';

describe('store payment methods', () => {
  it('offers the six options, in order', () => {
    expect(STORE_PAYMENT_METHODS.map(m => m.value)).toEqual(['apple_pay', 'mada', 'card', 'tamara', 'tabby', 'cod']);
  });

  it('shows the instalments without letting them be chosen', () => {
    expect(isStorePaymentAvailable('tabby')).toBe(false);
    expect(isStorePaymentAvailable('tamara')).toBe(false);
    expect(isStorePaymentAvailable('mada')).toBe(true);
    expect(isStorePaymentAvailable('mixed')).toBe(false);
  });

  it('names new and older orders', () => {
    expect(storePaymentLabel('mada')).toBe('مدى');
    expect(storePaymentLabel('bank_transfer')).toBe('تحويل بنكي');
    expect(storePaymentLabel('cod')).toBe('الدفع عند الاستلام');
  });
});
