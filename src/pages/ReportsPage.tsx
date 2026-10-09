import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive, BarChart3, FileText, Heart, Home, Package, Smartphone,
  Truck, Users, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { SectionNav } from '@/components/layout/SectionNav';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useTabParam } from '@/hooks/useTabParam';
import { useLanguage } from '@/i18n';
import { useReports } from '@/hooks/useReports';
import { ReportTable } from '@/components/reports/ReportTable';
import { ReportPanel } from '@/components/reports/ReportShell';
import { SalesDashboard } from '@/components/reports/panels/SalesDashboard';
import { InventoryDashboard } from '@/components/reports/panels/InventoryDashboard';
import { EmployeesDashboard } from '@/components/reports/panels/EmployeesDashboard';
import { DeadStockPanel, type DeadStockDevice } from '@/components/reports/panels/DeadStockPanel';
import type { PartConsumption } from '@/components/reports/panels/PartsPanel';
import { LoadingState } from '@/components/common/StateViews';
import { salesReport, devicesReport, accessoriesReport } from '@/lib/reportDefinitions';
import { downloadCsv, type SheetColumn } from '@/lib/xlsx';

// Only mounted on their own report, so selecting المبيعات does not also fetch
// the customer and supplier lists
const CustomersTableReport = lazy(() =>
  import('@/components/reports/panels/LazyTableReports')
    .then(m => ({ default: m.CustomersTableReport })));
const SuppliersTableReport = lazy(() =>
  import('@/components/reports/panels/LazyTableReports')
    .then(m => ({ default: m.SuppliersTableReport })));
const RepairPartsReport = lazy(() =>
  import('@/components/reports/panels/LazyTableReports')
    .then(m => ({ default: m.RepairPartsReport })));

/**
 * التقارير والتحليلات.
 *
 * Ten reports in four groups: what was sold, what is in stock, who sold it,
 * and who the shop deals with. Each one is either a dashboard panel (charts
 * and a read-only table) or an exportable report driven by a definition in
 * reportDefinitions.ts — adding one of those is a definition, not a screen.
 */
export default function ReportsPage() {
  const { t, isRTL } = useLanguage();
  const r = t.reports;
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useTabParam('sales');

  const {
    loading, error, refetch,
    getDailySalesReport, getMonthlySalesReport,
    getInventoryReport, getBranchReport, getProfitByDevice, getSummaryStats,
    getEmployeePerformance,
    devices, accessories, salesData,
  } = useReports();

  // These walk every sale and every device. They used to be called straight
  // from JSX — twice each, since `x().length === 0 ? … : x().map(…)` — so the
  // whole pass ran again on every render.
  const dailyData = useMemo(() => getDailySalesReport(14), [getDailySalesReport]);
  const monthlyData = useMemo(() => getMonthlySalesReport(6), [getMonthlySalesReport]);
  const inventory = useMemo(() => getInventoryReport(), [getInventoryReport]);
  const branchReport = useMemo(() => getBranchReport(), [getBranchReport]);
  const topDevices = useMemo(() => getProfitByDevice().slice(0, 10), [getProfitByDevice]);
  const stats = useMemo(() => getSummaryStats(), [getSummaryStats]);
  const employeeData = useMemo(() => getEmployeePerformance(), [getEmployeePerformance]);
  const chartData = period === 'daily' ? dailyData : monthlyData;

  const statusBreakdown = useMemo(() => [
    { name: r.available, value: inventory.availableDevices },
    { name: r.reserved, value: inventory.reservedDevices },
    { name: r.soldStatus, value: inventory.soldDevices },
  ].filter(d => d.value > 0), [inventory, r]);

  const deadStock = useMemo<DeadStockDevice[]>(() => {
    const now = new Date();
    const deviceLastSale: Record<string, Date> = {};
    for (const sale of salesData) {
      for (const item of sale.items || []) {
        if (!item.device_id) continue;
        const saleDate = new Date(sale.sale_date);
        if (!deviceLastSale[item.device_id] || saleDate > deviceLastSale[item.device_id]) {
          deviceLastSale[item.device_id] = saleDate;
        }
      }
    }
    const byModel = new Map(devices.map(d => [d.id, `${d.brand}-${d.model}`]));
    const modelLastSale: Record<string, Date> = {};
    for (const [deviceId, lastSale] of Object.entries(deviceLastSale)) {
      const key = byModel.get(deviceId);
      if (!key) continue;
      if (!modelLastSale[key] || lastSale > modelLastSale[key]) modelLastSale[key] = lastSale;
    }
    return devices
      .filter(d => d.status === 'available')
      .map(d => {
        const lastSale = modelLastSale[`${d.brand}-${d.model}`];
        const daysSinceLastSale = lastSale
          ? Math.floor((now.getTime() - lastSale.getTime()) / 86_400_000)
          : null;
        return { ...d, daysSinceLastSale };
      })
      .filter(d => d.daysSinceLastSale === null || d.daysSinceLastSale >= 60)
      .sort((a, b) => (b.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER) - (a.daysSinceLastSale ?? Number.MAX_SAFE_INTEGER));
  }, [devices, salesData]);

  const lowStock = useMemo(
    () => accessories
      .filter(a => Number(a.quantity) <= Number(a.min_quantity ?? 0))
      .sort((a, b) => Number(a.quantity) - Number(b.quantity)),
    [accessories],
  );

  /**
   * One CSV path for the dashboard panels.
   *
   * The page used to carry its own writer that wrapped every cell in quotes
   * without escaping the quotes inside it, so a product name containing one
   * broke the row. `downloadCsv` escapes properly, and the toast now waits for
   * it to return rather than firing even when nothing was written.
   */
  const exportRows = useCallback(
    <Row,>(name: string, columns: SheetColumn<Row>[], rows: Row[]) => {
      if (rows.length === 0) {
        toast.error(isRTL ? 'لا توجد صفوف لتصديرها' : 'There are no rows to export');
        return;
      }
      try {
        downloadCsv(`${name}-${new Date().toISOString().slice(0, 10)}`, columns, rows);
        toast.success(r.exportSuccess);
      } catch (err) {
        toast.error(isRTL ? 'فشل التصدير' : 'The export failed', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [isRTL, r.exportSuccess],
  );

  const exportSalesChart = () => exportRows('sales-overview', [
    { key: 'date', header: isRTL ? 'التاريخ' : 'Date', value: d => d.date },
    { key: 'revenue', header: r.revenue, value: d => d.totalRevenue },
    { key: 'cost', header: r.cost, value: d => d.totalCost },
    { key: 'profit', header: r.profit, value: d => d.profit },
    { key: 'devices', header: r.devices, value: d => d.devicesSold },
  ], chartData);

  const exportLowStock = () => exportRows('low-stock', [
    { key: 'sku', header: 'SKU', value: a => a.sku },
    { key: 'name', header: r.itemName, value: a => a.name },
    { key: 'quantity', header: r.currentStock, value: a => Number(a.quantity) },
    { key: 'min', header: r.minStock, value: a => Number(a.min_quantity ?? 0) },
    { key: 'cost', header: r.cost, value: a => Number(a.cost) },
  ], lowStock);

  const exportEmployees = () => exportRows('employee-performance', [
    { key: 'name', header: isRTL ? 'الموظف' : 'Employee', value: e => e.userName },
    { key: 'sales', header: isRTL ? 'عدد المبيعات' : 'Sales', value: e => e.totalSales },
    { key: 'revenue', header: r.revenue, value: e => e.totalRevenue },
    { key: 'profit', header: r.profit, value: e => e.totalProfit },
    { key: 'margin', header: r.margin, value: e => e.margin },
    { key: 'avg', header: isRTL ? 'متوسط الفاتورة' : 'Avg sale', value: e => e.avgSaleValue },
  ], employeeData);

  const exportDeadStock = () => exportRows('dead-stock', [
    { key: 'imei', header: 'IMEI', value: d => d.imei },
    { key: 'name', header: r.itemName, value: d => `${d.brand ?? ''} ${d.model}`.trim() },
    { key: 'cost', header: r.cost, value: d => Number(d.cost) },
    {
      key: 'days', header: r.daysSinceLastSale,
      value: d => d.daysSinceLastSale ?? (isRTL ? 'لم يُبع' : 'Never sold'),
    },
  ], deadStock);

  const exportParts = (rows: PartConsumption[]) => exportRows('repair-parts', [
    { key: 'name', header: r.part, value: p => p.partName },
    { key: 'sku', header: 'SKU', value: p => p.partSku },
    { key: 'used', header: r.quantityUsed, value: p => p.totalUsed },
    { key: 'cost', header: r.totalCostLabel, value: p => p.totalCost },
    { key: 'repairs', header: r.repairCount, value: p => p.repairCount },
  ], rows);

  // The four groups the reports fall into, by what they answer about
  const groups = [
    {
      label: isRTL ? 'المبيعات' : 'Sales',
      items: [
        { key: 'sales', label: isRTL ? 'المبيعات والأرباح' : 'Sales & profit', icon: BarChart3 },
        { key: 'table-sales', label: isRTL ? 'تفاصيل المبيعات' : 'Sales detail', icon: FileText },
      ],
    },
    {
      label: isRTL ? 'المخزون والمنتجات' : 'Stock & products',
      items: [
        { key: 'inventory', label: isRTL ? 'المخزون' : 'Stock', icon: Package },
        { key: 'table-devices', label: isRTL ? 'الأجهزة' : 'Devices', icon: Smartphone },
        { key: 'table-accessories', label: isRTL ? 'الإكسسوارات' : 'Accessories', icon: Package },
        { key: 'parts', label: isRTL ? 'قطع الصيانة' : 'Repair parts', icon: Wrench },
        { key: 'deadstock', label: isRTL ? 'الرواكد' : 'Dead stock', icon: Archive },
      ],
    },
    {
      label: isRTL ? 'الموارد البشرية' : 'People',
      items: [
        { key: 'employees', label: isRTL ? 'الموظفون' : 'Employees', icon: Users },
      ],
    },
    {
      label: isRTL ? 'العلاقات التجارية' : 'Trading partners',
      items: [
        { key: 'table-suppliers', label: isRTL ? 'الموردون' : 'Suppliers', icon: Truck },
        { key: 'table-customers', label: isRTL ? 'العملاء' : 'Customers', icon: Heart },
      ],
    },
  ];

  const all = groups.flatMap(g => g.items);
  const current = all.find(item => item.key === activeTab) ?? all[0];

  return (
    <AppLayout
      title={r.title}
      subtitle={isRTL
        ? 'متابعة الأداء والمبيعات والمخزون من مكان واحد'
        : 'Performance, sales and stock, from one place'}
    >
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/" className="flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" />
                {isRTL ? 'الرئيسية' : 'Home'}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className={isRTL ? 'rotate-180' : undefined} />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-muted-foreground">{r.title}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator className={isRTL ? 'rotate-180' : undefined} />
          <BreadcrumbItem>
            <BreadcrumbPage>{current.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <SectionNav groups={groups} value={current.key} onChange={setActiveTab} />

      {/* Only the selected report is rendered: ten mounted panels would mean
          ten chart trees and ten tables living behind one visible screen */}
      {current.key === 'sales' && (
        <ReportPanel loading={loading} error={error} onRetry={refetch}>
          <SalesDashboard
            stats={stats}
            chartData={chartData}
            period={period}
            onPeriodChange={setPeriod}
            statusBreakdown={statusBreakdown}
            branches={branchReport}
            topDevices={topDevices}
            onExport={exportSalesChart}
          />
        </ReportPanel>
      )}

      {current.key === 'inventory' && (
        <ReportPanel loading={loading} error={error} onRetry={refetch}>
          <InventoryDashboard inventory={inventory} lowStock={lowStock} onExport={exportLowStock} />
        </ReportPanel>
      )}

      {current.key === 'employees' && (
        <ReportPanel loading={loading} error={error} onRetry={refetch}>
          <EmployeesDashboard rows={employeeData} onExport={exportEmployees} />
        </ReportPanel>
      )}

      {current.key === 'deadstock' && (
        <ReportPanel loading={loading} error={error} onRetry={refetch}>
          <DeadStockPanel rows={deadStock} onExport={exportDeadStock} />
        </ReportPanel>
      )}

      {current.key === 'parts' && (
        <Suspense fallback={<LoadingState />}>
          <RepairPartsReport onExport={exportParts} />
        </Suspense>
      )}

      {current.key === 'table-sales' && (
        <ReportTable
          definition={salesReport} rows={salesData} loading={loading}
          error={error} onRetry={refetch}
          emptyText={isRTL ? 'لا توجد مبيعات بعد' : 'No sales yet'}
        />
      )}

      {current.key === 'table-devices' && (
        <ReportTable
          definition={devicesReport} rows={devices} loading={loading}
          error={error} onRetry={refetch}
          emptyText={isRTL ? 'لا توجد أجهزة في المخزون' : 'No devices in stock'}
        />
      )}

      {current.key === 'table-accessories' && (
        <ReportTable
          definition={accessoriesReport} rows={accessories} loading={loading}
          error={error} onRetry={refetch}
          emptyText={isRTL ? 'لا توجد إكسسوارات' : 'No accessories'}
        />
      )}

      {current.key === 'table-suppliers' && (
        <Suspense fallback={<LoadingState />}><SuppliersTableReport /></Suspense>
      )}

      {current.key === 'table-customers' && (
        <Suspense fallback={<LoadingState />}><CustomersTableReport /></Suspense>
      )}
    </AppLayout>
  );
}
