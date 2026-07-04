import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard, MetricGrid } from "@/components/dashboard/MetricCard";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { BranchOverview } from "@/components/dashboard/BranchOverview";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { TopProductsWidget } from "@/components/dashboard/TopProductsWidget";
import { FinancialSummary } from "@/components/dashboard/FinancialSummary";
import { DollarSign, ShoppingCart, Package, Smartphone, Wrench, Truck } from "lucide-react";
import { useLanguage } from "@/i18n";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function Dashboard() {
  const { t, isRTL } = useLanguage();
  const { metrics, salesChart, recentSales, branchStats, loading } = useDashboardData();

  const revenueChange = metrics && metrics.yesterdaysRevenue > 0
    ? ((metrics.todaysRevenue - metrics.yesterdaysRevenue) / metrics.yesterdaysRevenue * 100)
    : 0;

  const unitsChange = metrics && metrics.unitsSoldYesterday > 0
    ? ((metrics.unitsSoldToday - metrics.unitsSoldYesterday) / metrics.unitsSoldYesterday * 100)
    : 0;

  const formatCurrency = (v: number) => {
    return v.toLocaleString('en-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ر.س';
  };

  return (
    <AppLayout title={t.dashboard.title} subtitle={t.dashboard.subtitle}>
      {/* Key Metrics - Row 1 */}
      <MetricGrid>
        <MetricCard
          title={t.dashboard.todaysRevenue}
          value={loading ? "..." : formatCurrency(metrics?.todaysRevenue || 0)}
          change={Number(revenueChange.toFixed(1))}
          changeLabel={t.dashboard.vsYesterday}
          icon={DollarSign}
          variant="primary"
        />
        <MetricCard
          title={t.dashboard.unitsSold}
          value={loading ? "..." : String(metrics?.unitsSoldToday || 0)}
          change={Number(unitsChange.toFixed(1))}
          changeLabel={t.dashboard.vsYesterday}
          icon={ShoppingCart}
          variant="success"
        />
        <MetricCard
          title={t.dashboard.devicesInStock}
          value={loading ? "..." : String(metrics?.devicesInStock || 0)}
          icon={Smartphone}
          variant="accent"
        />
        <MetricCard
          title={t.dashboard.accessoriesInStock}
          value={loading ? "..." : String(metrics?.accessoriesInStock || 0)}
          icon={Package}
          variant="warning"
        />
      </MetricGrid>

      {/* Secondary Metrics - Row 2 */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title={isRTL ? "إصلاحات معلقة" : "Pending Repairs"}
          value={loading ? "..." : String(metrics?.pendingRepairs || 0)}
          icon={Wrench}
          variant="warning"
        />
        <MetricCard
          title={isRTL ? "مديونيات الموردين" : "Supplier Debt"}
          value={loading ? "..." : formatCurrency(metrics?.supplierDebt || 0)}
          icon={Truck}
          variant="accent"
        />
        <MetricCard
          title={isRTL ? "طلبات شراء غير مدفوعة" : "Unpaid POs"}
          value={loading ? "..." : String(metrics?.unpaidPurchaseOrders || 0)}
          icon={DollarSign}
          variant="default"
        />
      </div>

      {/* Main Content Grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SalesChart data={salesChart} loading={loading} />
          <div className="grid gap-6 md:grid-cols-2">
            <TopProductsWidget />
            <FinancialSummary />
          </div>
          <RecentActivity sales={recentSales} loading={loading} />
        </div>

        <div className="space-y-6">
          <BranchOverview branches={branchStats} loading={loading} />
          <AlertsWidget />
        </div>
      </div>
    </AppLayout>
  );
}
