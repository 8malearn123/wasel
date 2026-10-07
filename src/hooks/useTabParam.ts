import { useSearchParams } from 'react-router-dom';

// Tab state driven by a URL param, so navigation can deep-link into a
// page's sections.
//
// Two levels are in play since the sidebar was consolidated into sections:
//   ?tab=  the section a container page is showing   (owned by the container)
//   ?sub=  the inner tab of that section             (owned by the section)
// A section that is also reachable on its own keeps whichever param its
// container passes it, which is why the name is a parameter and not a literal.
export function useTabParam(defaultTab: string, param = 'tab'): [string, (t: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get(param) || defaultTab;
  const setTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(param, t);
    setSearchParams(next, { replace: true });
  };
  return [tab, setTab];
}
