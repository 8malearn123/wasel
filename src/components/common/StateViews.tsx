import { ReactNode } from 'react';
import {
  AlertTriangle, Inbox, Loader2, Lock, PlugZap, RefreshCw, FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';

/**
 * The six states every screen in this batch has to handle, in one place so they
 * look the same everywhere and nobody reinvents an empty state.
 */

export function LoadingState({ className, label }: { className?: string; label?: string }) {
  const { isRTL } = useLanguage();
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 gap-3', className)}>
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        {label || (isRTL ? 'جارٍ التحميل…' : 'Loading…')}
      </p>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox, title, description, action, className,
}: {
  icon?: typeof Inbox;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-card rounded-xl border border-border p-12 text-center', className)}>
      <Icon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-muted-foreground max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message, onRetry, className,
}: { message: string; onRetry?: () => void; className?: string }) {
  const { isRTL } = useLanguage();
  return (
    <div className={cn('bg-card rounded-xl border border-destructive/30 p-10 text-center', className)}>
      <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
      <h3 className="font-semibold text-foreground mb-1">
        {isRTL ? 'تعذّر تحميل البيانات' : 'Could not load this'}
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4 gap-2" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" />
          {isRTL ? 'إعادة المحاولة' : 'Try again'}
        </Button>
      )}
    </div>
  );
}

export function PermissionDeniedState({
  permission, className,
}: { permission?: string; className?: string }) {
  const { isRTL } = useLanguage();
  return (
    <div className={cn('bg-card rounded-xl border border-border p-12 text-center', className)}>
      <Lock className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
      <h3 className="font-semibold text-foreground mb-1">
        {isRTL ? 'لا تملك صلاحية عرض هذه الصفحة' : 'You do not have permission for this page'}
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        {isRTL
          ? 'اطلب من صاحب المتجر منحك الصلاحية المناسبة.'
          : 'Ask the shop owner to grant you the right permission.'}
      </p>
      {permission && (
        <code className="inline-block mt-3 text-xs bg-muted px-2 py-1 rounded font-mono" dir="ltr">
          {permission}
        </code>
      )}
    </div>
  );
}

/** For a device or a carrier the backend cannot reach. */
export function UnavailableState({
  title, message, className,
}: { title?: string; message: string; className?: string }) {
  const { isRTL } = useLanguage();
  return (
    <div className={cn('bg-card rounded-xl border border-warning/30 p-10 text-center', className)}>
      <PlugZap className="w-10 h-10 mx-auto text-warning mb-3" />
      <h3 className="font-semibold text-foreground mb-1">
        {title || (isRTL ? 'الخدمة غير متاحة بعد' : 'Not available yet')}
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto">{message}</p>
    </div>
  );
}

/**
 * Shown on every screen reading a mocked service, so placeholder data is never
 * mistaken for the merchant's own.
 */
export function MockDataBanner({ what }: { what?: string }) {
  const { isRTL } = useLanguage();
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-warning/40 bg-warning/5 mb-4 text-sm">
      <FlaskConical className="w-4 h-4 text-warning shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-foreground">
          {isRTL ? 'بيانات تجريبية' : 'Placeholder data'}
        </p>
        <p className="text-muted-foreground">
          {isRTL
            ? `هذه الواجهة جاهزة، لكن ${what || 'الخدمة'} لم تُربط بالخادم بعد. ما تراه بيانات عرض فقط وليست بيانات متجرك.`
            : `This screen is ready, but ${what || 'the service'} is not connected to the backend yet. What you see is placeholder data, not your shop's.`}
        </p>
      </div>
    </div>
  );
}
