import { saleNet, saleTotal } from './salesMath';

/**
 * Claude Design's «ساعات الذروة» and «ربحية الفئات», from the invoices the
 * reports already load. Nothing is estimated:
 *
 *   hour      = the shop's local clock hour of the sale
 *   category  = the accessory's category, or «أجهزة» for a device
 *   revenue   = each invoice's net (before VAT, after discount) shared among
 *               its lines by their value, so invoices whose line prices include
 *               VAT and older ones whose prices do not both come out right
 *   profit    = that revenue minus the line's cost at the time of sale
 */
export interface PatternSale {
  sale_date: string;
  total_amount: number | string | null;
  tax_amount?: number | string | null;
  items?: {
    quantity?: number | string | null;
    unit_price?: number | string | null;
    cost_at_sale?: number | string | null;
    device_id?: string | null;
    accessory?: { category?: string | null } | null;
  }[] | null;
}

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export function salesByHour(sales: PatternSale[]) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, revenue: 0 }));
  for (const s of sales) {
    const h = new Date(s.sale_date).getHours();
    hours[h].count++;
    hours[h].revenue += saleTotal(s);
  }
  return hours;
}

export interface CategoryProfit { category: string; revenue: number; cost: number; profit: number; margin: number; units: number }

export function profitByCategory(sales: PatternSale[], deviceLabel = 'أجهزة', otherLabel = 'بدون تصنيف'): CategoryProfit[] {
  const map = new Map<string, CategoryProfit>();
  for (const s of sales) {
    const lines = s.items ?? [];
    const gross = lines.reduce((t, i) => t + n(i.unit_price) * (n(i.quantity) || 1), 0);
    const net = saleNet(s);
    for (const i of lines) {
      const qty = n(i.quantity) || 1;
      const lineValue = n(i.unit_price) * qty;
      const share = gross > 0 ? (lineValue / gross) * net : 0;
      const cost = n(i.cost_at_sale) * qty;
      const key = i.device_id ? deviceLabel : (i.accessory?.category?.trim() || otherLabel);
      const row = map.get(key) ?? { category: key, revenue: 0, cost: 0, profit: 0, margin: 0, units: 0 };
      row.revenue += share;
      row.cost += cost;
      row.units += qty;
      map.set(key, row);
    }
  }
  return [...map.values()]
    .map(r => ({ ...r, profit: r.revenue - r.cost, margin: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}
