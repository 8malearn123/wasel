import { describe, it, expect } from 'vitest';
import { formatSar, sar, roundSar, vatInclusive } from './money';

describe('formatSar', () => {
  it('writes every amount with grouping and two decimals', () => {
    expect(formatSar(2373.043)).toBe('2,373.04');
    expect(formatSar(2729)).toBe('2,729.00');
    expect(formatSar('15.5')).toBe('15.50');
    expect(formatSar(null)).toBe('0.00');
    expect(formatSar(77211088, { decimals: 0 })).toBe('77,211,088');
  });
  it('puts the currency after the figure in both languages', () => {
    expect(sar(10)).toBe('10.00 ر.س');
    expect(sar(10, false)).toBe('10.00 SAR');
  });
  it('rounds halfway halalas up', () => {
    expect(roundSar(1.005)).toBe(1.01);
  });
});

describe('vatInclusive', () => {
  // the reported pair: 2,373.04 charged, 2,729.00 stored
  it('takes VAT out of a VAT-inclusive total instead of adding it', () => {
    const v = vatInclusive(2373.04);
    expect(v.total).toBe(2373.04);
    expect(v.subtotal).toBe(2063.51);
    expect(v.tax).toBe(309.53);
    expect(roundSar(v.subtotal + v.tax)).toBe(v.total);
  });
  it('applies the discount before splitting out VAT, and never below zero', () => {
    expect(vatInclusive(115, 15)).toEqual({ gross: 115, discount: 15, subtotal: 86.96, tax: 13.04, total: 100 });
    expect(vatInclusive(50, 80).total).toBe(0);
  });
});
