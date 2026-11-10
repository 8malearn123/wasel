import { describe, it, expect } from 'vitest';
import { salesByHour, profitByCategory } from './salesPatterns';

describe('sales patterns', () => {
  it('counts sales by the local hour', () => {
    const at = (h: number) => new Date(2026, 10, 9, h, 30).toISOString();
    const hours = salesByHour([
      { sale_date: at(20), total_amount: 115 },
      { sale_date: at(20), total_amount: 230 },
      { sale_date: at(9), total_amount: 50 },
    ]);
    expect(hours[20]).toEqual({ hour: 20, count: 2, revenue: 345 });
    expect(hours[9].count).toBe(1);
  });

  it('shares each invoice net among its lines, whatever the line prices include', () => {
    // a VAT-inclusive invoice: lines 115 + 230 = 345, net 300
    const rows = profitByCategory([{
      sale_date: new Date().toISOString(), total_amount: 345, tax_amount: 45,
      items: [
        { quantity: 1, unit_price: 115, cost_at_sale: 60, accessory: { category: 'شواحن' } },
        { quantity: 1, unit_price: 230, cost_at_sale: 150, device_id: 'd1' },
      ],
    }]);
    const charger = rows.find(r => r.category === 'شواحن')!;
    const devices = rows.find(r => r.category === 'أجهزة')!;
    expect(charger.revenue).toBeCloseTo(100);
    expect(charger.profit).toBeCloseTo(40);
    expect(devices.revenue).toBeCloseTo(200);
    expect(devices.margin).toBeCloseTo(25);
    expect(charger.revenue + devices.revenue).toBeCloseTo(300); // all of the net, no more
  });
});
