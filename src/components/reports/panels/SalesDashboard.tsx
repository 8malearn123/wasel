import { motion } from 'framer-motion';
import {
  BarChart3, DollarSign, Download, Package, Smartphone, TrendingDown, TrendingUp,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import { fmtCount, fmtMoney, fmtPercent } from '@/lib/reportFormat';
import { ReportStats, type ReportStatCard } from '../ReportStats';
import { ReportCard, PanelEmpty } from '../ReportShell';
import { barCursor, CHART_COLORS, chartTooltip } from './chartTheme';

interface Props {
  stats: {
    todayRevenue: number; todayProfit: number;
    thisMonthRevenue: number; revenueChange: number;
    inventoryValue: number; availableDevices: number; lowStockItems: number;
  };
  chartData: { date: string; totalRevenue: number; profit: number }[];
  period: 'daily' | 'monthly';
  onPeriodChange: (period: 'daily' | 'monthly') => void;
  statusBreakdown: { name: string; value: number }[];
  branches: { branchName: string; totalRevenue: number }[];
  topDevices: { brand: string; model: string; unitsSold: number; profit: number; margin: number }[];
  onExport: () => void;
}

export function SalesDashboard({
  stats, chartData, period, onPeriodChange,
  statusBreakdown, branches, topDevices, onExport,
}: Props) {
  const { t, isRTL } = useLanguage();
  const r = t.reports;

  const cards: ReportStatCard[] = [
    {
      key: 'today', label: r.todayRevenue, value: fmtMoney(stats.todayRevenue, isRTL),
      hint: `${r.todayProfit}: ${fmtMoney(stats.todayProfit, isRTL)}`,
      icon: DollarSign, tone: 'positive',
    },
    {
      key: 'month', label: r.monthlyRevenue, value: fmtMoney(stats.thisMonthRevenue, isRTL),
      hint: `${stats.revenueChange >= 0 ? '+' : ''}${fmtPercent(stats.revenueChange)} ${r.changeFromLastMonth}`,
      icon: stats.revenueChange >= 0 ? TrendingUp : TrendingDown,
      tone: stats.revenueChange >= 0 ? 'positive' : 'danger',
    },
    {
      key: 'inventory', label: r.inventoryValue, value: fmtMoney(stats.inventoryValue, isRTL),
      hint: `${fmtCount(stats.availableDevices)} ${r.devices}`, icon: Smartphone,
    },
    {
      key: 'lowStock', label: r.lowStockItems, value: fmtCount(stats.lowStockItems),
      hint: r.needsRestock, icon: Package,
      tone: stats.lowStockItems > 0 ? 'danger' : 'default',
    },
  ];

  return (
    <div className="space-y-4">
      <ReportStats stats={cards} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard
          title={r.salesOverview}
          action={
            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={v => onPeriodChange(v as 'daily' | 'monthly')}>
                <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{r.daily}</SelectItem>
                  <SelectItem value="monthly">{r.monthly}</SelectItem>
                </SelectContent>
              </Select>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline" size="icon" className="h-9 w-9" onClick={onExport}
                    aria-label={isRTL ? 'تصدير بيانات الرسم' : 'Export the chart data'}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isRTL
                    ? `تصدير ${period === 'daily' ? 'الأيام' : 'الأشهر'} المعروضة إلى CSV`
                    : `Export the shown ${period === 'daily' ? 'days' : 'months'} to CSV`}
                </TooltipContent>
              </UiTooltip>
            </div>
          }
        >
          <div className="h-64 p-4">
            {chartData.length === 0 ? (
              <PanelEmpty icon={BarChart3} text={r.noSalesData} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12}
                    tickFormatter={v => (period === 'daily' ? String(v).slice(5) : String(v))}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} width={70} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => fmtMoney(v, isRTL)} />
                  <Line type="monotone" dataKey="totalRevenue" name={r.revenue}
                    stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" name={r.profit}
                    stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </ReportCard>

        <ReportCard title={r.deviceStatus}>
          <div className="h-64 p-4">
            {statusBreakdown.length === 0 ? (
              <PanelEmpty icon={Smartphone} text={r.noData} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    paddingAngle={2} dataKey="value"
                    label={({ name, value }) => `${name}: ${fmtCount(Number(value))}`}
                  >
                    {statusBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltip} formatter={(v: number) => fmtCount(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ReportCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title={r.branchPerformance}>
          <div className="h-64 p-4">
            {branches.length === 0 ? (
              <PanelEmpty icon={BarChart3} text={r.noBranchData} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branches} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="branchName"
                    stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                  <Tooltip {...chartTooltip} cursor={barCursor} formatter={(v: number) => fmtMoney(v, isRTL)} />
                  <Bar dataKey="totalRevenue" name={r.revenue} fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ReportCard>

        <ReportCard title={r.topProfitDevices} description={isRTL ? 'أعلى عشرة' : 'Top ten'}>
          {topDevices.length === 0 ? (
            <PanelEmpty icon={Smartphone} text={r.noSalesData} />
          ) : (
            <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto">
              {topDevices.map((item, i) => (
                <motion.li
                  key={`${item.brand}-${item.model}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                  className="flex items-center justify-between gap-3 px-5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      i === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                    )}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.model}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.brand} · {fmtCount(item.unitsSold)} {r.sold}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-bold tabular-nums text-primary">{fmtMoney(item.profit, isRTL)}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {fmtPercent(item.margin)} {r.margin}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </ReportCard>
      </div>
    </div>
  );
}
