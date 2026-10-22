import { describe, it, expect } from 'vitest';
import { translatePatterns } from './autoTranslate';

describe('English mode: text the dictionary cannot hold word for word', () => {
  it('Arabic digits and month names', () => {
    expect(translatePatterns('٢٤')).toBe('24');
    expect(translatePatterns('08 يوليو 2026')).toBe('08 July 2026');
  });

  it('messages built around a number', () => {
    expect(translatePatterns('3 تحويلات بانتظار الموافقة')).toBe('3 transfers awaiting approval');
    expect(translatePatterns('2 فواتير غير مدفوعة')).toBe('2 unpaid invoices');
    expect(translatePatterns('حماية شاشة Samsung - الكمية: 4 (الحد الأدنى: 5)')).toBe('حماية شاشة Samsung - Qty: 4 (min: 5)');
    expect(translatePatterns('الكمية: 2')).toBe('Qty: 2');
  });

  it("leaves people's own text alone", () => {
    expect(translatePatterns('نورة السالم')).toBeNull();
    expect(translatePatterns('Galaxy S24')).toBeNull();
  });
});
