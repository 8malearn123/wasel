import { describe, it, expect } from 'vitest';
import { saleNet, saleCost, saleProfit, localDayKey, monthToDateWindows } from './salesMath';

const invoice = { total_amount: 3138.35, tax_amount: 409.35, items: [{ cost_at_sale: 2000, quantity: 1 }, { cost_at_sale: 100, quantity: 2 }] };

describe('sale figures', () => {
  it('profit leaves VAT out', () => {
    expect(saleNet(invoice)).toBeCloseTo(2729);
    expect(saleCost(invoice)).toBe(2200);
    expect(saleProfit(invoice)).toBeCloseTo(529);   // not 938.35
  });
  it('treats missing numbers as zero, and a missing quantity as one', () => {
    expect(saleProfit({ total_amount: '115', tax_amount: null, items: [{ cost_at_sale: '50' }] })).toBe(65);
  });
});

describe('days and months', () => {
  it('a sale late in the evening belongs to that local day', () => {
    const local = new Date(2026, 9, 22, 23, 30);
    expect(localDayKey(local)).toBe('2026-10-22');
  });
  it('month to date is compared with the same stretch of last month', () => {
    const w = monthToDateWindows(new Date(2026, 10, 4, 15, 0));
    expect(w.lastStart).toEqual(new Date(2026, 9, 1));
    expect(w.lastEnd).toEqual(new Date(2026, 9, 4, 15, 0));
  });
  it('the 31st is held inside a 30-day month', () => {
    const w = monthToDateWindows(new Date(2026, 11, 31, 10, 0));
    expect(w.lastEnd).toEqual(new Date(2026, 10, 30, 10, 0));
  });
});
