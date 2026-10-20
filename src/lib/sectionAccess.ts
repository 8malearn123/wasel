import type { PermissionKey } from '@/hooks/usePermissions';
import type { FeatureKey } from '@/lib/planAccess';

interface Door {
  permission: PermissionKey;
  /** the plan feature the leaf behind it also needs */
  feature?: FeatureKey;
}

/**
 * What opens each top-level section: any one door is enough, since a section
 * opens on whichever of its leaves the user may see. An empty list is a
 * section everyone signed in may open (support lives in /organization).
 *
 * Mirrors the leaves' own gates, plan features included, so the section this
 * picks really has something to show — otherwise "/" → section → its fallback
 * → "/" would go round for a role whose only screen the plan does not have.
 */
export const SECTION_ACCESS: Record<string, Door[]> = {
  '/': [{ permission: 'dashboard.view' }],
  '/pos': [{ permission: 'pos.access' }],
  '/products': [
    { permission: 'products.view' },
    { permission: 'stocktake.manage', feature: 'stocktake' },
    { permission: 'transfers.manage', feature: 'transfers' },
    { permission: 'suppliers.manage', feature: 'suppliers' },
  ],
  '/sales': [
    { permission: 'online_orders.manage', feature: 'onlineStore' },
    { permission: 'repairs.manage', feature: 'repairs' },
    { permission: 'closings.manage' },
    { permission: 'store.manage', feature: 'onlineStore' },
    { permission: 'customers.manage', feature: 'customers' },
    { permission: 'marketing.manage', feature: 'marketing' },
    { permission: 'wholesale.manage' },
  ],
  '/shipping': [{ permission: 'shipping.manage' }],
  '/reports': [
    { permission: 'reports.view', feature: 'reports' },
    { permission: 'invoices.view', feature: 'reports' },
  ],
  '/team': [
    { permission: 'employees.view' },
    { permission: 'attendance.manage' },
    { permission: 'payroll.manage' },
    { permission: 'users.view' },
  ],
  '/ai-insights': [{ permission: 'ai_insights.view' }],
  '/settings': [{ permission: 'settings.manage' }, { permission: 'policy.manage' }],
  '/organization': [],
};

/** The first section this user may open — where "/" sends someone with no dashboard. */
export function firstOpenSection(
  can: (permission: PermissionKey) => boolean,
  allows: (feature: FeatureKey) => boolean,
): string {
  for (const [path, doors] of Object.entries(SECTION_ACCESS)) {
    if (doors.length === 0) return path;
    if (doors.some(d => can(d.permission) && (!d.feature || allows(d.feature)))) return path;
  }
  return '/organization';
}

/**
 * Whether a section opens for this user: a door whose permission they hold
 * and whose leaf their plan has. Without `allows`, permissions alone.
 */
export function sectionPermitted(
  path: string,
  can: (permission: PermissionKey) => boolean,
  allows?: (feature: FeatureKey) => boolean,
): boolean {
  const doors = SECTION_ACCESS[path];
  if (!doors || doors.length === 0) return true;
  return doors.some(d => can(d.permission) && (!d.feature || !allows || allows(d.feature)));
}
