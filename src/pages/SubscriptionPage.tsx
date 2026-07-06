import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, Crown, Zap, Loader2, AlertTriangle,
  Wrench, ShoppingBag
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { usePlans, planDisplayName, Plan } from '@/hooks/usePlans';
import { useBranches } from '@/hooks/useBranches';
import { useBranchRequests } from '@/hooks/useBranchRequests';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Marketing copy for each plan, keyed by the plan's English name in the DB
const PLAN_CONTENT: Record<string, { tagline: string; maintenance: string[]; purchase: string[] }> = {
  Basic: {
    tagline: 'مخصصة للعملاء الذين يحتاجون صيانة فورية أو يرغبون في شراء جهاز للاستخدام الشخصي البسيط وبأقل تكلفة.',
    maintenance: [
      'فحص فني مجاني لمرة واحدة (عن بعد أو في المركز)',
      'خصم 5% على تكلفة العمالة (أجور اليد) للصيانة',
      'ضمان أساسي لمدة 30 يوماً على القطع المستبدلة',
    ],
    purchase: [
      'إمكانية الشراء من الموقع بالأسعار الرسمية المعتادة',
      'شحن قياسي (غير مستعجل)',
    ],
  },
  Professional: {
    tagline: 'الباقة الأكثر توازناً، لمن يملكون أجهزة متعددة ويبحثون عن راحة البال وحماية أجهزتهم على المدى الطويل.',
    maintenance: [
      'فحص دوري مجاني (ربع سنوي) لجهاز واحد',
      'خصم 15% على جميع عمليات الصيانة وأجور اليد',
      'أولوية في طابور الصيانة (تسليم أسرع)',
      'ضمان ممتد إلى 90 يوماً على قطع الغيار',
    ],
    purchase: [
      'خصم 5% على الإكسسوارات وملحقات الأجهزة',
      'شحن سريع مجاني لجميع الطلبات',
    ],
  },
  Enterprise: {
    tagline: 'موجهة لأصحاب الشركات الصغيرة والمكاتب والمحترفين الذين لا يمكنهم الاستغناء عن أجهزتهم، ويبحثون عن خدمات VIP.',
    maintenance: [
      'صيانة فورية شاملة (أولوية قصوى VIP) مع جهاز بديل مؤقت',
      'خصم 25% على قطع الغيار وأجور الصيانة',
      'استلام وتوصيل الجهاز من وإلى باب البيت مجاناً',
      'دعم فني مخصص ومباشر على مدار الساعة 24/7',
    ],
    purchase: [
      'خصومات حصرية على الأجهزة المجددة أو الجديدة',
      'حجز مسبق للأجهزة الحديثة قبل طرحها للعامة',
    ],
  },
  Distributor: {
    tagline: 'مخصصة للتجار وأصحاب محلات الصيانة والموزعين الذين يشترون بكميات ويسندون الصيانة المعقدة لمركزك.',
    maintenance: [
      'قطع غيار أصلية بأسعار الجملة',
      'صيانة تجارية بأسعار خاصة جداً بالموزعين',
      'ضمان ممتد ومرن على كميات القطع المشتراة',
    ],
    purchase: [
      'أسعار خاصة وتنافسية عند الشراء بالكميات',
      'إمكانية الدفع الآجل أو بنظام الائتمان',
      'لوحة تحكم مخصصة للموزع للطلبات والفواتير والصيانة',
      'مدير حساب مخصص لتخليص المعاملات الكبيرة بسرعة',
    ],
  },
};

export default function SubscriptionPage() {
  const { merchant, subscription, branches } = useAuth();
  const { daysRemaining, isTrialExpired, isSubscriptionExpired } = useSubscription();
  const { plans, loading: plansLoading } = usePlans();
  const { branches: allBranches } = useBranches();
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const activeBranches = allBranches.filter(b => b.is_active);
  const currentPlanId = subscription?.plan_id;

  const handleUpgradeRequest = async (plan: Plan) => {
    if (!merchant) return;
    setUpgrading(plan.id);

    // Log upgrade request in activity_logs
    await supabase.from('activity_logs').insert({
      merchant_id: merchant.id,
      action: 'upgrade_requested',
      entity_type: 'subscription',
      new_data: { plan_name: plan.name_ar, plan_id: plan.id },
    });

    toast.success('تم إرسال طلب الترقية بنجاح. سيتم التواصل معك قريباً.');
    setUpgrading(null);
  };

  return (
    <AppLayout title="الباقات والاشتراك" subtitle="إدارة باقتك واشتراكك">
      {/* Current Subscription Status */}
      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">باقتك الحالية</h3>
              <p className="text-sm text-muted-foreground">{planDisplayName(subscription?.plan)}</p>
            </div>
            <div className="mr-auto">
              <span className={cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                subscription?.status === 'active' ? 'bg-success/15 text-success' :
                subscription?.status === 'trial' ? 'bg-warning/15 text-warning' :
                'bg-destructive/15 text-destructive'
              )}>
                {subscription?.status === 'active' ? 'نشط' :
                 subscription?.status === 'trial' ? 'تجريبي' :
                 subscription?.status === 'expired' ? 'منتهي' : 'موقوف'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold text-foreground">{daysRemaining}</p>
              <p className="text-xs text-muted-foreground">يوم متبقي</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold text-foreground">
                {activeBranches.length}
                <span className="text-sm text-muted-foreground">/{subscription?.max_branches || 1}</span>
              </p>
              <p className="text-xs text-muted-foreground">الفروع</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold text-foreground">
                —
                <span className="text-sm text-muted-foreground">/{subscription?.max_users || 3}</span>
              </p>
              <p className="text-xs text-muted-foreground">المستخدمين</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-sm font-medium text-foreground">
                {subscription?.subscription_ends_at
                  ? new Date(subscription.subscription_ends_at).toLocaleDateString('ar-SA')
                  : subscription?.trial_ends_at
                    ? new Date(subscription.trial_ends_at).toLocaleDateString('ar-SA')
                    : '—'}
              </p>
              <p className="text-xs text-muted-foreground">تاريخ الانتهاء</p>
            </div>
          </div>
        </motion.div>

        {/* Warning card */}
        {(isTrialExpired || isSubscriptionExpired || (subscription?.status === 'trial' && daysRemaining <= 5)) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-warning/5 rounded-xl border border-warning/20 p-6 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-10 h-10 text-warning mb-3" />
            <h3 className="font-bold text-foreground mb-1">
              {isTrialExpired ? 'انتهت الفترة التجريبية' : isSubscriptionExpired ? 'انتهى الاشتراك' : 'الاشتراك ينتهي قريباً'}
            </h3>
            <p className="text-sm text-muted-foreground">
              قم بترقية باقتك للاستمرار في استخدام النظام
            </p>
          </motion.div>
        )}
      </div>

      {/* Plans Comparison */}
      <h2 className="text-xl font-bold text-foreground mb-4">مقارنة الباقات</h2>

      {plansLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, index) => {
            const isCurrent = currentPlanId === plan.id || (plan.sort_order === 1 && !currentPlanId);
            return (
              <motion.div key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'rounded-xl border-2 p-6 relative',
                  plan.sort_order === 2 ? 'border-primary shadow-glow bg-card' : 'border-border bg-card',
                  isCurrent && 'ring-2 ring-primary/30'
                )}>
                {plan.sort_order === 2 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium">
                    الأكثر طلباً
                  </div>
                )}
                {isCurrent && (
                  <Badge className="absolute top-3 left-3 bg-success/15 text-success border-success/20">
                    باقتك الحالية
                  </Badge>
                )}

                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-foreground">{plan.name_ar}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground"> ر.س/شهر</span>
                  </div>
                </div>

                {(() => {
                  const content = PLAN_CONTENT[plan.name];
                  if (!content) return null;
                  return (
                    <div className="mb-6 space-y-4">
                      <p className="text-xs text-muted-foreground leading-relaxed text-center">
                        {content.tagline}
                      </p>

                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                          <Wrench className="w-4 h-4 text-primary" /> الصيانة
                        </p>
                        <ul className="space-y-1.5">
                          {content.maintenance.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                          <ShoppingBag className="w-4 h-4 text-primary" /> الشراء
                        </p>
                        <ul className="space-y-1.5">
                          {content.purchase.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })()}

                {isCurrent ? (
                  <Button className="w-full" disabled variant="outline">
                    باقتك الحالية
                  </Button>
                ) : (
                  <Button
                    className={cn('w-full', plan.sort_order === 2 ? 'bg-gradient-primary hover:opacity-90' : '')}
                    onClick={() => handleUpgradeRequest(plan)}
                    disabled={upgrading === plan.id}
                  >
                    {upgrading === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 ml-1" />
                        طلب ترقية
                      </>
                    )}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
