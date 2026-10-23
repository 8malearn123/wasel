/**
 * The date on an invoice: day/month/year and the time, Gregorian, Western
 * digits — 23/10/2026 18:22. The invoice used new Date().toLocaleString(), so
 * the order followed the device's locale (month first on an English-US device)
 * and, laid out right to left, read like 18/22/2026. An invalid or missing
 * date prints as «—» instead of «Invalid Date».
 */
const pad = (n: number) => String(n).padStart(2, '0');

const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

export function invoiceDate(value: unknown): string {
  const d = toDate(value);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—';
}

export function invoiceDateTime(value: unknown): string {
  const d = toDate(value);
  return d ? `${invoiceDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
}
