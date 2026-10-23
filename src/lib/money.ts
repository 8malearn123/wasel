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

/**
 * Round to halalas, half up. value × 100 is first cut to 12 significant digits,
 * which removes binary drift: 125.1 × 0.15 is 18.764999… in floating point and
 * must still round to 18.77, as 1.005 rounds to 1.01.
 */
export const roundSar = (value: number) => Math.round(Number((value * 100).toPrecision(12))) / 100;

export const VAT_RATE = 0.15;

/**
 * A till sale's amounts. Shelf prices include VAT (the till and the invoice say
 * «شامل ضريبة القيمة المضافة»), so the VAT is the part of what the customer
 * pays, not 15% on top of it. Saving a sale used to add 15% to prices that
 * already included it: a 2,373.04 cart was charged and printed as 2,373.04 but
 * stored as 2,729.00, and every report read the stored figure.
 *
 *   total    = gross − discount           what the customer pays (incl. VAT)
 *   subtotal = total ÷ 1.15               المجموع الفرعي, before VAT
 *   tax      = total − subtotal
 */
export function vatInclusive(gross: number, discount = 0) {
  const g = roundSar(Math.max(0, gross));
  const d = roundSar(Math.min(Math.max(0, discount), g));
  const total = roundSar(g - d);
  const subtotal = roundSar(total / (1 + VAT_RATE));
  return { gross: g, discount: d, subtotal, tax: roundSar(total - subtotal), total };
}
