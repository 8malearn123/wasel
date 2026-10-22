import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { TopProductsWidget } from "@/components/dashboard/TopProductsWidget";
import { FinancialSummary } from "@/components/dashboard/FinancialSummary";
import {
  ShoppingCart, Package, Smartphone, Wrench, Truck, FileText,
  TrendingUp, TrendingDown, Building2,
} from "lucide-react";
import { RiyalSign } from "@/components/icons/RiyalSign";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { LucideIcon } from "lucide-react";

type Trend = { pct: number } | { note: string };

// كرت مؤشر: أيقونة وعنوان، ثم الرقم، ثم سطر واحد — مقارنة بالأمس أو وصف قصير
function KpiCard({ title, value, unit, trend, sub, icon: Icon, highlight, compact, index, isRTL }: {
  title: string;
  value: string;
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
        "bg-card rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col",
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
        <p className={cn("font-bold text-foreground tracking-tight tabular-nums leading-none", compact ? "text-2xl" : "text-[32px]")}>{value}</p>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-3 min-h-[20px] flex items-center gap-1.5">
        {typeof pct === "number" ? (
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
  const { metrics, salesChart, recentSales, branchStats, loading } = useDashboardData();

  // Today against yesterday — in words when there is nothing to compare with
  const trendOf = (today: number, yesterday: number): Trend | undefined => {
    if (!metrics) return undefined;
    if (yesterday > 0) return { pct: Math.round((today - yesterday) / yesterday * 100) };
    if (today === 0) return { note: isRTL ? "لا مبيعات اليوم حتى الآن" : "No sales yet today" };
    return { note: isRTL ? "لا مبيعات أمس للمقارنة" : "No sales yesterday to compare" };
  };
  const revenueTrend = trendOf(metrics?.todaysRevenue || 0, metrics?.yesterdaysRevenue || 0);
  const unitsTrend = trendOf(metrics?.unitsSoldToday || 0, metrics?.unitsSoldYesterday || 0);
  const L = (ar: string, en: string) => (isRTL ? ar : en);
  const currency = L("ر.س", "SAR");

  const fmt = (v: number) => v.toLocaleString('en-SA', { maximumFractionDigits: 0 });

  const branchesTotal = branchStats.reduce((s, b) => s + b.todayRevenue, 0);

  return (
    <AppLayout title={t.dashboard.title} subtitle={t.dashboard.subtitle}>
      {/* المؤشرات الرئيسية */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} highlight isRTL={isRTL}
          title={L("إيرادات اليوم", "Today's revenue")}
          value={loading ? "…" : fmt(metrics?.todaysRevenue || 0)} unit={currency}
          trend={revenueTrend}
          icon={RiyalSign} />
        <KpiCard index={1} isRTL={isRTL}
          title={L("الوحدات المباعة اليوم", "Units sold today")}
          value={loading ? "…" : String(metrics?.unitsSoldToday || 0)}
          trend={unitsTrend}
          icon={ShoppingCart} />
        <KpiCard index={2} isRTL={isRTL}
          title={L("الأجهزة المتاحة", "Devices in stock")}
          value={loading ? "…" : String(metrics?.devicesInStock || 0)}
          sub={L("جاهزة للبيع", "Ready to sell")}
          icon={Smartphone} />
        <KpiCard index={3} isRTL={isRTL}
          title={L("الإكسسوارات المتاحة", "Accessories in stock")}
          value={loading ? "…" : fmt(metrics?.accessoriesInStock || 0)}
          sub={L("قطعة في المخزون", "Pieces in stock")}
          icon={Package} />
      </div>

      {/* المؤشرات الثانوية */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard index={4} compact isRTL={isRTL}
          title={L("طلبات صيانة مفتوحة", "Open repairs")}
          value={loading ? "…" : String(metrics?.pendingRepairs || 0)}
          sub={L("بانتظار الإنجاز", "Awaiting completion")}
          icon={Wrench} />
        <KpiCard index={5} compact isRTL={isRTL}
          title={L("مستحقات الموردين", "Supplier payables")}
          value={loading ? "…" : fmt(metrics?.supplierDebt || 0)} unit={currency}
          sub={L("مبالغ لم تُسدَّد بعد", "Not paid yet")}
          icon={Truck} />
        <KpiCard index={6} compact isRTL={isRTL}
          title={L("أوامر شراء غير مدفوعة", "Unpaid purchase orders")}
          value={loading ? "…" : String(metrics?.unpaidPurchaseOrders || 0)}
          sub={L("بانتظار السداد", "Awaiting payment")}
          icon={FileText} />
      </div>

      {/* أداء الفروع */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-6 bg-card rounded-2xl border shadow-sm p-6"
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
          <div className="py-8 text-center text-sm text-muted-foreground">...</div>
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
              <span className="text-muted-foreground">{L("إجمالي مبيعات الفروع اليوم", "All branches today")}</span>
              <span className="font-bold text-foreground tabular-nums">{fmt(branchesTotal)} {currency}</span>
            </div>
          </>
        )}
      </motion.div>

      {/* نظرة عامة على المبيعات */}
      <div className="mt-6">
        <SalesChart data={salesChart} loading={loading} />
      </div>

      {/* بقية الأدوات */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <TopProductsWidget />
            <FinancialSummary />
          </div>
          <RecentActivity sales={recentSales} loading={loading} />
        </div>
        <div className="space-y-6">
          <AlertsWidget />
        </div>
      </div>
    </AppLayout>
  );
}
