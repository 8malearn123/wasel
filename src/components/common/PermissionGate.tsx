import { ReactNode } from 'react';
import { usePermissions, type PermissionKey } from '@/hooks/usePermissions';

interface Props {
  /** Shown only if the user holds this permission */
  require: PermissionKey;
  children: ReactNode;
  /** What to show instead — nothing, by default */
  fallback?: ReactNode;
}

/**
 * Hides a control the user may not use. A convenience, not a lock: the same
 * permission is checked by the RLS policy behind whatever the control does.
 */
export function PermissionGate({ require, children, fallback = null }: Props) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return can(require) ? <>{children}</> : <>{fallback}</>;
}
