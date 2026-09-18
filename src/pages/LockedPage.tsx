import { motion } from 'framer-motion';
import { AlertTriangle, Key, Loader2, LifeBuoy, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { planDisplayName } from '@/hooks/usePlans';

export default function LockedPage() {
  const [code, setCode] = useState('');
  const { activateWithCode, loading, isTrialExpired } = useSubscription();
  const { signOut, merchant, subscription } = useAuth();
  const { isRTL } = useLanguage();

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      await activateWithCode(code.trim());
    }
  };

  const endedAt = subscription?.subscription_ends_at || subscription?.trial_ends_at;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center"
      >
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isTrialExpired
            ? (isRTL ? 'انتهت الفترة التجريبية' : 'Trial period ended')
            : (isRTL ? 'انتهى الاشتراك' : 'Subscription expired')}
        </h1>

        <p className="text-muted-foreground mb-2">
          {isTrialExpired
            ? (isRTL
                ? 'انتهت فترتك التجريبية المجانية. فعّل اشتراكك لمواصلة استخدام النظام — بياناتك محفوظة كما هي.'
                : 'Your free trial has ended. Activate a subscription to carry on — your data is exactly where you left it.')
            : (isRTL
                ? 'انتهى اشتراكك. جدّده لمواصلة استخدام النظام — بياناتك محفوظة كما هي.'
                : 'Your subscription has expired. Renew to carry on — your data is exactly where you left it.')}
        </p>

        {endedAt && (
          <p className="text-xs text-muted-foreground mb-8">
            {isRTL ? 'تاريخ الانتهاء: ' : 'Ended on '}
            {new Date(endedAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB')}
          </p>
        )}

        <div className="bg-card rounded-xl border border-border shadow-lg p-6 mb-4 text-start">
          <h2 className="font-semibold text-foreground mb-4 flex items-center justify-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            {isRTL ? 'أدخل كود التفعيل' : 'Enter an activation code'}
          </h2>

          <form onSubmit={handleActivate} className="space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ACTIVATE-30"
              dir="ltr"
              className="text-center font-mono text-lg"
              disabled={loading}
            />

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={loading || !code.trim()}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                isRTL ? 'تفعيل الاشتراك' : 'Activate subscription'
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            {isRTL
              ? 'اطلب الكود من مسؤول حسابك أو من مندوب المبيعات.'
              : 'Ask your account manager or sales representative for a code.'}
          </p>
        </div>

        <Button asChild variant="outline" className="w-full gap-2 mb-6">
          <Link to="/subscription">
            <LifeBuoy className="w-4 h-4" />
            {isRTL ? 'عرض الباقات والأسعار' : 'See the plans and pricing'}
          </Link>
        </Button>

        <div className="bg-muted/30 rounded-lg p-4 mb-6 text-sm">
          <p className="font-medium text-foreground">{merchant?.name}</p>
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mt-1">
            <span>
              {isRTL ? 'الباقة: ' : 'Plan: '}
              {planDisplayName(subscription?.plan)}
            </span>
            <span className="opacity-40">·</span>
            <span className="font-mono" dir="ltr">
              {merchant?.id?.slice(0, 8)}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={signOut}
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          <LogOut className="w-4 h-4" />
          {isRTL ? 'تسجيل الخروج' : 'Sign out'}
        </Button>
      </motion.div>
    </div>
  );
}
