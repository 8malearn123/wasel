import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DeniedRedirect } from '@/components/common/DeniedRedirect';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';

/**
 * The one gate in front of every /admin page.
 *
 * A platform administrator is not a shop owner: the check is the
 * platform_admins row, never the shop role. Each page used to decide alone,
 * sending everyone it did not recognise to /auth without a word — a shop owner
 * who typed /admin, a signed-out visitor, and an admin whose check had merely
 * failed all landed on the shop login.
 *
 *   signed out   → the platform login
 *   shop account → their shop, with a message saying why
 *   check failed → say so, with a retry; never treated as «not an admin»
 *
 * The data behind these pages is still guarded by RLS; this decides the screen.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { status, retryCheck } = usePlatformAdmin();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label="جارٍ التحقق">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (status === 'signed_out') return <Navigate to="/admin/login" replace />;
  if (status === 'not_admin') return <DeniedRedirect to="/" reason="platform" />;
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 text-center space-y-4">
          <p className="font-semibold text-foreground">تعذّر التحقق من صلاحية مدير المنصة</p>
          <p className="text-sm text-muted-foreground">تحقّق من الاتصال بالإنترنت ثم أعد المحاولة.</p>
          <Button onClick={retryCheck}>إعادة المحاولة</Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
