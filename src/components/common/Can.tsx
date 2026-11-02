import type { ReactNode } from 'react';
import { useAccess, type AccessRequirement } from '@/hooks/useAccess';

/**
 * Shows its children when the member may see them (permission and/or plan
 * feature), otherwise `fallback`. While access is still being read nothing is
 * shown. Display only — the server is the boundary.
 *
 *   <Can permission="invoices.view"><DeleteInvoiceButton /></Can>
 *   <Can feature="wholesale" fallback={<UpgradeHint />}>…</Can>
 */
export function Can({ children, fallback = null, ...req }: AccessRequirement & { children: ReactNode; fallback?: ReactNode }) {
  const { decide } = useAccess();
  return <>{decide(req).allowed ? children : fallback}</>;
}
