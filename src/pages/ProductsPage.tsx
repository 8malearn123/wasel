import { lazy } from 'react';
import { ArrowLeftRight, Barcode, ClipboardCheck, Package, Truck } from 'lucide-react';
import { SectionShell, type SectionGroup } from '@/components/layout/SectionShell';
import { useLanguage } from '@/i18n';

// Each leaf is its own chunk, and only the active one mounts — the stock screen
// alone used to pull its whole query set in on arrival.
const InventorySection = lazy(() => import('@/sections/products/InventorySection'));
const StocktakeSection = lazy(() => import('@/sections/products/StocktakeSection'));
const TransfersSection = lazy(() => import('@/sections/products/TransfersSection'));
const SuppliersSection = lazy(() => import('@/sections/products/SuppliersSection'));
const LabelsSection = lazy(() => import('@/sections/products/LabelsSection'));

/** المنتجات — stock, items, stocktake, transfers, suppliers, purchases, codes. */
export default function ProductsPage() {
  const { t, isRTL } = useLanguage();

  const groups: SectionGroup[] = [
    {
      label: isRTL ? 'المخزون' : 'Stock',
      items: [
        {
          key: 'inventory',
          label: t.inventory.title,
          icon: Package,
          title: t.inventory.title,
          subtitle: t.inventory.subtitle,
          denyRoles: ['cashier'],
          render: () => <InventorySection />,
        },
        {
          key: 'stocktake',
          label: isRTL ? 'الجرد' : 'Stocktake',
          icon: ClipboardCheck,
          title: isRTL ? 'الجرد' : 'Stocktake',
          subtitle: isRTL ? 'جرد المخزون ومطابقة الكميات' : 'Count stock and reconcile quantities',
          feature: 'stocktake',
          denyRoles: ['cashier'],
          render: () => <StocktakeSection />,
        },
        {
          key: 'transfers',
          label: t.transfers.title,
          icon: ArrowLeftRight,
          title: t.transfers.title,
          subtitle: t.transfers.subtitle,
          feature: 'transfers',
          denyRoles: ['cashier'],
          render: () => <TransfersSection />,
        },
      ],
    },
    {
      label: isRTL ? 'الشراء والأدوات' : 'Buying & tools',
      items: [
        {
          key: 'suppliers',
          label: isRTL ? 'الموردين والمشتريات' : 'Suppliers & purchases',
          icon: Truck,
          title: isRTL ? 'الموردين وأوامر الشراء' : 'Suppliers & Purchase Orders',
          subtitle: isRTL ? 'إدارة الموردين والمشتريات والمديونيات' : 'Manage suppliers, purchases & debts',
          feature: 'suppliers',
          denyRoles: ['cashier'],
          render: () => <SuppliersSection />,
        },
        {
          key: 'labels',
          label: t.labels.title,
          icon: Barcode,
          title: t.labels.title,
          subtitle: t.labels.subtitle,
          denyRoles: ['cashier'],
          render: () => <LabelsSection />,
        },
      ],
    },
  ];

  return <SectionShell groups={groups} defaultLeaf="inventory" fallbackPath="/pos" />;
}
