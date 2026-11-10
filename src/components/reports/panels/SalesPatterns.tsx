import { useMemo, useState } from "react";
import { Clock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { salesByHour, profitByCategory, type PatternSale } from "@/lib/salesPatterns";

const PERIODS = [
  { days: 7, ar: "7 أيام", en: "7 days" },
  { days: 30, ar: "30 يومًا", en: "30 days" },
  { days: 90, ar: "90 يومًا", en: "90 days" },
] as const;

/**
 * Claude Design's peak hours and category profitability, under the sales
 * report. Computed from the invoices the page already loaded (src/lib/
 * salesPatterns.ts) — no new request, nothing estimated.
 */
export function SalesPatterns({ sales, isRTL }: { sales: PatternSale[]; isRTL: boolean }) {
  const [days, setDays] = useState<number>(30);
  const L = (ar: string, en: string) => (isRTL ? ar : en);
  const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

  const inPeriod = useMemo(() => {
    const since = Date.now() - days * 864e5;
    return sales.filter(s => new Date(s.sale_date).getTime() >= since);
  }, [sales, days]);
  const hours = useMemo(() => salesByHour(inPeriod), [inPeriod]);
  const categories = useMemo(() => profitByCategory(inPeriod, L("أجهزة", "Devices"), L("بدون تصنيف", "Uncategorised")), [inPeriod, isRTL]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = hours.filter(h => h.count > 0);
  const maxCount = Math.max(1, ...hours.map(h => h.count));
  const peak = open.length ? open.reduce((a, b) => (b.count > a.count ? b : a)) : null;
  const first = open[0]?.hour ?? 9;
  const last = open[open.length - 1]?.hour ?? 22;
  const shown = hours.filter(h => h.hour >= Math.min(first, 9) && h.hour <= Math.max(last, 22));
  const hourLabel = (h: number) => {
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return isRTL ? `${twelve} ${h < 12 ? "ص" : "م"}` : `${twelve}${h < 12 ? "am" : "pm"}`;
  };
  const best = categories[0];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold text-foreground">{L("أنماط المبيعات", "Sales patterns")}</h3>
        <div className="inline-flex rounded-[14px] border bg-card p-1" role="group" aria-label={L("الفترة", "Period")}>
          {PERIODS.map(p => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              aria-pressed={days === p.days}
              className={cn("h-8 px-3 rounded-[10px] text-xs font-semibold transition-colors",
                days === p.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              {isRTL ? p.ar : p.en}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Peak hours */}
        <section className="bg-card rounded-[24px] border shadow-md p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-text flex items-center justify-center"><Clock className="w-[18px] h-[18px]" /></span>
            <div>
              <h4 className="font-bold text-foreground">{L("ساعات الذروة", "Peak hours")}</h4>
              <p className="text-xs text-muted-foreground">
                {peak
                  ? L(`أكثر ساعة بيعًا: ${hourLabel(peak.hour)} (${peak.count} فاتورة)`, `Busiest: ${hourLabel(peak.hour)} (${peak.count} invoices)`)
                  : L("لا مبيعات في هذه الفترة", "No sales in this period")}
              </p>
            </div>
          </div>
          {peak && (
            <div className="mt-4 flex items-end gap-1 h-36" role="img" aria-label={L("عدد الفواتير لكل ساعة", "Invoices per hour")}>
              {shown.map(h => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 min-w-0 group" title={`${hourLabel(h.hour)}: ${h.count} · ${fmt(h.revenue)} ${L("ر.س", "SAR")}`}>
                  <div
                    className={cn("w-full rounded-t-md transition-colors", h.hour === peak.hour ? "bg-primary" : "bg-primary/25 group-hover:bg-primary/50")}
                    style={{ height: `${Math.max(4, (h.count / maxCount) * 112)}px` }}
                  />
                  <span className="text-[9px] text-muted-foreground tabular-nums">{h.hour % 3 === 0 ? hourLabel(h.hour) : ""}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Category profitability */}
        <section className="bg-card rounded-[24px] border shadow-md p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-text flex items-center justify-center"><Layers className="w-[18px] h-[18px]" /></span>
            <div>
              <h4 className="font-bold text-foreground">{L("ربحية الفئات", "Profit by category")}</h4>
              <p className="text-xs text-muted-foreground">
                {best
                  ? L(`الأعلى إيرادًا: ${best.category} · هامش ${best.margin.toFixed(1)}٪ — قبل الضريبة`, `Top: ${best.category} · ${best.margin.toFixed(1)}% margin — before VAT`)
                  : L("لا مبيعات في هذه الفترة", "No sales in this period")}
              </p>
            </div>
          </div>
          {categories.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-start font-medium py-2">{L("الفئة", "Category")}</th>
                    <th className="text-center font-medium py-2">{L("القطع", "Units")}</th>
                    <th className="text-center font-medium py-2">{L("الإيراد", "Revenue")}</th>
                    <th className="text-center font-medium py-2">{L("الربح", "Profit")}</th>
                    <th className="text-end font-medium py-2">{L("الهامش", "Margin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.slice(0, 8).map(c => (
                    <tr key={c.category} className="border-b last:border-0">
                      <td className="py-2 font-medium text-foreground">{c.category}</td>
                      <td className="py-2 text-center tabular-nums">{fmt(c.units)}</td>
                      <td className="py-2 text-center tabular-nums">{fmt(c.revenue)}</td>
                      <td className={cn("py-2 text-center tabular-nums", c.profit < 0 && "text-destructive")}>{fmt(c.profit)}</td>
                      <td className="py-2 text-end">
                        <span className="inline-flex items-center gap-2">
                          <span className="hidden sm:block w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <span className="block h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, c.margin))}%` }} />
                          </span>
                          <span className="tabular-nums text-xs font-semibold">{c.margin.toFixed(1)}٪</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
