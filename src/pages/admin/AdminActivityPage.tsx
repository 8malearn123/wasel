import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Activity } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { format } from 'date-fns';

const actionLabels: Record<string, string> = {
  branch_activated: 'تفعيل فرع', device_added: 'إضافة جهاز', device_sold: 'بيع جهاز',
  sale_created: 'إنشاء فاتورة', repair_created: 'إنشاء إصلاح', transfer_created: 'إنشاء تحويل',
  user_created: 'إضافة مستخدم', accessory_added: 'إضافة إكسسوار', stocktake_created: 'إنشاء جرد',
};

export default function AdminActivityPage() {
  const { activityLogs, fetchActivityLogs, isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (adminLoading) return;
    if (!isPlatformAdmin) { navigate('/auth'); return; }
    fetchActivityLogs().then(() => setLoaded(true));
  }, [isPlatformAdmin, adminLoading]);

  if (!loaded || adminLoading) return <AdminLayout title="سجل النشاط"><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AdminLayout>;

  return (
    <AdminLayout title="سجل النشاط" subtitle="آخر 100 عملية">
      {activityLogs.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">لا يوجد نشاط</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>التاجر</TableHead><TableHead>الإجراء</TableHead><TableHead>النوع</TableHead><TableHead>التاريخ</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {activityLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{(log as any).merchant?.name || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{actionLabels[log.action] || log.action}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.entity_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
