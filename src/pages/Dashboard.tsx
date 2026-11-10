import { motion } from "framer-motion";
import { usePermissions } from "@/hooks/usePermissions";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { AppLayout } from "@/components/layout/AppLayout";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { TopProductsWidget } from "@/components/dashboard/TopProductsWidget";
import { FinancialSummary } from "@/components/dashboard/FinancialSummary";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { QuickShortcuts } from "@/components/dashboard/QuickShortcuts";
import { MonthToDateCard, DashboardTiles, CategoryDonut, StockSummaryCard, MonthlyTargetCard } from "@/components/dashboard/DesignWidgets";
import { useDashboardExtras } from "@/hooks/useDashboardExtras";
import { useHRSettings } from "@/hooks/useHRSettings";
import {
  ShoppingCart, Package, Smartphone, Wrench, Truck, FileText,
  TrendingUp, TrendingDown, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { LucideIcon } from "lucide-react";

type Trend = { pct: number } | { note: string };

// كرت مؤشر: أيقونة وعنوان، ثم الرقم، ثم سطر واحد — مقارنة بالأمس أو وصف قصير
function KpiCard({ title, value, unit, trend, sub, icon: Icon, highlight, compact, index, isRTL, state = "ready" }: {
  title: string;
  value: string;
  /** loading: a placeholder bar; error: says so instead of showing a figure */
  state?: "loading" | "error" | "ready";
  unit?: string;
  trend?: Trend;
  sub?: string;
  icon: LucideIcon;
  highlight?: boolean;
  /** the secondary row: a little smaller */
  compact?: boolean;
  index: number;
  isRTL: boolean;
}) {
  const pct = trend && "pct" in trend ? trend.pct : undefined;
  const footer = trend && "note" in trend ? trend.note : sub;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "bg-card rounded-[24px] border shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 flex flex-col",
        compact ? "p-4" : "p-5",
        highlight && "border-primary/40 ring-1 ring-primary/15"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn(
          "rounded-xl flex items-center justify-center shrink-0",
          compact ? "w-8 h-8" : "w-9 h-9",
          highlight ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <p className="text-sm font-semibold text-muted-foreground leading-snug">{title}</p>
      </div>
      <div className={cn("flex items-baseline gap-1.5", compact ? "mt-3" : "mt-4")}>
        {state === "loading" ? (
          <span
            className={cn("block rounded-md bg-muted animate-pulse", compact ? "h-6 w-20" : "h-8 w-28")}
            role="status"
            aria-label={isRTL ? "جارٍ التحميل" : "Loading"}
          />
        ) : state === "error" ? (
          <p className="text-sm font-medium text-destructive">{isRTL ? "تعذّر تحميل القيمة" : "Couldn't load"}</p>
        ) : (
          <>
            <p className={cn("font-bold text-foreground tracking-tight tabular-nums leading-none", compact ? "text-2xl" : "text-[32px]")}>{value}</p>
            {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
          </>
        )}
      </div>
      <div className="mt-3 min-h-[20px] flex items-center gap-1.5">
        {state !== "ready" ? null : typeof pct === "number" ? (
          <>
            <span className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums",
              pct > 0 ? "bg-success/10 text-success" : pct < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
            )} dir="ltr">
              {pct > 0 ? <TrendingUp className="w-3 h-3" /> : pct < 0 ? <TrendingDown className="w-3 h-3" /> : null}
              {pct > 0 ? "+" : pct < 0 ? "−" : ""}{Math.abs(pct)}%
            </span>
            <span className="text-xs text-muted-foreground">{isRTL ? "عن أمس" : "vs yesterday"}</span>
          </>
        ) : footer ? (
          <p className="text-xs text-muted-foreground">{footer}</p>
        ) : null}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { t, isRTL } = useLanguage();
  const { metrics, salesChart, recentSales, branchStats, loading, error, refresh } = useDashboardData();
  const { allows } = useFeatureAccess();
  const { can } = usePermissions();
  // repairs and suppliers are Pro features: a Lite shop does not see their figures
  const showRepairs = allows("repairs") && can("repairs.manage");
  const showSuppliers = allows("suppliers") && can("suppliers.manage");
  const kpiState = loading ? "loading" : error || !metrics ? "error" : "ready";
  const { extras, loading: extrasLoading } = useDashboardExtras();
  const { settings: hrSettings, loading: hrLoading } = useHRSettings();
  const todaySales = branchStats.reduce((t, b) => t + b.todaySales, 0);

  // Today against yesterday — in words when there is nothing to compare with
  const trendOf = (today: number, yesterday: number): Trend | undefined => {
    if (!metrics) return undefined;
    if (yesterday > 0) return { pct: Math.round((today - yesterday) / yesterday * 100) };
    if (today === 0) return { note: isRTL ? "لا مبيعات اليوم حتى الآن" : "No sales yet today" };
    return { note: isRTL ? "لا مبيعات أمس للمقارنة" : "No sales yesterday to compare" };
  };
  const unitsTrend = trendOf(metrics?.unitsSoldToday || 0, metrics?.unitsSoldYesterday || 0);
  const L = (ar: string, en: string) => (isRTL ? ar : en);
  const currency = L("ر.س", "SAR");

  const fmt = (v: number) => v.toLocaleString('en-SA', { maximumFractionDigits: 0 });

  const branchesTotal = branchStats.reduce((s, b) => s + b.todayRevenue, 0);

  return (
    <AppLayout title={t.dashboard.title} subtitle={t.dashboard.subtitle}>
      {error && !loading && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
          <span className="text-destructive">{L("تعذّر تحميل بيانات لوحة التحكم. تحقق من الاتصال ثم أعد المحاولة.", "The dashboard data could not be loaded. Check the connection and try again.")}</span>
          <button type="button" onClick={() => refresh()} className="shrink-0 rounded-lg border border-destructive/40 px-3 py-1 font-medium text-destructive hover:bg-destructive/10">
            {L("إعادة المحاولة", "Retry")}
          </button>
        </div>
      )}

      {/* Claude Design «لوحة التحكم», row 1: today on the dark card, the
          month so far, shortcuts, then today's orders / products / customers */}
      <div className="grid gap-5 xl:grid-cols-12">
        <DashboardHero
          className="xl:col-span-5 xl:row-span-2"
          metrics={metrics}
          branchStats={branchStats}
          state={kpiState}
          isRTL={isRTL}
        />
        <MonthToDateCard className="xl:col-span-4" extras={extras} loading={extrasLoading} canOpenReports={allows("reports") && can("reports.view")} />
        <QuickShortcuts className="xl:col-span-3" isRTL={isRTL} narrow />
        <DashboardTiles className="xl:col-span-7" extras={extras} loading={extrasLoading} todaySales={todaySales} />
      </div>

      {/* row 2: sales over time beside sales by category */}
      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8 min-w-0">
          <SalesChart data={salesChart} loading={loading} />
        </div>
        <CategoryDonut className="xl:col-span-4" extras={extras} loading={extrasLoading} />
      </div>

      {/* row 3: what is happening now beside what needs attention */}
      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8 min-w-0">
          <RecentActivity sales={recentSales} loading={loading} />
        </div>
        <div className="xl:col-span-4 min-w-0">
          <AlertsWidget />
        </div>
      </div>

      {/* المؤشرات الثانوية — each only where the plan and the role include its section */}
      {(showRepairs || showSuppliers) && (
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {showRepairs && (
        <KpiCard state={kpiState} index={4} compact isRTL={isRTL}
          title={L("طلبات صيانة مفتوحة", "Open repairs")}
          value={String(metrics?.pendingRepairs || 0)}
          sub={L("بانتظار الإنجاز", "Awaiting completion")}
          icon={Wrench} />
        )}
        {showSuppliers && (
        <KpiCard state={kpiState} index={5} compact isRTL={isRTL}
          title={L("مستحقات الموردين", "Supplier payables")}
          value={fmt(metrics?.supplierDebt || 0)} unit={currency}
          sub={L("مبالغ لم تُسدَّد بعد", "Not paid yet")}
          icon={Truck} />
        )}
        {showSuppliers && (
        <KpiCard state={kpiState} index={6} compact isRTL={isRTL}
          title={L("أوامر شراء غير مدفوعة", "Unpaid purchase orders")}
          value={String(metrics?.unpaidPurchaseOrders || 0)}
          sub={L("بانتظار السداد", "Awaiting payment")}
          icon={FileText} />
        )}
      </div>
      )}

      {/* row 4: branches and channels · products and stock · the month's target */}
      <div className="mt-5 grid gap-5 xl:grid-cols-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="xl:col-span-5 bg-card rounded-[24px] border shadow-md p-6 min-w-0"
      >
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="w-[18px] h-[18px]" />
            </span>
            <div>
              <h3 className="font-bold text-foreground">{L("أداء الفروع", "Branch performance")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{L("مبيعات اليوم لكل فرع", "Today's sales by branch")}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {isRTL ? "مباشر" : "Live"}
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center" role="status" aria-label={L("جارٍ التحميل", "Loading")}>
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : branchStats.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{L("لا توجد فروع", "No branches")}</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {branchStats.map((b, i) => (
                <div key={b.id} className={cn(
                  "rounded-xl border p-4",
                  i === 0 ? "border-primary/40 bg-primary/5" : "bg-muted/20"
                )}>
                  <p className="text-sm font-semibold text-foreground">{b.name}</p>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{fmt(b.todayRevenue)}</p>
                    <span className="text-sm font-medium text-muted-foreground">{currency}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {b.todaySales === 0
                      ? L("لا مبيعات اليوم", "No sales today")
                      : L(`${b.todaySales} عملية بيع اليوم`, `${b.todaySales} sales today`)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {extras?.online
                  ? L(`إجمالي الفروع اليوم · المتجر الإلكتروني ${fmt(extras.online.todayRevenue)} ${currency}`, `All branches today · online store ${fmt(extras.online.todayRevenue)} ${currency}`)
                  : L("إجمالي مبيعات الفروع اليوم", "All branches today")}
              </span>
              <span className="font-bold text-foreground tabular-nums">{fmt(branchesTotal)} {currency}</span>
            </div>
          </>
        )}
      </motion.div>

        <StockSummaryCard className="xl:col-span-4" extras={extras} loading={extrasLoading} />
        <MonthlyTargetCard className="xl:col-span-3" extras={extras} loading={extrasLoading || hrLoading}
          target={hrSettings.targets.monthly || 0} canEditTarget={can("payroll.manage")} />
      </div>

      {/* the system's other widgets, kept: today's top products and the 30-day financial summary */}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <TopProductsWidget />
        <FinancialSummary />
      </div>
    </AppLayout>
  );
}
