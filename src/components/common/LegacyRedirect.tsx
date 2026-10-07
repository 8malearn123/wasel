import { Navigate, useLocation } from 'react-router-dom';

/**
 * A path from before the sidebar was consolidated into nine sections.
 *
 * Every old path keeps working, and keeps its query string: the stock screen is
 * reached from global search as /inventory?tab=devices&q=…&open=…, so dropping
 * the search params here would quietly break opening a result.
 *
 * The page's own inner tab moves from ?tab= to ?sub=, which the section now
 * reads, while ?tab= names the section itself. `sub` forces that inner tab for
 * a path that was only ever one tab of a page — /purchases was the orders tab
 * of the suppliers screen.
 */
export function LegacyRedirect({ to, tab, sub }: { to: string; tab: string; sub?: string }) {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  const inner = sub ?? params.get('tab') ?? undefined;
  params.set('tab', tab);
  if (inner) params.set('sub', inner);
  const query = params.toString();
  return <Navigate to={`${to}${query ? `?${query}` : ''}${hash}`} replace />;
}
