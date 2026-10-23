import { describe, it, expect } from 'vitest';
import { invoiceDate, invoiceDateTime } from './invoiceDate';

describe('invoice dates', () => {
  it('writes day/month/year whatever the device locale', () => {
    const d = new Date(2026, 9, 23, 18, 22);
    expect(invoiceDate(d)).toBe('23/10/2026');
    expect(invoiceDateTime(d)).toBe('23/10/2026 18:22');
  });
  it('never prints an impossible or invalid date', () => {
    expect(invoiceDate('not a date')).toBe('—');
    expect(invoiceDateTime(undefined)).toBe('—');
  });
});
