import { lazy } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Bell, FileText, SlidersHorizontal } from 'lucide-react';
import { SectionShell, type SectionGroup } from '@/components/layout/SectionShell';
import { useLanguage } from '@/i18n';

const GeneralSettingsSection = lazy(() => import('@/sections/settings/GeneralSettingsSection'));
const NotificationsSection = lazy(() => import('@/sections/settings/NotificationsSection'));
const BusinessPolicySection = lazy(() => import('@/sections/settings/BusinessPolicySection'));

// Leaves that moved to المنشأة والدعم; a bookmark to them here is forwarded
const MOVED_TO_ORGANIZATION = new Set(['branches', 'support']);

/** الإعدادات — how the system behaves. Branches and support are in المنشأة والدعم. */
export default function SettingsPage() {
  const { t, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();

  const tab = searchParams.get('tab');
  if (tab && MOVED_TO_ORGANIZATION.has(tab)) {
    return <Navigate to={`/organization?${searchParams.toString()}`} replace />;
  }

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
