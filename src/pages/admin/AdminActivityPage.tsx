import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Activity } from 'lucide-react';
import { actionLabel, entityLabel } from '@/lib/activityLabels';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { format } from 'date-fns';


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
                    <TableCell><Badge variant="outline" className="text-xs">{actionLabel(log.action)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entityLabel(log.entity_type)}</TableCell>
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
