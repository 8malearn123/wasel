import { Archive, Clock, DollarSign, Download, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Device } from '@/types/database';
import { useLanguage } from '@/i18n';
import { fmtCount, fmtMoney } from '@/lib/reportFormat';
import { ReportStats, type ReportStatCard } from '../ReportStats';
import { ReportCard, PanelEmpty } from '../ReportShell';
import { PanelTable, type PanelColumn } from './PanelTable';

export type DeadStockDevice = Device & { daysSinceLastSale: number | null };

export function DeadStockPanel({ rows, onExport }: { rows: DeadStockDevice[]; onExport: () => void }) {
  const { t, isRTL } = useLanguage();
  const r = t.reports;

  if (rows.length === 0) {
    return (
      <ReportCard title={r.deadStockTitle} description={r.deadStockDesc}>
        <PanelEmpty icon={Archive} text={r.noDeadStock} />
      </ReportCard>
    );
  }

  const tiedUp = rows.reduce((total, row) => total + Number(row.cost || 0), 0);
  const neverSold = rows.filter(row => row.daysSinceLastSale === null);
  const aged = rows.filter(row => row.daysSinceLastSale !== null);

  const cards: ReportStatCard[] = [
    { key: 'count', label: isRTL ? 'أجهزة راكدة' : 'Dead stock units', value: fmtCount(rows.length), icon: Smartphone, tone: 'warning' },
    { key: 'tied', label: isRTL ? 'رأس مال محتجز (تكلفة)' : 'Capital tied up (cost)', value: fmtMoney(tiedUp, isRTL), icon: DollarSign, tone: 'danger' },
    { key: 'never', label: r.neverSold, value: fmtCount(neverSold.length), icon: Archive },
  ];
  // Only meaningful when some row actually carries a day count
  if (aged.length > 0) {
    const oldest = Math.max(...aged.map(row => row.daysSinceLastSale!));
    cards.push({
      key: 'oldest', label: isRTL ? 'أطول فترة بدون بيع' : 'Longest without a sale',
      value: isRTL ? `${fmtCount(oldest)} يوم` : `${fmtCount(oldest)} days`, icon: Clock,
    });
  }

  const columns: PanelColumn<DeadStockDevice>[] = [
    {
      key: 'rank', header: '#', align: 'center',
      cell: (_row, index) => <span className="text-muted-foreground">{index + 1}</span>,
    },
    { key: 'imei', header: 'IMEI', mono: true, cell: row => row.imei },
    {
      key: 'name', header: r.itemName,
      cell: row => <span className="font-medium text-foreground">{row.brand} {row.model}</span>,
    },
    { key: 'cost', header: r.cost, align: 'center', numeric: true, cell: row => fmtMoney(Number(row.cost), isRTL) },
    {
      key: 'days', header: r.daysSinceLastSale, align: 'center',
      cell: row => row.daysSinceLastSale === null
        ? <Badge variant="destructive">{r.neverSold}</Badge>
        : <Badge variant="secondary" className="tabular-nums">
            {fmtCount(row.daysSinceLastSale)} {isRTL ? 'يوم' : 'days'}
          </Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <ReportStats stats={cards} />
      <ReportCard
        title={r.deadStockTitle}
        description={r.deadStockDesc}
        action={
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onExport}>
            <Download className="h-4 w-4" />
            {r.exportCSV}
          </Button>
        }
      >
        <PanelTable columns={columns} rows={rows} rowKey={row => row.id} maxHeight="32rem" />
      </ReportCard>
    </div>
  );
}
