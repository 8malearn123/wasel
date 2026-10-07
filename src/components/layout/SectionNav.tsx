import type { ElementType } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';

export interface SectionNavItem {
  key: string;
  /** already in the active language — the container resolves it from `t` */
  label: string;
  icon: ElementType;
}

export interface SectionNavGroup {
  /** optional caption above the group, for a section with many leaves */
  label?: string;
  items: SectionNavItem[];
}

/**
 * The sub-navigation of a consolidated section page.
 *
 * It is deliberately not a TabsList: a section such as "الطلبات والمبيعات"
 * holds eight leaves, and a flat row of eight triggers is the crowding this
 * consolidation was meant to remove. Captioned groups give the same leaves a
 * shape the eye can scan, while the active leaf still lives in one URL param.
 */
export function SectionNav({
  groups,
  value,
  onChange,
}: {
  groups: SectionNavGroup[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { isRTL } = useLanguage();
  const captioned = groups.some(g => g.label);

  return (
    <nav
      aria-label={isRTL ? 'أقسام الصفحة' : 'Page sections'}
      className="mb-6 flex flex-wrap items-stretch gap-x-5 gap-y-3 rounded-xl border border-border bg-card/60 p-2.5"
    >
      {groups.map((group, gi) => (
        <div
          key={group.label || gi}
          className={cn(
            'flex flex-col gap-1.5',
            // a divider between groups, on the side the language reads from
            gi > 0 && (isRTL ? 'border-e border-border/70 pe-5' : 'border-s border-border/70 ps-5'),
          )}
        >
          {captioned && (
            <span className="px-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70">
              {group.label || ' '}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-1">
            {group.items.map(item => {
              const Icon = item.icon;
              const active = value === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChange(item.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
