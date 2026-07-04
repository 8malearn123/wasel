import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { usePlans, Plan } from '@/hooks/usePlans';
import { motion } from 'framer-motion';

export default function AdminPlansPage() {
  const { companies, fetchCompanies, isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();
  const { plans } = usePlans();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (adminLoading) return;
    if (!isPlatformAdmin) { navigate('/auth'); return; }
    fetchCompanies().then(() => setLoaded(true));
  }, [isPlatformAdmin, adminLoading]);

  if (!loaded || adminLoading) return <AdminLayout title="الباقات"><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AdminLayout>;

  return (
    <AdminLayout title="الباقات" subtitle="إدارة خطط الاشتراك">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan: Plan, i: number) => {
          const count = companies.filter(c => c.subscription?.plan_id === plan.id).length;
          return (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div><h3 className="font-bold text-foreground">{plan.name_ar}</h3><p className="text-sm text-muted-foreground">{plan.name}</p></div>
                <Badge variant={plan.is_active ? "default" : "secondary"}>{plan.is_active ? 'نشطة' : 'معطلة'}</Badge>
              </div>
              <p className="text-3xl font-bold text-primary mb-4">{plan.price} <span className="text-sm font-normal text-muted-foreground">ر.س/شهر</span></p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">الفروع</span><span className="font-medium">{plan.branch_limit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">المستخدمين</span><span className="font-medium">{plan.user_limit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">متجر إلكتروني</span>{plan.has_online_store ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}</div>
                <div className="flex justify-between"><span className="text-muted-foreground">تقارير متقدمة</span>{plan.advanced_reports ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}</div>
                <div className="flex justify-between"><span className="text-muted-foreground">دعم أولوية</span>{plan.priority_support ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}</div>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">مشتركين</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            </motion.div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
