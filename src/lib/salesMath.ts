/**
 * One definition of the money figures every report shows.
 *
 *   sales (الإيرادات)  = invoice totals, VAT included — what the customer paid
 *   net               = sales − VAT (= subtotal − discount)
 *   profit            = net − cost of the goods sold
 *
 * VAT is collected for the state, not earned: profit used to be the
 * VAT-inclusive total minus cost, which overstated it by the whole VAT
 * (a 2,654 ر.س month read 5,463).
 */
export interface SaleMoneyLike {
  total_amount: number | string | null;
  tax_amount?: number | string | null;
  items?: { cost_at_sale?: number | string | null; quantity?: number | string | null }[] | null;
}

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export const saleTotal = (s: SaleMoneyLike) => n(s.total_amount);
export const saleNet = (s: SaleMoneyLike) => n(s.total_amount) - n(s.tax_amount);
export const saleCost = (s: SaleMoneyLike) =>
  (s.items ?? []).reduce((sum, i) => sum + n(i.cost_at_sale) * (n(i.quantity) || 1), 0);
export const saleProfit = (s: SaleMoneyLike) => saleNet(s) - saleCost(s);

/** Local calendar day (the shop's clock, not UTC) as yyyy-MM-dd */
export function localDayKey(value: string | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * This month so far against the same stretch of last month (1st → same day,
 * same time). Comparing four days of November with all of October read
 * «-100%» on the 4th.
 */
export function monthToDateWindows(now: Date = new Date()) {
  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // the same moment last month, held inside last month when it is shorter
  const lastMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const lastEnd = new Date(lastStart);
  lastEnd.setDate(Math.min(now.getDate(), lastMonthDays));
  lastEnd.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return { thisStart, now, lastStart, lastEnd };
}
