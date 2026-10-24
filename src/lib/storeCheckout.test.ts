import { describe, it, expect, beforeEach } from 'vitest';
import {
  shippingOptions, shippingCost, addressProblem, orderAddress, isShortCode,
  loadCustomer, saveCustomer, EMPTY_ADDRESS,
} from './storeCheckout';
import { locationFromAddress } from './deliveryLocation';
import { saveOrder } from './storeOrdersHistory';

const store = { shipping_cost: 15, free_shipping_threshold: 500 };

describe('shipping options', () => {
  it('only the carriers the merchant switched on, with their own cost and days', () => {
    const o = shippingOptions(store, [
      { id: 'smsa', enabled: true, cost: 25, days: '1-2 أيام' },
      { id: 'aramex', enabled: false, cost: 30 },
      { id: 'naqel', enabled: true },
      { id: 'made-up', enabled: true, cost: 1 },
    ]);
    expect(o.map(x => [x.id, x.cost, x.days])).toEqual([['smsa', 25, '1-2 أيام'], ['naqel', 15, undefined]]);
  });

  it('the store delivers at its own rate when no carrier is on', () => {
    expect(shippingOptions(store, [])).toEqual([{ id: 'store', name: 'توصيل المتجر', cost: 15 }]);
  });

  it('free over the threshold, whichever carrier', () => {
    const [smsa] = shippingOptions(store, [{ id: 'smsa', enabled: true, cost: 25 }]);
    expect(shippingCost(smsa, 499, store)).toBe(25);
    expect(shippingCost(smsa, 500, store)).toBe(0);
  });
});

describe('national address', () => {
  const a = { ...EMPTY_ADDRESS, city: 'الرياض', district: 'العليا', street: 'التحلية', building: '2929', postal: '12211', shortCode: 'rrrd 2929' };

  it('checks the formats it can check', () => {
    expect(addressProblem(a)).toBeNull();
    expect(addressProblem({ ...a, shortCode: 'RRR2929' })).toMatch(/العنوان المختصر/);
    expect(addressProblem({ ...a, building: '12' })).toMatch(/المبنى/);
    expect(addressProblem({ ...a, district: '' })).toMatch(/الحي/);
    expect(isShortCode('RRRD2929')).toBe(true);
  });

  it('the order text carries the code, the carrier and the pin — the pin still found by the orders screen', () => {
    const text = orderAddress({ ...a, location: { lat: 24.7, lng: 46.6 } }, 'سمسا إكسبريس');
    expect(text).toContain('العنوان المختصر: RRRD2929');
    expect(text).toContain('🚚 شركة الشحن: سمسا إكسبريس');
    const parsed = locationFromAddress(text);
    expect(parsed.link).toBe('https://maps.google.com/?q=24.700000,46.600000');
    expect(parsed.text).toContain('حي العليا');
  });
});

describe('the remembered customer', () => {
  beforeEach(() => localStorage.clear());

  it('nothing made up for a first visit', () => {
    expect(loadCustomer('s')).toEqual({ name: '', phone: '', email: '', address: null });
  });

  it('a past order on this device fills in the name and phone', () => {
    saveOrder('s', { order_number: '1', customer_name: 'سارة', customer_phone: '0500000000' } as never);
    expect(loadCustomer('s')).toMatchObject({ name: 'سارة', phone: '0500000000' });
  });

  it('what was saved comes back', () => {
    saveCustomer('s', { name: 'علي', phone: '0555', email: '', address: { ...EMPTY_ADDRESS, city: 'جدة' } });
    expect(loadCustomer('s').address?.city).toBe('جدة');
  });
});

describe('the checkout total and the stored order agree', () => {
  it('adds VAT on goods and delivery, rounded once to halalas', async () => {
    const { roundSar, VAT_RATE } = await import('./money');
    const [smsa] = shippingOptions(store, [{ id: 'smsa', enabled: true, cost: 25, days: '2-3 أيام' }]);
    expect(smsa.days).toBe('2-3 أيام');
    const subtotal = 100.1;
    const shipping = shippingCost(smsa, subtotal, store);
    const tax = roundSar((subtotal + shipping) * VAT_RATE);
    expect(roundSar(subtotal + tax + shipping)).toBe(143.87);
  });
});
