import { Link } from "react-router-dom";
import { ShoppingCart, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import type { DashboardMetrics, BranchStats } from "@/hooks/useDashboardData";

/**
 * Claude Design's dashboard hero: today's revenue on the dark card, against
 * yesterday, with today's sales count and average invoice. Every figure is the
 * dashboard's own (useDashboardData) — nothing here is computed anew or made up.
 */
export function DashboardHero({ metrics, branchStats, state, isRTL, className }: {
  metrics: DashboardMetrics | null;
  branchStats: BranchStats[];
  state: "loading" | "error" | "ready";
  isRTL: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { allows } = useFeatureAccess();
  const L = (ar: string, en: string) => (isRTL ? ar : en);
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  const name = (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? L("صباح الخير", "Good morning") : L("مساء الخير", "Good evening");
  const today = new Date().toLocaleDateString(isRTL ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const revenue = metrics?.todaysRevenue ?? 0;
  const yesterday = metrics?.yesterdaysRevenue ?? 0;
  const pct = yesterday > 0 ? Math.round(((revenue - yesterday) / yesterday) * 1000) / 10 : null;
  const salesCount = branchStats.reduce((s, b) => s + b.todaySales, 0);
  const average = salesCount > 0 ? revenue / salesCount : 0;
  const branchCount = branchStats.length;

  return (
    <section
      className={cn("hero-card relative overflow-hidden rounded-[32px] p-6 sm:p-7 flex flex-col gap-6 min-w-0 text-[#FAF7F3]", className)}
      aria-label={L("ملخص اليوم", "Today")}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-28 -left-24 w-[300px] h-[300px] rounded-full hero-glow" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold">{name ? `${greeting}، ${name}` : greeting}</p>
          <p className="mt-1 text-[13px] text-[#B9B2D3]">
            {today}
            {branchCount > 0 && ` · ${branchCount === 1 ? L("فرع واحد", "1 branch") : L(`${branchCount} فروع`, `${branchCount} branches`)}`}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
          {L("مباشر", "Live")}
        </span>
      </div>

      <div className="relative">
        <p className="mb-2.5 text-[13px] text-[#CFC9E4]">{L("إيرادات اليوم", "Today's revenue")}</p>
        {state === "loading" ? (
          <span className="block h-12 w-44 rounded-xl bg-white/10 animate-pulse" role="status" aria-label={L("جارٍ التحميل", "Loading")} />
        ) : state === "error" ? (
          <p className="text-sm font-medium text-[#FFB394]">{L("تعذّر تحميل القيمة", "Couldn't load")}</p>
        ) : (
          <p className="flex items-baseline gap-1.5 leading-none">
            <span className="text-5xl sm:text-[52px] font-bold tabular-nums">{fmt(revenue)}</span>
            <span className="text-[17px] font-medium text-[#CFC9E4]">{L("ر.س", "SAR")}</span>
          </p>
        )}
        {state === "ready" && (
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {pct !== null ? (
              <>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                  pct >= 0 ? "bg-[#3DD68C]/15 text-[#7BE8B3]" : "bg-[#FF8A9E]/15 text-[#FFB3C1]"
                )} dir="ltr">
                  {pct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {pct >= 0 ? "+" : ""}{pct}%
                </span>
                <span className="text-xs text-[#B9B2D3]">{L(`مقارنةً بأمس (${fmt(yesterday)} ر.س)`, `vs yesterday (${fmt(yesterday)} SAR)`)}</span>
              </>
            ) : (
              <span className="text-xs text-[#B9B2D3]">
                {revenue === 0 ? L("لا مبيعات اليوم حتى الآن", "No sales yet today") : L("لا مبيعات أمس للمقارنة", "No sales yesterday to compare")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative grid grid-cols-3 gap-2.5">
        {[
          { label: L("عمليات البيع", "Sales"), value: state === "ready" ? fmt(salesCount) : "—" },
          { label: L("متوسط الفاتورة", "Average invoice"), value: state === "ready" && salesCount > 0 ? fmt(average) : "—" },
          { label: L("القطع المباعة", "Units sold"), value: state === "ready" ? fmt(metrics?.unitsSoldToday ?? 0) : "—" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-2xl bg-white/[0.07] border border-white/10 min-w-0">
            <p className="text-[11px] text-[#B9B2D3] truncate">{s.label}</p>
            <p className="mt-1 text-[19px] font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative flex flex-wrap gap-2.5 mt-auto">
        {can("pos.access") && (
          <Link to="/pos" className="inline-flex items-center gap-2 h-11 px-4 rounded-[14px] font-bold text-sm avatar-signal">
            <ShoppingCart className="w-4 h-4" /> {L("بيع جديد", "New sale")}
          </Link>
        )}
        {allows("reports") && can("reports.view") && (
          <Link to="/reports?tab=sales" className="inline-flex items-center gap-2 h-11 px-4 rounded-[14px] font-semibold text-sm bg-white/10 border border-white/15 hover:bg-white/15 transition-colors">
            <BarChart3 className="w-4 h-4" /> {L("تقرير المبيعات", "Sales report")}
          </Link>
        )}
      </div>
    </section>
  );
}
