import { useSearchParams } from 'react-router-dom';

// Tab state driven by the ?tab= URL param, so the sidebar sub-sections
// can deep-link into a page's sections.
export function useTabParam(defaultTab: string): [string, (t: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || defaultTab;
  const setTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', t);
    setSearchParams(next, { replace: true });
  };
  return [tab, setTab];
}
