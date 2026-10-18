/** KSA standard VAT rate. */
export const VAT_RATE = 0.15;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * All shelf prices are VAT-inclusive. Splits a gross amount into the VAT it contains
 * and the net amount, using the same rounding as the pos_checkout / place_online_order RPCs.
 * This is for display only: the server's figures are authoritative.
 */
export function splitVatInclusive(gross: number, vatEnabled = true) {
  const total = round2(gross);
  const tax = vatEnabled ? round2((total * VAT_RATE) / (1 + VAT_RATE)) : 0;
  return { total, tax, net: round2(total - tax) };
}

/**
 * Label for an order's VAT row. Web orders placed before the switch to VAT-inclusive
 * pricing added VAT on top (subtotal + tax + shipping = total); newer ones contain it.
 */
export function orderVatLabel(o: { subtotal: number; tax_amount: number; shipping_cost: number; total_amount: number }) {
  const addedOnTop =
    Number(o.tax_amount) > 0 &&
    Math.abs(Number(o.subtotal) + Number(o.tax_amount) + Number(o.shipping_cost) - Number(o.total_amount)) < 0.01;
  return addedOnTop ? 'ضريبة القيمة المضافة (15%)' : 'شامل ضريبة القيمة المضافة (15%)';
}
