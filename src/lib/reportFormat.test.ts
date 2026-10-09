import { describe, it, expect } from 'vitest';
import { fmtCount, fmtDate, fmtMoney, fmtNumber, fmtPercent } from './reportFormat';

describe('report formatters', () => {
  it('groups thousands and drops decimals on a count', () => {
    expect(fmtCount(1234567)).toBe('1,234,567');
    expect(fmtCount(0)).toBe('0');
    expect(fmtCount(12.7)).toBe('13');
  });

  it('keeps up to two decimals on a measured number', () => {
    expect(fmtNumber(1234.5)).toBe('1,234.5');
    expect(fmtNumber(1234.567)).toBe('1,234.57');
    expect(fmtNumber(1234)).toBe('1,234');
  });

  // The dashboards used toLocaleString() and the tables toLocaleString('ar-SA'),
  // so the same riyal figure appeared with Latin digits in one tab and
  // Arabic-Indic digits in the next. One formatter, Latin digits, because that
  // is what tabular-nums can align into a column.
  it('writes money with Latin digits in both languages', () => {
    expect(fmtMoney(1500.5, true)).toBe('1,500.5 ر.س');
    expect(fmtMoney(1500.5, false)).toBe('1,500.5 SAR');
    expect(fmtMoney(1500, true)).not.toMatch(/[٠-٩]/);
  });

  it('says so rather than printing NaN', () => {
    expect(fmtMoney(Number.NaN)).toBe('—');
    expect(fmtCount(Number.NaN)).toBe('—');
    expect(fmtNumber(Number.POSITIVE_INFINITY)).toBe('—');
    expect(fmtPercent(Number.NaN)).toBe('—');
  });

  it('formats a percentage to one decimal by default', () => {
    expect(fmtPercent(12.345)).toBe('12.3%');
    expect(fmtPercent(12.345, 2)).toBe('12.35%');
    expect(fmtPercent(-4)).toBe('-4.0%');
  });

  describe('dates', () => {
    // A sales ledger's dates are Gregorian. Plain 'ar-SA' switches the whole
    // calendar to Hijri, which would silently restate every date in the report.
    it('stays Gregorian and Latin-numbered in Arabic', () => {
      const formatted = fmtDate('2026-03-05T10:00:00Z', true);
      expect(formatted).toMatch(/2026/);
      expect(formatted).not.toMatch(/[٠-٩]/);
    });

    it('reads a Date, a string and a timestamp alike', () => {
      expect(fmtDate(new Date('2026-03-05T00:00:00Z'), false)).toBe('05/03/2026');
      expect(fmtDate('2026-03-05T00:00:00Z', false)).toBe('05/03/2026');
    });

    it('shows a dash for nothing, and the raw text for an unparseable value', () => {
      expect(fmtDate(null)).toBe('—');
      expect(fmtDate('')).toBe('—');
      expect(fmtDate('not a date')).toBe('not a date');
    });
  });
});
