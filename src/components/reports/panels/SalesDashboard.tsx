import { motion } from 'framer-motion';
import {
  BarChart3, Download, Package, Smartphone, TrendingDown, TrendingUp,
} from 'lucide-react';
import { RiyalSign } from "@/components/icons/RiyalSign";
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
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
import { chartTooltip } from './chartTheme';

type DeviceStatusKey = 'available' | 'reserved' | 'sold';

interface Props {
  stats: {
    todayRevenue: number; todayProfit: number;
    thisMonthRevenue: number; revenueChange: number;
    inventoryValue: number; availableDevices: number; lowStockItems: number;
  };
  chartData: { date: string; totalRevenue: number; profit: number }[];
  period: 'daily' | 'monthly';
  onPeriodChange: (period: 'daily' | 'monthly') => void;
  statusBreakdown: { key: DeviceStatusKey; name: string; value: number }[];
  branches: { branchName: string; totalRevenue: number }[];
  topDevices: { brand: string; model: string; unitsSold: number; profit: number; margin: number }[];
  onExport: () => void;
}

// Revenue and profit are two different things on one chart, so they get two
// hues that also differ for colour-blind readers (blue against green), not
// two shades of the same blue
const REVENUE = 'hsl(var(--primary))';
const PROFIT = 'hsl(var(--success))';

// A status keeps its colour whichever of the others are present, so a shop
// with nothing reserved does not see "sold" turn the reserved colour
const STATUS_COLOR: Record<DeviceStatusKey, string> = {
  available: 'hsl(var(--success))',
  reserved: 'hsl(var(--primary))',
  sold: 'hsl(var(--muted-foreground))',
};

/** 12,500 → 12.5K, so the axis stays narrow next to a riyal figure */
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
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
      icon: RiyalSign, tone: 'positive',
    },
    {
      key: 'month', label: r.monthlyRevenue, value: fmtMoney(stats.thisMonthRevenue, isRTL),
      // Isolated left-to-right, or the bidi algorithm moves the sign to the
      // far end of an Arabic sentence and "-100%" reads as "%100-"
      hint: `⁦${stats.revenueChange >= 0 ? '+' : ''}${fmtPercent(stats.revenueChange)}⁩ ${r.changeFromLastMonth}`,
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

  // A period with no sales used to draw a flat line along zero with a 0–4
  // axis, which reads like a broken chart; it is an empty period, said so
  const hasSales = chartData.some(d => d.totalRevenue !== 0 || d.profit !== 0);
  const periodTotal = chartData.reduce((sum, d) => sum + d.totalRevenue, 0);

  const statusTotal = statusBreakdown.reduce((sum, s) => sum + s.value, 0);
  const branchTotal = branches.reduce((sum, b) => sum + b.totalRevenue, 0);
  const branchMax = Math.max(0, ...branches.map(b => b.totalRevenue));
  const rankedBranches = [...branches].sort((a, b) => b.totalRevenue - a.totalRevenue);

  return (
    <div className="space-y-4">
      <ReportStats stats={cards} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ReportCard
          className="lg:col-span-2"
          title={r.salesOverview}
          description={hasSales
            ? `${r.revenue}: ${fmtMoney(periodTotal, isRTL)}`
            : undefined}
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
          {!hasSales ? (
            <div className="h-72"><PanelEmpty icon={BarChart3} text={r.noSalesData} /></div>
          ) : (
            <div className="p-4 pt-3">
              <div className="mb-2 flex items-center gap-4">
                <LegendDot color={REVENUE} label={r.revenue} />
                <LegendDot color={PROFIT} label={r.profit} />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={REVENUE} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={REVENUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date" tickLine={false} axisLine={false} minTickGap={16}
                      stroke="hsl(var(--muted-foreground))" fontSize={12}
                      tickFormatter={v => (period === 'daily' ? String(v).slice(5) : String(v))}
                    />
                    <YAxis
                      orientation={isRTL ? 'right' : 'left'} tickLine={false} axisLine={false}
                      stroke="hsl(var(--muted-foreground))" fontSize={12} width={48}
                      tickFormatter={(v: number) => compact.format(v)}
                    />
                    <Tooltip
                      {...chartTooltip}
                      cursor={{ stroke: 'hsl(var(--border))' }}
                      formatter={(v: number) => fmtMoney(v, isRTL)}
                    />
                    <Area
                      type="monotone" dataKey="totalRevenue" name={r.revenue}
                      stroke={REVENUE} strokeWidth={2} fill="url(#revenueFill)"
                      dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    />
                    <Line
                      type="monotone" dataKey="profit" name={r.profit}
                      stroke={PROFIT} strokeWidth={2}
                      dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </ReportCard>

        {/* Three parts of one whole: a single split bar with the figures
            written out reads at a glance, where the donut's labels were cut
            off at the card edge */}
        <ReportCard
          title={r.deviceStatus}
          description={statusTotal > 0 ? `${fmtCount(statusTotal)} ${r.devices}` : undefined}
        >
          {statusTotal === 0 ? (
            <div className="h-72"><PanelEmpty icon={Smartphone} text={r.noData} /></div>
          ) : (
            <div className="space-y-5 p-5">
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img"
                aria-label={statusBreakdown.map(s => `${s.name}: ${fmtCount(s.value)}`).join('، ')}>
                {statusBreakdown.map(s => (
                  <span
                    key={s.key}
                    className="h-full first:rounded-s-full last:rounded-e-full"
                    style={{ width: `${(s.value / statusTotal) * 100}%`, backgroundColor: STATUS_COLOR[s.key] }}
                  />
                ))}
              </div>
              <ul className="space-y-3">
                {statusBreakdown.map(s => (
                  <li key={s.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s.key] }} />
                      {s.name}
                    </span>
                    <span className="flex items-baseline gap-2 tabular-nums">
                      <span className="text-base font-semibold text-foreground">{fmtCount(s.value)}</span>
                      <span className="w-12 text-end text-xs text-muted-foreground">
                        {fmtPercent((s.value / statusTotal) * 100, 0)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ReportCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* A shop has a handful of branches: a ranked list with the riyal
            figure written out beats a bar chart whose axis read 0…60000 */}
        <ReportCard
          title={r.branchPerformance}
          description={branchTotal > 0 ? `${r.revenue}: ${fmtMoney(branchTotal, isRTL)}` : undefined}
        >
          {rankedBranches.length === 0 ? (
            <PanelEmpty icon={BarChart3} text={r.noBranchData} />
          ) : (
            <ul className="max-h-72 space-y-4 overflow-y-auto p-5">
              {rankedBranches.map(b => {
                const share = branchTotal > 0 ? (b.totalRevenue / branchTotal) * 100 : 0;
                const width = branchMax > 0 ? (b.totalRevenue / branchMax) * 100 : 0;
                return (
                  <li key={b.branchName} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-foreground">{b.branchName}</span>
                      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                        <span className="text-sm font-semibold text-foreground">{fmtMoney(b.totalRevenue, isRTL)}</span>
                        <span className="w-12 text-end text-xs text-muted-foreground">{fmtPercent(share, 0)}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: REVENUE }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ReportCard>

        <ReportCard title={r.topProfitDevices} description={isRTL ? 'أعلى عشرة' : 'Top ten'}>
          {topDevices.length === 0 ? (
            <PanelEmpty icon={Smartphone} text={r.noSalesData} />
          ) : (
            <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto">
              {topDevices.map((item, i) => (
                <motion.li
                  key={`${item.brand}-${item.model}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                      i < 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
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
                    <p className="text-sm font-semibold tabular-nums text-foreground">{fmtMoney(item.profit, isRTL)}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {r.margin} {fmtPercent(item.margin)}
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
