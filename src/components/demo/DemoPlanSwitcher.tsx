import { useState } from 'react';
import { Zap, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const PLANS = [
  { name: 'Basic', name_ar: 'الباقة الفضية', price: '99' },
  { name: 'Professional', name_ar: 'الباقة الذهبية', price: '199' },
  { name: 'Enterprise', name_ar: 'الباقة البلاتينية', price: '399' },
  { name: 'Distributor', name_ar: 'باقة الموزع', price: '499' },
];

export default function DemoPlanSwitcher() {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const { subscription, refreshMerchantData } = useAuth();
  const queryClient = useQueryClient();

  const currentPlan = subscription?.plan || 'trial';

  const handleSwitch = async (planName: string) => {
    if (!subscription) {
      toast.error('لا يوجد اشتراك');
      return;
    }
    setSwitching(planName);

    try {
      const { error } = await (supabase as any).rpc('demo_switch_plan', { _plan_name: planName });

      if (error) {
        console.error('Subscription update error:', error);
        toast.error('فشل تبديل الباقة: ' + error.message);
        setSwitching(null);
        return;
      }

      toast.success(`تم التبديل إلى ${PLANS.find(p => p.name === planName)?.name_ar}`);
      // Refresh subscription and all cached data without a full page reload
      await refreshMerchantData();
      await queryClient.invalidateQueries();
    } catch (err) {
      console.error('Switch error:', err);
      toast.error('فشل تبديل الباقة');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50" dir="rtl">
      <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-4 py-2.5 w-full hover:bg-muted/50 transition-colors"
        >
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">ديمو: تبديل الباقة</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium mr-1">
            {currentPlan}
          </span>
          {open ? <ChevronDown className="w-3 h-3 text-muted-foreground mr-auto" /> : <ChevronUp className="w-3 h-3 text-muted-foreground mr-auto" />}
        </button>

        {open && (
          <div className="border-t border-border p-2 grid grid-cols-2 gap-1.5">
            {PLANS.map((plan) => {
              const isActive = currentPlan === plan.name;
              return (
                <button
                  key={plan.name}
                  onClick={() => !isActive && handleSwitch(plan.name)}
                  disabled={isActive || switching !== null}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs transition-all ${
                    isActive
                      ? 'ring-2 ring-primary bg-primary/5'
                      : 'hover:bg-muted/70 opacity-80 hover:opacity-100'
                  } ${switching === plan.name ? 'animate-pulse' : ''}`}
                >
                  {switching === plan.name ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">{plan.name_ar}</span>
                      <span className="text-[10px] text-muted-foreground">{plan.price} ر.س/شهر</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
