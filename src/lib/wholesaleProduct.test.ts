import { describe, it, expect } from 'vitest';
import { productFromDevice, productFromAccessory, productNotes, productFromNotes, productDetails } from './wholesaleProduct';

describe('the product saved with a wholesale listing', () => {
  it('describes a device without its IMEI or cost', () => {
    const p = productFromDevice({ brand: 'Apple', model: 'iPhone 14 Pro', storage: '256GB', color: 'أسود', condition: 'new', imei: '3567', cost: 3400 } as never);
    expect(p).toEqual({ kind: 'device', name: 'Apple iPhone 14 Pro', brand: 'Apple', model: 'iPhone 14 Pro', storage: '256GB', color: 'أسود', condition: 'new' });
    expect(productDetails(p)).toBe('256GB · أسود · جديد');
  });

  it('describes an accessory', () => {
    const p = productFromAccessory({ name: 'شاحن سريع 65W', brand: 'Anker', sku: 'ACC-002' });
    expect(productDetails(p)).toBe('Anker · ACC-002');
  });

  it('reads back what was saved, and nothing from other notes', () => {
    const p = productFromDevice({ brand: 'Samsung', model: 'Galaxy A55' });
    expect(productFromNotes(productNotes(p))).toEqual(p);
    expect(productFromNotes('بيع للمحلات فقط')).toBeNull();
    expect(productFromNotes('{"wasel_product": 5}')).toBeNull();
    expect(productFromNotes(null)).toBeNull();
  });
});
