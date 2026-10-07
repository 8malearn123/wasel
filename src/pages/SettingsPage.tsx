import { lazy } from 'react';
import { Bell, Building2, FileText, LifeBuoy, SlidersHorizontal } from 'lucide-react';
import { SectionShell, type SectionGroup } from '@/components/layout/SectionShell';
import { useLanguage } from '@/i18n';

const GeneralSettingsSection = lazy(() => import('@/sections/settings/GeneralSettingsSection'));
const NotificationsSection = lazy(() => import('@/sections/settings/NotificationsSection'));
const BusinessPolicySection = lazy(() => import('@/sections/settings/BusinessPolicySection'));
const BranchesSection = lazy(() => import('@/sections/settings/BranchesSection'));
const SupportSection = lazy(() => import('@/sections/settings/SupportSection'));

/** الإعدادات — the one place the system is configured from. */
export default function SettingsPage() {
  const { t, isRTL } = useLanguage();

  const groups: SectionGroup[] = [
    {
      label: isRTL ? 'النظام' : 'System',
      items: [
        {
          key: 'general',
          label: isRTL ? 'عام' : 'General',
          icon: SlidersHorizontal,
          title: isRTL ? 'الإعدادات' : 'Settings',
          subtitle: isRTL ? 'تكوين النظام والتفضيلات' : 'System configuration & preferences',
          denyRoles: ['cashier'],
          render: () => <GeneralSettingsSection />,
        },
        {
          key: 'notifications',
          label: t.notifications.title,
          icon: Bell,
          title: t.notifications.title,
          subtitle: t.notifications.subtitle,
          denyRoles: ['cashier'],
          render: () => <NotificationsSection />,
        },
        {
          key: 'policy',
          label: isRTL ? 'سياسة العمل' : 'Business policy',
          icon: FileText,
          title: isRTL ? 'سياسة العمل' : 'Business policy',
          subtitle: isRTL ? 'التعديلات وخدمات التسويق' : 'Modifications and marketing services',
          denyRoles: ['cashier', 'branch_manager', 'inventory_manager'],
          render: () => <BusinessPolicySection />,
        },
      ],
    },
    {
      label: isRTL ? 'المنشأة والدعم' : 'Business & help',
      items: [
        {
          key: 'branches',
          label: t.branches.title,
          icon: Building2,
          title: t.branches.title,
          subtitle: t.branches.subtitle,
          denyRoles: ['cashier'],
          render: () => <BranchesSection />,
        },
        {
          key: 'support',
          label: isRTL ? 'الدعم الفني' : 'Support',
          icon: LifeBuoy,
          title: isRTL ? 'الدعم الفني' : 'Support',
          subtitle: isRTL ? 'إرسال ومتابعة طلبات الدعم' : 'Raise and follow support tickets',
          render: () => <SupportSection />,
        },
      ],
    },
  ];

  return (
    <SectionShell
      groups={groups}
      defaultLeaf="general"
      fallbackPath="/"
      // /settings kept its path, so links to its old inner tabs still arrive
      // on ?tab= and are moved to the general leaf's ?sub=.
      legacyTabs={{
        business: { leaf: 'general', sub: 'business' },
        'tax-invoice': { leaf: 'general', sub: 'tax-invoice' },
        printer: { leaf: 'general', sub: 'printer' },
        subscription: { leaf: 'general', sub: 'subscription' },
        api: { leaf: 'general', sub: 'api' },
      }}
    />
  );
}
