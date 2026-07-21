import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { TopProductsWidget } from "@/components/dashboard/TopProductsWidget";
import { FinancialSummary } from "@/components/dashboard/FinancialSummary";
import {
  DollarSign, ShoppingCart, Package, Smartphone, Wrench, Truck, FileText,
  TrendingUp, TrendingDown, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { LucideIcon } from "lucide-react";

// كرت مؤشر ثنائي اللغة — عنوان إنجليزي صغير فوق العربي، رقم كبير، وشريحة تغيّر أو وصف
function KpiCard({ en, ar, value, unit, change, changeLabel, sub, icon: Icon, highlight, index }: {
  en: string;
  ar: string;
  value: string;
  unit?: string;
  change?: number;
  changeLabel?: string;
  sub?: string;
  icon: LucideIcon;
  highlight?: boolean;
  index: number;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "bg-card rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow",
        highlight && "border-primary/40 ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70" dir="ltr">{en}</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{ar}</p>
        </div>
        <span className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
          highlight ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}>
          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-3xl font-extrabold text-foreground tracking-tight">{value}</p>
        {unit && <span className="text-xs font-semibold text-muted-foreground">{unit}</span>}
      </div>
      {typeof change === "number" ? (
        <div className="flex items-center gap-1.5 mt-2">
          <span className={cn(
            "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full",
            up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
          {changeLabel && <span className="text-[11px] text-muted-foreground">{changeLabel}</span>}
        </div>
      ) : sub ? (
        <p className="text-[11px] text-muted-foreground mt-2">{sub}</p>
      ) : null}
    </motion.div>
  );
}

export default function Dashboard() {
  const { t, isRTL } = useLanguage();
  const { metrics, salesChart, recentSales, branchStats, loading } = useDashboardData();

  const revenueChange = metrics && metrics.yesterdaysRevenue > 0
    ? ((metrics.todaysRevenue - metrics.yesterdaysRevenue) / metrics.yesterdaysRevenue * 100)
    : 0;

  const unitsChange = metrics && metrics.unitsSoldYesterday > 0
    ? ((metrics.unitsSoldToday - metrics.unitsSoldYesterday) / metrics.unitsSoldYesterday * 100)
    : 0;

  const fmt = (v: number) => v.toLocaleString('en-SA', { maximumFractionDigits: 0 });

  const branchesTotal = branchStats.reduce((s, b) => s + b.todayRevenue, 0);

  return (
    <AppLayout title={t.dashboard.title} subtitle={t.dashboard.subtitle}>
      {/* المؤشرات الرئيسية */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} highlight
          en="Today's Revenue" ar="إيرادات اليوم"
          value={loading ? "..." : fmt(metrics?.todaysRevenue || 0)} unit="ر.س"
          change={Number(revenueChange.toFixed(0))} changeLabel={t.dashboard.vsYesterday}
          icon={DollarSign} />
        <KpiCard index={1}
          en="Units Sold" ar="الوحدات المباعة"
          value={loading ? "..." : String(metrics?.unitsSoldToday || 0)}
          change={Number(unitsChange.toFixed(0))} changeLabel={t.dashboard.vsYesterday}
          icon={ShoppingCart} />
        <KpiCard index={2}
          en="Devices in Stock" ar="الأجهزة في المخزون"
          value={loading ? "..." : String(metrics?.devicesInStock || 0)}
          sub={isRTL ? "جهاز جاهز للبيع" : "devices ready to sell"}
          icon={Smartphone} />
        <KpiCard index={3}
          en="Accessories in Stock" ar="الإكسسوارات في المخزون"
          value={loading ? "..." : String(metrics?.accessoriesInStock || 0)}
          sub={isRTL ? "قطعة في المستودع" : "pieces in warehouse"}
          icon={Package} />
      </div>

      {/* المؤشرات الثانوية */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard index={4}
          en="Pending Repairs" ar="إصلاحات معلقة"
          value={loading ? "..." : String(metrics?.pendingRepairs || 0)}
          sub={isRTL ? "تحتاج متابعة" : "need follow-up"}
          icon={Wrench} />
        <KpiCard index={5}
          en="Supplier Payables" ar="مديونيات الموردين"
          value={loading ? "..." : fmt(metrics?.supplierDebt || 0)} unit="ر.س"
          sub={isRTL ? "مستحقات غير مسددة" : "outstanding payables"}
          icon={Truck} />
        <KpiCard index={6}
          en="Unpaid POs" ar="طلبات شراء غير مدفوعة"
          value={loading ? "..." : String(metrics?.unpaidPurchaseOrders || 0)}
          sub={isRTL ? "بانتظار السداد" : "awaiting payment"}
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
              <h3 className="font-bold text-foreground">{isRTL ? "أداء الفروع" : "Branch Performance"}</h3>
              <p className="text-[11px] text-muted-foreground tracking-wider" dir="ltr">Branch Metrics · Live</p>
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
          <div className="py-8 text-center text-sm text-muted-foreground">{isRTL ? "لا توجد فروع" : "No branches"}</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {branchStats.map((b, i) => (
                <div key={b.id} className={cn(
                  "rounded-xl border p-4",
                  i === 0 ? "border-primary/40 bg-primary/5" : "bg-muted/20"
                )}>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-extrabold text-foreground">{fmt(b.todayRevenue)}</p>
                    <span className="text-xs font-semibold text-muted-foreground">ر.س</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-1">{b.name}</p>
                  <p className="text-[11px] text-muted-foreground">{b.todaySales} {isRTL ? "مبيعة اليوم" : "sales today"}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{isRTL ? "إجمالي مبيعات الفروع اليوم" : "Total branch sales today"} ·</span>
              <span className="font-extrabold text-foreground">{fmt(branchesTotal)} ر.س</span>
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
