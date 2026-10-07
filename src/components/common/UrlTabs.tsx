import { ComponentProps } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { useTabParam } from '@/hooks/useTabParam';

// Tabs controlled by a URL param so navigation can drive them.
// `param` is 'sub' for a section nested inside a container page, whose own
// ?tab= already names the section — see useTabParam.
export function UrlTabs(
  { defaultTab, param, ...props }: Omit<ComponentProps<typeof Tabs>, 'value' | 'onValueChange' | 'defaultValue'>
    & { defaultTab: string; param?: string },
) {
  const [tab, setTab] = useTabParam(defaultTab, param);
  return <Tabs {...props} value={tab} onValueChange={setTab} />;
}
