import { ReactNode } from 'react';
import type { PermissionKey } from '@/hooks/usePermissions';
import { Can } from './Can';

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
 * Decided by the one access layer (useAccess) — nothing while it loads,
 * nothing beyond the role's base map when it fails.
 */
export function PermissionGate({ require, children, fallback = null }: Props) {
  return <Can permission={require} fallback={fallback}>{children}</Can>;
}
