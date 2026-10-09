import type { ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';

/**
 * The load / fail / show states a dashboard panel goes through.
 *
 * Every panel used to inline the same spinner and show nothing at all on a
 * failure, so a report whose fetch had failed looked identical to a shop with
 * no sales. Here a failure says so and offers the retry.
 */
export function ReportPanel({
  loading, error, onRetry, children,
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const { isRTL } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">{isRTL ? 'جارٍ التحميل' : 'Loading'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
        <TriangleAlert className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-medium text-foreground">
            {isRTL ? 'تعذّر تحميل التقرير' : 'The report could not be loaded'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            {isRTL ? 'إعادة المحاولة' : 'Try again'}
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

/** A titled card, the one container every chart and panel table sits in */
export function ReportCard({
  title, description, action, children, className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-card ${className ?? ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground">{title}</h3>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** An empty panel, said the same way everywhere */
export function PanelEmpty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
