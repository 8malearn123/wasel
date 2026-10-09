import { DollarSign, Download, TrendingUp, Users } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import { fmtCount, fmtMoney, fmtPercent } from '@/lib/reportFormat';
import { ReportStats, type ReportStatCard } from '../ReportStats';
import { ReportCard, PanelEmpty } from '../ReportShell';
import { PanelTable, type PanelColumn } from './PanelTable';
import { barCursor, CHART_COLORS, chartTooltip } from './chartTheme';

export interface EmployeeRow {
  userId: string;
  userName: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  margin: number;
  avgSaleValue: number;
}

export function EmployeesDashboard({ rows, onExport }: { rows: EmployeeRow[]; onExport: () => void }) {
  const { t, isRTL } = useLanguage();
  const r = t.reports;

  if (rows.length === 0) {
    return (
      <ReportCard title={isRTL ? 'أداء الموظفين' : 'Employee performance'}>
        <PanelEmpty icon={Users} text={r.noSalesData} />
      </ReportCard>
    );
  }

  const revenue = rows.reduce((total, row) => total + row.totalRevenue, 0);
  const profit = rows.reduce((total, row) => total + row.totalProfit, 0);
  const sales = rows.reduce((total, row) => total + row.totalSales, 0);
  const best = rows.reduce((top, row) => (row.totalRevenue > top.totalRevenue ? row : top), rows[0]);

  const cards: ReportStatCard[] = [
    { key: 'count', label: isRTL ? 'موظفون لديهم مبيعات' : 'Employees with sales', value: fmtCount(rows.length), icon: Users },
    { key: 'sales', label: isRTL ? 'عدد المبيعات' : 'Sales', value: fmtCount(sales), icon: TrendingUp },
    { key: 'revenue', label: r.revenue, value: fmtMoney(revenue, isRTL), icon: DollarSign, tone: 'positive' },
    {
      key: 'top', label: isRTL ? 'الأعلى إيراداً' : 'Top by revenue', value: best.userName,
      hint: fmtMoney(best.totalRevenue, isRTL), icon: Users,
    },
  ];

  const columns: PanelColumn<EmployeeRow>[] = [
    {
      key: 'rank', header: '#', align: 'center',
      cell: (_row, index) => (
        <span className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
          index === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
        )}>
          {index + 1}
        </span>
      ),
    },
    {
      key: 'name', header: isRTL ? 'الموظف' : 'Employee',
      cell: row => <span className="font-medium text-foreground">{row.userName}</span>,
    },
    {
      key: 'sales', header: isRTL ? 'عدد المبيعات' : 'Sales', align: 'center', numeric: true,
      cell: row => <span className="font-semibold text-foreground">{fmtCount(row.totalSales)}</span>,
    },
    { key: 'revenue', header: r.revenue, align: 'center', numeric: true, cell: row => fmtMoney(row.totalRevenue, isRTL) },
    {
      key: 'profit', header: r.profit, align: 'center', numeric: true,
      cell: row => <span className="font-semibold text-primary">{fmtMoney(row.totalProfit, isRTL)}</span>,
    },
    { key: 'margin', header: r.margin, align: 'center', numeric: true, cell: row => fmtPercent(row.margin) },
    {
      key: 'avg', header: isRTL ? 'متوسط الفاتورة' : 'Avg sale', align: 'center', numeric: true,
      cell: row => <span className="text-muted-foreground">{fmtMoney(row.avgSaleValue, isRTL)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <ReportStats stats={cards} />

      <ReportCard title={isRTL ? 'مقارنة إيرادات الموظفين' : 'Employee revenue comparison'}>
        <div className="h-64 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="userName" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} width={70} />
              <Tooltip {...chartTooltip} cursor={barCursor} formatter={(v: number) => fmtMoney(v, isRTL)} />
              <Bar dataKey="totalRevenue" name={r.revenue} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalProfit" name={r.profit} fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ReportCard>

      <ReportCard
        title={isRTL ? 'أداء الموظفين' : 'Employee performance'}
        description={isRTL ? 'مرتّب حسب الإيراد' : 'Ordered by revenue'}
        action={
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onExport}>
            <Download className="h-4 w-4" />
            {r.exportCSV}
          </Button>
        }
      >
        <PanelTable columns={columns} rows={rows} rowKey={row => row.userId} />
      </ReportCard>

      <p className="px-1 text-xs text-muted-foreground">
        {isRTL
          ? `إجمالي الربح المحقق: ${fmtMoney(profit, isRTL)}`
          : `Total profit: ${fmtMoney(profit, isRTL)}`}
      </p>
    </div>
  );
}
