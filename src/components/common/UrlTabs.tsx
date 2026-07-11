import { ComponentProps } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { useTabParam } from '@/hooks/useTabParam';

// Tabs controlled by the ?tab= URL param so sidebar sub-sections can drive them
export function UrlTabs({ defaultTab, ...props }: Omit<ComponentProps<typeof Tabs>, 'value' | 'onValueChange' | 'defaultValue'> & { defaultTab: string }) {
  const [tab, setTab] = useTabParam(defaultTab);
  return <Tabs {...props} value={tab} onValueChange={setTab} />;
}
