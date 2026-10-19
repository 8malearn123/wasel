import { lazy } from 'react';
import { Building2, LifeBuoy } from 'lucide-react';
import { SectionShell, type SectionGroup } from '@/components/layout/SectionShell';
import { useLanguage } from '@/i18n';

const BranchesSection = lazy(() => import('@/sections/settings/BranchesSection'));
const SupportSection = lazy(() => import('@/sections/settings/SupportSection'));

/**
 * المنشأة والدعم — the shop's branches and its line to support.
 *
 * Split out of الإعدادات so that one is about how the system behaves and this
 * one about the business itself. The leaves and their role gates are the
 * ones they had there; a cashier still reaches support here.
 */
export default function OrganizationPage() {
  const { t, isRTL } = useLanguage();

  const groups: SectionGroup[] = [
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
          permission: 'branches.manage',
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

  return <SectionShell groups={groups} defaultLeaf="branches" fallbackPath="/" />;
}
