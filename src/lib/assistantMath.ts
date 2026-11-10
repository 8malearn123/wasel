import { saleTotal, type SaleMoneyLike } from './salesMath';

/**
 * The figures behind the assistant page's ready questions. Plain arithmetic on
 * the shop's own sales — no model, no guess dressed up as one. Weeks are
 * rolling 7-day windows ending now, so "this week" is always the last 7 days.
 */
export interface AssistantSaleItem {
  quantity: number;
  unit_price: number;
  device?: { model?: string | null; brand?: string | null } | null;
  accessory?: { name?: string | null } | null;
}
export interface AssistantSale extends SaleMoneyLike {
  sale_date: string;
  items?: AssistantSaleItem[] | null;
}

const DAY = 864e5;

/** Revenue for each of the last `weeks` 7-day windows, oldest first. */
export function weeklyRevenue(sales: AssistantSale[], now = Date.now(), weeks = 6): { start: Date; revenue: number; count: number }[] {
  const out = Array.from({ length: weeks }, (_, i) => ({
    start: new Date(now - (weeks - i) * 7 * DAY),
    revenue: 0,
    count: 0,
  }));
  for (const s of sales) {
    const age = now - new Date(s.sale_date).getTime();
    if (age < 0) continue;
    const back = Math.floor(age / (7 * DAY));
    if (back >= weeks) continue;
    const slot = out[weeks - 1 - back];
    slot.revenue += saleTotal(s);
    slot.count += 1;
  }
  return out;
}

/**
 * Next week as the average of the last four weeks that had any sales. Null
 * when there is nothing to average — the page then says so instead of showing 0.
 */
export function forecastNextWeek(weeks: { revenue: number }[]): { value: number; basisWeeks: number } | null {
  const recent = weeks.slice(-4).filter(w => w.revenue > 0);
  if (recent.length === 0) return null;
  return { value: recent.reduce((t, w) => t + w.revenue, 0) / recent.length, basisWeeks: recent.length };
}

/** % change from `before` to `after`; null when there is no base to compare with. */
export function pctChange(after: number, before: number): number | null {
  return before > 0 ? ((after - before) / before) * 100 : null;
}

/** Best sellers by units across the given sales. */
export function topItems(sales: AssistantSale[], limit = 3): { name: string; units: number; revenue: number }[] {
  const map = new Map<string, { units: number; revenue: number }>();
  for (const s of sales) {
    for (const it of s.items || []) {
      const name = it.accessory?.name
        || [it.device?.brand, it.device?.model].filter(Boolean).join(' ')
        || null;
      if (!name) continue;
      const row = map.get(name) || { units: 0, revenue: 0 };
      row.units += Number(it.quantity) || 0;
      row.revenue += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      map.set(name, row);
    }
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, limit);
}

export type QuestionKey = 'summary' | 'reorder' | 'forecast' | 'top';

/** Which ready question a typed question is asking, if any. */
export function matchQuestion(text: string): QuestionKey | null {
  const q = text.toLowerCase();
  if (/توقع|القادم|forecast|next week/.test(q)) return 'forecast';
  if (/إعادة|اعادة|طلب|نفاد|نفد|مخزون|reorder|stock|restock/.test(q)) return 'reorder';
  if (/الأكثر|الاكثر|أفضل|افضل|best|top/.test(q)) return 'top';
  if (/مبيع|أداء|اداء|لخص|لخّص|ملخص|sales|summar|perform/.test(q)) return 'summary';
  return null;
}
