import { lazy } from 'react';
import { Briefcase, Fingerprint, HardDrive, ShieldCheck, Users } from 'lucide-react';
import { SectionShell, type SectionGroup } from '@/components/layout/SectionShell';
import { useLanguage } from '@/i18n';

const EmployeesSection = lazy(() => import('@/sections/team/EmployeesSection'));
const AttendanceSection = lazy(() => import('@/sections/team/AttendanceSection'));
const DevicesSection = lazy(() => import('@/sections/team/DevicesSection'));
const HRSection = lazy(() => import('@/sections/team/HRSection'));
const UsersSection = lazy(() => import('@/sections/team/UsersSection'));

/** الموارد البشرية — staff, attendance, the fingerprint readers, payroll, access. */
export default function TeamPage() {
  const { t, isRTL } = useLanguage();

  const groups: SectionGroup[] = [
    {
      label: isRTL ? 'الموظفون' : 'Staff',
      items: [
        {
          key: 'employees',
          label: isRTL ? 'الموظفون' : 'Employees',
          icon: Users,
          title: isRTL ? 'الموظفون' : 'Employees',
          subtitle: isRTL
            ? 'سجل موظفي المتجر وربطهم بحسابات الدخول'
            : 'Staff records, and the accounts they sign in with',
          permission: 'employees.view',
          denyRoles: ['cashier'],
          render: () => <EmployeesSection />,
        },
        {
          key: 'attendance',
          label: isRTL ? 'الحضور والانصراف' : 'Attendance',
          icon: Fingerprint,
          title: isRTL ? 'الحضور والانصراف' : 'Attendance',
          subtitle: isRTL ? 'حضور الموظفين وسجلّه' : 'Employee attendance and its record',
          denyRoles: ['cashier'],
          render: () => <AttendanceSection />,
        },
        {
          key: 'devices',
          label: isRTL ? 'أجهزة البصمة' : 'Fingerprint devices',
          icon: HardDrive,
          title: isRTL ? 'الأجهزة المتصلة' : 'Connected devices',
          subtitle: isRTL
            ? 'الأجهزة المرتبطة بالنظام وحالتها'
            : 'Devices linked to the system, and their state',
          denyRoles: ['cashier'],
          render: () => <DevicesSection />,
        },
        {
          key: 'payroll',
          label: isRTL ? 'الرواتب' : 'Payroll',
          icon: Briefcase,
          title: isRTL ? 'الموارد البشرية' : 'Human Resources',
          subtitle: isRTL
            ? 'معلومات الموظفين والرواتب والأداء'
            : 'Employee info, salaries and performance',
          denyRoles: ['cashier', 'branch_manager', 'inventory_manager'],
          render: () => <HRSection />,
        },
      ],
    },
    {
      label: isRTL ? 'الوصول' : 'Access',
      items: [
        {
          key: 'users',
          label: isRTL ? 'المستخدمين والصلاحيات' : 'Users & permissions',
          icon: ShieldCheck,
          title: t.users.title,
          subtitle: t.users.subtitle,
          denyRoles: ['cashier', 'branch_manager', 'inventory_manager'],
          render: () => <UsersSection />,
        },
      ],
    },
  ];

  return <SectionShell groups={groups} defaultLeaf="employees" fallbackPath="/" />;
}
