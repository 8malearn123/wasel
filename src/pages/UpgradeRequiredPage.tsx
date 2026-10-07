import { Link } from 'react-router-dom';
import { Crown, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';

interface Props {
  /** What the merchant was trying to reach */
  featureName?: string;
  /** The plan that includes it */
  planName?: string;
}

/**
 * Shown when a merchant opens a page their plan does not include.
 *
 * It is a signpost, not a lock: the server refuses the action regardless of
 * what the browser displays.
 */
export default function UpgradeRequiredPage({ featureName, planName = 'MAX' }: Props) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <AppLayout title={featureName || (t ? 'ميزة غير متاحة في باقتك' : 'Not in your plan')}>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto text-center py-12"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Crown className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t ? `هذه الميزة متاحة في باقة ${planName}` : `This feature is in the ${planName} plan`}
        </h1>

        <p className="text-muted-foreground mb-6">
          {featureName
            ? (t
                ? `«${featureName}» غير مشمولة في باقتك الحالية. ترقّى إلى ${planName} لتفعيلها.`
                : `“${featureName}” is not part of your current plan. Upgrade to ${planName} to switch it on.`)
            : (t
                ? `ترقّى إلى باقة ${planName} لتفعيل هذه الميزة.`
                : `Upgrade to ${planName} to switch this feature on.`)}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild className="gap-2">
            <Link to="/subscription">
              {t ? 'ترقية الباقة' : 'Upgrade plan'}
              <Arrow className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">{t ? 'العودة للوحة التحكم' : 'Back to the dashboard'}</Link>
          </Button>
        </div>
      </motion.div>
    </AppLayout>
  );
}
