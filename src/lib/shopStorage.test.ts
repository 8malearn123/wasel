import { describe, it, expect, beforeEach } from 'vitest';
import { readShop, writeShop } from './shopStorage';

describe('shopStorage', () => {
  beforeEach(() => localStorage.clear());

  it('two shops on one browser keep their own values', () => {
    writeShop('stocktake_schedules', 'shopA', [{ id: 'a' }]);
    expect(readShop('stocktake_schedules', 'shopB', [])).toEqual([]);
    expect(readShop('stocktake_schedules', 'shopA', [])).toEqual([{ id: 'a' }]);
  });

  it('a value saved before is taken over once, then no other shop gets it', () => {
    localStorage.setItem('store_settings', JSON.stringify({ invoicePrefix: 'A' }));
    expect(readShop('store_settings', 'shopA', {})).toEqual({ invoicePrefix: 'A' });
    expect(localStorage.getItem('store_settings')).toBeNull();
    expect(readShop('store_settings', 'shopB', { invoicePrefix: 'INV' })).toEqual({ invoicePrefix: 'INV' });
  });

  it('without a shop nothing is read or written', () => {
    writeShop('x', null, 1);
    expect(localStorage.length).toBe(0);
    expect(readShop('x', undefined, 'd')).toBe('d');
  });
});
