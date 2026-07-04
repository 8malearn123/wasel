import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LifeBuoy, Send } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useAdminTickets } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function AdminTicketsPage() {
  const { isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();
  const { tickets, loading: ticketsLoading, replyToTicket, updateTicketStatus } = useAdminTickets();
  const navigate = useNavigate();
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  useEffect(() => {
    if (adminLoading) return;
    if (!isPlatformAdmin) navigate('/auth');
  }, [isPlatformAdmin, adminLoading]);

  const handleReply = async (ticketId: string) => {
    if (!reply.trim()) return;
    await replyToTicket(ticketId, reply);
    toast.success('تم الرد');
    setReply(''); setReplyingId(null);
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-500/10 text-blue-700', in_progress: 'bg-warning/10 text-warning',
    resolved: 'bg-success/10 text-success', closed: 'bg-muted text-muted-foreground',
  };
  const statusLabels: Record<string, string> = { open: 'مفتوحة', in_progress: 'قيد المعالجة', resolved: 'تم الحل', closed: 'مغلقة' };
  const priorityLabels: Record<string, string> = { low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة' };

  if (adminLoading || ticketsLoading) return <AdminLayout title="تذاكر الدعم"><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AdminLayout>;

  return (
    <AdminLayout title="تذاكر الدعم" subtitle={`${tickets.length} تذكرة`}>
      {tickets.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <LifeBuoy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">لا توجد تذاكر</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => (
            <div key={ticket.id} className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={statusColors[ticket.status]}>{statusLabels[ticket.status]}</Badge>
                    <Badge variant="outline" className={cn("text-xs",
                      ticket.priority === 'urgent' ? 'bg-destructive/10 text-destructive' :
                      ticket.priority === 'high' ? 'bg-warning/10 text-warning' : ''
                    )}>{priorityLabels[ticket.priority]}</Badge>
                    <span className="text-xs text-muted-foreground">{(ticket as any).merchant?.name}</span>
                  </div>
                  <h4 className="font-semibold text-foreground">{ticket.subject}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{ticket.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">{format(new Date(ticket.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {ticket.status === 'open' && <Button size="sm" variant="outline" onClick={() => updateTicketStatus(ticket.id, 'in_progress')}>معالجة</Button>}
                  {(ticket.status === 'open' || ticket.status === 'in_progress') && <Button size="sm" variant="outline" onClick={() => updateTicketStatus(ticket.id, 'resolved')}>حل</Button>}
                </div>
              </div>
              {ticket.admin_reply && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">الرد:</p>
                  <p className="text-sm">{ticket.admin_reply}</p>
                </div>
              )}
              {replyingId === ticket.id ? (
                <div className="flex gap-2">
                  <Textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="اكتب الرد..." className="flex-1" rows={2} />
                  <Button size="sm" onClick={() => handleReply(ticket.id)}><Send className="w-4 h-4" /></Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setReplyingId(ticket.id)}>رد</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
