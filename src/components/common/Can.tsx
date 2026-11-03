import type { ReactNode } from 'react';
import { usePermissions, type PermissionKey } from '@/hooks/usePermissions';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { FeatureKey } from '@/lib/planAccess';

interface CanProps {
  permission?: PermissionKey;
  /** any one of these is enough */
  anyOf?: PermissionKey[];
  feature?: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Shows its children when the member may see them (permission and/or plan
 * feature), otherwise `fallback`. While access is still being read nothing is
 * shown, and nothing beyond the role's base map is shown when it failed to
 * load. Display only — the server is the boundary.
 *
 * The same rules as useAccess().decide(), kept light because it sits on every
 * row of a table: a plan is read only when a feature is asked for.
 *
 *   <Can permission="products.update">…</Can>
 *   <Can feature="wholesale" fallback={<UpgradeHint />}>…</Can>
 */
export function Can({ feature, ...rest }: CanProps) {
  return feature ? <CanWithFeature feature={feature} {...rest} /> : <CanPermission {...rest} />;
}

function permitted(can: (k: PermissionKey) => boolean, canAny: (...k: PermissionKey[]) => boolean, permission?: PermissionKey, anyOf?: PermissionKey[]) {
  return (!permission || can(permission)) && (!anyOf || canAny(...anyOf));
}

function CanPermission({ permission, anyOf, children, fallback = null }: Omit<CanProps, 'feature'>) {
  const { can, canAny, loading } = usePermissions();
  if (loading) return null;
  return <>{permitted(can, canAny, permission, anyOf) ? children : fallback}</>;
}

function CanWithFeature({ feature, permission, anyOf, children, fallback = null }: CanProps & { feature: FeatureKey }) {
  const { can, canAny, loading } = usePermissions();
  const { allows, loading: planLoading } = useFeatureAccess();
  if (loading || planLoading) return null;
  return <>{allows(feature) && permitted(can, canAny, permission, anyOf) ? children : fallback}</>;
}
