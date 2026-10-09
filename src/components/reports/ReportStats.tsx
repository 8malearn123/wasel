import { motion } from 'framer-motion';
import type { ElementType } from 'react';
import { cn } from '@/lib/utils';
import type { ReportStat } from '@/lib/reportEngine';

const TONE: Record<string, string> = {
  default: 'text-foreground',
  positive: 'text-primary',
  warning: 'text-warning',
  danger: 'text-destructive',
};

export interface ReportStatCard extends ReportStat {
  icon?: ElementType;
}

/**
 * The figures above a report.
 *
 * Deliberately smaller than the dashboard cards it replaces: on a report the
 * table is the answer and these are context, so they take one row rather than
 * the top third of the screen. A report that cannot compute a figure returns
 * no card for it — an unavailable number is not a zero.
 */
export function ReportStats({ stats, className }: { stats: ReportStatCard[]; className?: string }) {
  if (stats.length === 0) return null;

  return (
    <div
      className={cn(
        'grid gap-2 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: i * 0.03 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3"
          >
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{stat.label}</p>
              <p className={cn('truncate text-lg font-bold tabular-nums', TONE[stat.tone ?? 'default'])}>
                {stat.value}
              </p>
              {stat.hint && <p className="truncate text-[11px] text-muted-foreground">{stat.hint}</p>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
