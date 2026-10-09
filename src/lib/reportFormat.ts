/**
 * One way to write a number in a report.
 *
 * The dashboards used `val.toLocaleString()` and the tables used
 * `toLocaleString('ar-SA')`, so the same riyal figure appeared with Latin
 * digits in one tab and Arabic-Indic digits in the next. Reports are read
 * side by side and exported together, so they share one formatter — and it
 * keeps Latin digits, which is what the rest of وصل shows and what
 * `tabular-nums` can actually align into a column.
 */

const DECIMAL = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const CURRENCY_AR = 'ر.س';
export const CURRENCY_EN = 'SAR';

/** A count: no decimals, grouped thousands */
export function fmtCount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return WHOLE.format(value);
}

/** A quantity or a measured number, with up to two decimals */
export function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return DECIMAL.format(value);
}

/** Money, with the currency on the reading side of the figure */
export function fmtMoney(value: number, isRTL = true): string {
  if (!Number.isFinite(value)) return '—';
  return `${DECIMAL.format(value)} ${isRTL ? CURRENCY_AR : CURRENCY_EN}`;
}

export function fmtPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

/** A date, in the calendar the reader uses */
export function fmtDate(value: unknown, isRTL = true): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  // ar-SA on its own switches to the Hijri calendar, which is not what a
  // sales ledger means by a date — so the Gregorian one is asked for
  return date.toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}
