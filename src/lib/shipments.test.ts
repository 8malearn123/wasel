import { describe, it, expect } from 'vitest';
import { shipmentStage, shippingStats, collectOnDelivery, waybillHtml, type ShipmentOrder } from './shipments';

const order = (o: Partial<ShipmentOrder>): ShipmentOrder => ({
  id: Math.random().toString(36), order_number: 'ORD-20261026-001', status: 'pending', customer_name: 'سارة',
  customer_phone: '0555555555', shipping_address: 'حي النرجس', shipping_city: 'الرياض', shipping_cost: 25,
  total_amount: 1150, payment_method: 'cod', payment_status: 'unpaid', created_at: '2026-10-26T10:00:00Z', ...o,
});

describe('shipments', () => {
  it('puts each order status on the shipping board', () => {
    expect(['pending', 'confirmed', 'processing'].map(status => shipmentStage({ status }))).toEqual(['to_ship', 'to_ship', 'to_ship']);
    expect(shipmentStage({ status: 'shipped' })).toBe('shipped');
    expect(shipmentStage({ status: 'delivered' })).toBe('delivered');
    expect(shipmentStage({ status: 'cancelled' })).toBe('closed');
  });

  it('collects on delivery only for unpaid cash-on-delivery orders', () => {
    expect(collectOnDelivery(order({}))).toBe(1150);
    expect(collectOnDelivery(order({ payment_status: 'paid' }))).toBe(0);
    expect(collectOnDelivery(order({ payment_method: 'mada' }))).toBe(0);
  });

  it('counts, fees, carriers and cities from the orders that went out', () => {
    const s = shippingStats([
      order({ status: 'confirmed' }),
      order({ status: 'shipped', shipping_provider: 'other', tracking_number: 'naqel:1', shipping_city: 'جدة' }),
      order({ status: 'delivered', shipping_provider: 'smsa', tracking_number: '2', payment_status: 'paid' }),
      order({ status: 'delivered', shipping_provider: 'smsa', tracking_number: '3', shipping_cost: 0 }),
      order({ status: 'cancelled', shipping_provider: 'smsa' }),
    ]);
    expect(s).toMatchObject({ toShip: 1, shipped: 1, delivered: 2, fees: 50, codInTransit: 1150, deliveredRate: 67 });
    expect(s.byCarrier).toEqual([{ name: 'سمسا إكسبريس', count: 2 }, { name: 'ناقل إكسبريس', count: 1 }]);
    expect(s.byCity[0]).toEqual({ city: 'الرياض', count: 2 });
    expect(shippingStats([]).deliveredRate).toBeNull();
  });

  it('prints a waybill with the carrier, the full order number and the cash to collect, escaped', () => {
    const html = waybillHtml(order({ customer_name: '<b>x</b>', shipping_provider: 'other', tracking_number: 'naqel:77001' }), { name: 'متجر الأنام', phone: '0500000000' }, 2);
    expect(html).toContain('ناقل إكسبريس');
    expect(html).toContain('77001');
    expect(html).toContain('ORD-20261026-001');
    expect(html).toContain('تحصيل عند الاستلام: 1,150 ر.س');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(waybillHtml(order({ payment_method: 'bank_transfer' }), { name: 's' }, 1)).not.toContain('مدفوع');
  });
});
