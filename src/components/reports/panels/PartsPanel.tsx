import { AlertTriangle, DollarSign, Download, Package, Wrench } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { fmtCount, fmtMoney, fmtNumber } from '@/lib/reportFormat';
import { ReportStats, type ReportStatCard } from '../ReportStats';
import { ReportCard, PanelEmpty } from '../ReportShell';
import { PanelTable, type PanelColumn } from './PanelTable';
import { barCursor, CHART_COLORS, chartTooltip } from './chartTheme';

export interface PartConsumption {
  partName: string;
  partSku: string;
  totalUsed: number;
  totalCost: number;
  repairCount: number;
}

interface Props {
  consumption: PartConsumption[];
  dailyUsage: { date: string; totalParts: number; totalCost: number }[];
  summary: {
    totalPartsUsed: number; totalRepairsWithParts: number; totalCost: number;
    lowStockCount: number; outOfStockCount: number; avgCostPerRepair: number;
  };
  onExport: () => void;
}

export function PartsPanel({ consumption, dailyUsage, summary, onExport }: Props) {
  const { t, isRTL } = useLanguage();
  const r = t.reports;

  const cards: ReportStatCard[] = [
    {
      key: 'used', label: r.totalPartsUsed, value: fmtCount(summary.totalPartsUsed),
      hint: r.inRepairs.replace('{0}', String(summary.totalRepairsWithParts)), icon: Wrench,
    },
    {
      key: 'cost', label: r.totalPartsCost, value: fmtMoney(summary.totalCost, isRTL),
      hint: `${r.avgPerRepair} ${fmtMoney(summary.avgCostPerRepair, isRTL)}`,
      icon: DollarSign, tone: 'positive',
    },
    {
      key: 'low', label: r.lowStockParts, value: fmtCount(summary.lowStockCount),
      hint: r.belowMinimum, icon: AlertTriangle,
      tone: summary.lowStockCount > 0 ? 'warning' : 'default',
    },
    {
      key: 'out', label: r.outOfStockParts, value: fmtCount(summary.outOfStockCount),
      hint: r.unavailable, icon: Package,
      tone: summary.outOfStockCount > 0 ? 'danger' : 'default',
    },
  ];

  const columns: PanelColumn<PartConsumption>[] = [
    {
      key: 'rank', header: '#', align: 'center',
      cell: (_row, index) => (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index + 1}
        </span>
      ),
    },
    {
      key: 'name', header: r.part,
      cell: row => <span className="font-medium text-foreground">{row.partName}</span>,
    },
    { key: 'sku', header: 'SKU', mono: true, cell: row => row.partSku },
    {
      key: 'used', header: r.quantityUsed, align: 'center', numeric: true,
      cell: row => <span className="font-semibold text-foreground">{fmtNumber(row.totalUsed)}</span>,
    },
    {
      key: 'cost', header: r.totalCostLabel, align: 'center', numeric: true,
      cell: row => <span className="font-semibold text-foreground">{fmtMoney(row.totalCost, isRTL)}</span>,
    },
    {
      key: 'repairs', header: r.repairCount, align: 'center', numeric: true,
      cell: row => <span className="text-muted-foreground">{fmtCount(row.repairCount)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <ReportStats stats={cards} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title={r.dailyPartsUsage}>
          <div className="h-64 p-4">
            {dailyUsage.length === 0 ? (
              <PanelEmpty icon={Wrench} text={r.noPartsUsed} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12}
                    tickFormatter={v => String(v).slice(5)} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} width={50} />
                  <Tooltip {...chartTooltip} cursor={barCursor} formatter={(v: number) => [`${fmtNumber(v)} ${r.pieces}`, r.part]} />
                  <Bar dataKey="totalParts" name={r.part} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ReportCard>

        <ReportCard title={r.dailyPartsCost}>
          <div className="h-64 p-4">
            {dailyUsage.length === 0 ? (
              <PanelEmpty icon={DollarSign} text={r.noPartsUsed} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12}
                    tickFormatter={v => String(v).slice(5)} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} width={70} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => [fmtMoney(v, isRTL), r.cost]} />
                  <Line type="monotone" dataKey="totalCost" name={r.cost}
                    stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </ReportCard>
      </div>

      <ReportCard
        title={r.partsConsumptionDetails}
        description={r.sortedByUsage}
        action={
          <Button variant="outline" size="sm" className="h-9 gap-2"
            onClick={onExport} disabled={consumption.length === 0}>
            <Download className="h-4 w-4" />
            {r.exportCSV}
          </Button>
        }
      >
        {consumption.length === 0 ? (
          <PanelEmpty icon={Wrench} text={r.noPartsUsed} />
        ) : (
          <PanelTable columns={columns} rows={consumption} rowKey={row => row.partSku} maxHeight="32rem" />
        )}
      </ReportCard>
    </div>
  );
}
