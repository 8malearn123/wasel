/**
 * Riyal amounts as the till, the invoice and the stock pages write them:
 * grouped thousands, Latin digits and always the same number of decimals
 * (halalas: two). The till showed 2,373.043 next to 2729.00 — one was
 * toLocaleString() with up to three decimals, the other toFixed(2) without
 * grouping.
 *
 * Only the display is rounded. Totals are worked out on the full values and
 * rounded once, by roundSar, where an amount is stored or charged.
 */

const formatters = new Map<number, Intl.NumberFormat>();
const formatter = (decimals: number) => {
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, f);
  }
  return f;
};

export function formatSar(value: number | string | null | undefined, { decimals = 2 }: { decimals?: number } = {}): string {
  const n = Number(value);
  return formatter(decimals).format(Number.isFinite(n) ? n : 0);
}

/** An amount with its currency on the reading side: «2,373.04 ر.س» / «2,373.04 SAR» */
export const sar = (value: number | string | null | undefined, isRTL = true, decimals = 2) =>
  `${formatSar(value, { decimals })} ${isRTL ? 'ر.س' : 'SAR'}`;

/** Round to halalas, avoiding binary drift (1.005 → 1.01) */
export const roundSar = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
