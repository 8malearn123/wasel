import { lazy } from 'react';
import { Calculator, Heart, Megaphone, Search, ShoppingBag, Store, Warehouse, Wrench } from 'lucide-react';
import { SectionShell, type SectionGroup } from '@/components/layout/SectionShell';
import { useLanguage } from '@/i18n';

const OnlineOrdersSection = lazy(() => import('@/sections/sales/OnlineOrdersSection'));
const RepairsSection = lazy(() => import('@/sections/sales/RepairsSection'));
const DailyClosingsSection = lazy(() => import('@/sections/sales/DailyClosingsSection'));
const OnlineStoreSection = lazy(() => import('@/sections/sales/OnlineStoreSection'));
const StoreSeoSection = lazy(() => import('@/sections/sales/StoreSeoSection'));
const CustomersSection = lazy(() => import('@/sections/sales/CustomersSection'));
const MarketingSection = lazy(() => import('@/sections/sales/MarketingSection'));
const WholesaleSection = lazy(() => import('@/sections/sales/WholesaleSection'));

/**
 * الطلبات والمبيعات — the selling cycle end to end.
 *
 * Eight leaves is more than one row of tabs can carry without becoming the
 * wall of links this consolidation set out to remove, so they are captioned
 * groups: what was sold, where it was sold, who bought it, and the trade side.
 */
export default function SalesPage() {
  const { t, isRTL } = useLanguage();

  const groups: SectionGroup[] = [
    {
      label: isRTL ? 'البيع' : 'Selling',
      items: [
        {
          key: 'orders',
          label: isRTL ? 'طلبات المتجر' : 'Online orders',
          icon: ShoppingBag,
          title: isRTL ? 'طلبات المتجر' : 'Online orders',
          subtitle: isRTL ? 'إدارة الطلبات الإلكترونية' : 'Manage online orders',
          feature: 'onlineStore',
          denyRoles: ['cashier'],
          render: () => <OnlineOrdersSection />,
        },
        {
          key: 'repairs',
          label: isRTL ? 'الصيانة' : 'Repairs',
          icon: Wrench,
          title: isRTL ? 'الإصلاحات والصيانة' : 'Repairs & maintenance',
          subtitle: isRTL ? 'إدارة طلبات الإصلاح وتتبع حالتها' : 'Track repair tickets and their state',
          feature: 'repairs',
          render: () => <RepairsSection />,
        },
        {
          key: 'closings',
          label: isRTL ? 'الإغلاق اليومي' : 'Daily closings',
          icon: Calculator,
          title: isRTL ? 'الإغلاق اليومي' : 'Daily Closings',
          subtitle: isRTL ? 'تقرير شامل لمبيعات اليوم وحركة الكاش' : 'Comprehensive daily sales & cash report',
          render: () => <DailyClosingsSection />,
        },
      ],
    },
    {
      label: isRTL ? 'المتجر الإلكتروني' : 'Online store',
      items: [
        {
          key: 'store',
          label: isRTL ? 'إعدادات المتجر' : 'Store settings',
          icon: Store,
          title: isRTL ? 'المتجر الإلكتروني' : 'Online store',
          subtitle: isRTL ? 'إدارة وتخصيص احترافي لمتجرك' : 'Manage and customise your store',
          feature: 'onlineStore',
          denyRoles: ['cashier'],
          render: () => <OnlineStoreSection />,
        },
        {
          key: 'seo',
          label: isRTL ? 'محركات البحث' : 'Search engines',
          icon: Search,
          title: isRTL ? 'محركات البحث' : 'Search engines',
          subtitle: isRTL ? 'ظهور المتجر في نتائج البحث' : 'How the store appears in search results',
          feature: 'onlineStore',
          denyRoles: ['cashier'],
          render: () => <StoreSeoSection />,
        },
      ],
    },
    {
      label: isRTL ? 'العملاء' : 'Customers',
      items: [
        {
          key: 'customers',
          label: isRTL ? 'العملاء والولاء' : 'Customers & loyalty',
          icon: Heart,
          title: isRTL ? 'قاعدة العملاء' : 'Customers',
          feature: 'customers',
          denyRoles: ['cashier'],
          render: () => <CustomersSection />,
        },
        {
          key: 'marketing',
          label: t.marketing.title,
          icon: Megaphone,
          title: t.marketing.title,
          subtitle: t.marketing.subtitle,
          feature: 'marketing',
          denyRoles: ['cashier'],
          render: () => <MarketingSection />,
        },
      ],
    },
    {
      label: isRTL ? 'الجملة' : 'Wholesale',
      items: [
        {
          key: 'wholesale',
          label: isRTL ? 'بيع الجملة' : 'Wholesale',
          icon: Warehouse,
          title: isRTL ? 'بيع الجملة' : 'Wholesale',
          subtitle: isRTL
            ? 'السوق، منتجاتك، الطلبات والمديونيات في صفحة واحدة'
            : 'Marketplace, listings, orders and credits in one place',
          denyRoles: ['cashier'],
          render: () => <WholesaleSection />,
        },
      ],
    },
  ];

  return <SectionShell groups={groups} defaultLeaf="orders" fallbackPath="/pos" />;
}
