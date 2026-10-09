import { DollarSign, Download, Package, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Accessory } from '@/types/database';
import { useLanguage } from '@/i18n';
import { fmtCount, fmtMoney, fmtNumber } from '@/lib/reportFormat';
import { ReportStats, type ReportStatCard } from '../ReportStats';
import { ReportCard, PanelEmpty } from '../ReportShell';
import { PanelTable, type PanelColumn } from './PanelTable';

interface Props {
  inventory: {
    totalDevices: number; availableDevices: number; deviceValue: number;
    totalAccessories: number; lowStockAccessories: number; accessoryValue: number;
  };
  lowStock: Accessory[];
  onExport: () => void;
}

export function InventoryDashboard({ inventory, lowStock, onExport }: Props) {
  const { t, isRTL } = useLanguage();
  const r = t.reports;

  const cards: ReportStatCard[] = [
    {
      key: 'devices', label: r.totalDevices, value: fmtCount(inventory.totalDevices),
      hint: `${fmtCount(inventory.availableDevices)} ${r.available}`, icon: Smartphone,
    },
    {
      key: 'deviceValue', label: r.deviceValue, value: fmtMoney(inventory.deviceValue, isRTL),
      hint: isRTL ? 'بالتكلفة' : 'at cost', icon: DollarSign,
    },
    {
      key: 'accessories', label: r.totalAccessories, value: fmtCount(inventory.totalAccessories),
      hint: `${fmtCount(inventory.lowStockAccessories)} ${r.lowStock}`, icon: Package,
      tone: inventory.lowStockAccessories > 0 ? 'warning' : 'default',
    },
    {
      key: 'accessoryValue', label: r.accessoryValue, value: fmtMoney(inventory.accessoryValue, isRTL),
      hint: isRTL ? 'بالتكلفة' : 'at cost', icon: DollarSign,
    },
  ];

  const columns: PanelColumn<Accessory>[] = [
    { key: 'name', header: r.itemName, cell: row => <span className="font-medium text-foreground">{row.name}</span> },
    { key: 'sku', header: 'SKU', mono: true, cell: row => row.sku },
    {
      key: 'quantity', header: r.currentStock, align: 'center', numeric: true,
      cell: row => <span className="font-semibold text-foreground">{fmtNumber(Number(row.quantity))}</span>,
    },
    {
      key: 'min', header: r.minStock, align: 'center', numeric: true,
      cell: row => <span className="text-muted-foreground">{fmtNumber(Number(row.min_quantity ?? 0))}</span>,
    },
    {
      key: 'status', header: r.stockStatus, align: 'center',
      cell: row => Number(row.quantity) === 0
        ? <Badge variant="destructive">{r.outOfStock}</Badge>
        : <Badge variant="secondary">{r.lowStock}</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <ReportStats stats={cards} />

      <ReportCard
        title={r.lowStockItems}
        description={isRTL ? 'إكسسوارات بلغت حد التنبيه أو أقل' : 'Accessories at or below their alert level'}
        action={
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onExport}>
            <Download className="h-4 w-4" />
            {r.exportCSV}
          </Button>
        }
      >
        {lowStock.length === 0 ? (
          <PanelEmpty
            icon={Package}
            text={isRTL ? 'لا يوجد إكسسوار تحت حد التنبيه' : 'Nothing is below its alert level'}
          />
        ) : (
          <PanelTable columns={columns} rows={lowStock} rowKey={row => row.id} />
        )}
      </ReportCard>
    </div>
  );
}
