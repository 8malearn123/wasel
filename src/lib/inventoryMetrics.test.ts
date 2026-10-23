import { describe, it, expect } from 'vitest';
import { deviceCounts, accessoryCounts, stockValue, unitsSold } from './inventoryMetrics';

const devices = [
  { status: 'available', price: 1000, cost: 800 },
  { status: 'available', price: 2000, cost: 1500 },
  { status: 'reserved', price: 500, cost: 400 },
  { status: 'in_repair', price: 300, cost: 200 },
  { status: 'sold', price: 9999, cost: 9000 },
  { status: 'sold', price: 1, cost: 1 },
];
const accessories = [
  { quantity: 3, price: '50', cost: '20', min_quantity: 5 },
  { quantity: 10, price: 10, cost: 4, min_quantity: 2 },
];

describe('one definition per figure', () => {
  it('counts in stock as not sold, for sale as available', () => {
    expect(deviceCounts(devices)).toEqual({ total: 6, inStock: 4, available: 2, reserved: 1, sold: 2, other: 1 });
  });

  it('values unsold devices and every accessory piece, at price and at cost', () => {
    const v = stockValue(devices, accessories);
    expect(v.deviceRetail).toBe(3800);
    expect(v.accessoryRetail).toBe(250);
    expect(v.retail).toBe(4050);
    expect(v.cost).toBe(2900 + 100);
  });

  it('counts pieces and low stock lines', () => {
    expect(accessoryCounts(accessories)).toEqual({ lines: 2, pieces: 13, lowStock: 1 });
  });

  it('counts units on invoices, not invoices', () => {
    expect(unitsSold([{ items: [{ quantity: 3 }, { quantity: 1 }] }, { items: [] }, {}])).toBe(4);
  });

  it('ignores missing numbers rather than producing NaN', () => {
    expect(stockValue([{ status: 'available', price: null }], [{ quantity: null, price: 5 }]).retail).toBe(0);
  });
});
