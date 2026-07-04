import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TicketPlus, MessageSquare, Clock, CheckCircle, Loader2, Send,
  AlertCircle, ChevronDown, ChevronUp, Plus,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTickets, SupportTicket } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'مفتوحة', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20', icon: <AlertCircle className="w-3 h-3" /> },
  in_progress: { label: 'قيد المعالجة', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20', icon: <Clock className="w-3 h-3" /> },
  resolved: { label: 'تم الحل', color: 'bg-green-500/10 text-green-700 border-green-500/20', icon: <CheckCircle className="w-3 h-3" /> },
  closed: { label: 'مغلقة', color: 'bg-muted text-muted-foreground border-border', icon: <CheckCircle className="w-3 h-3" /> },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفضة', color: 'bg-muted text-muted-foreground' },
  normal: { label: 'عادية', color: 'bg-blue-500/10 text-blue-700' },
  high: { label: 'عالية', color: 'bg-amber-500/10 text-amber-700' },
  urgent: { label: 'عاجلة', color: 'bg-destructive/10 text-destructive' },
};

export default function SupportPage() {
  const { tickets, loading, createTicket } = useTickets();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SupportTicket['priority']>('normal');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    const result = await createTicket(subject.trim(), description.trim(), priority);
    if (!result.error) {
      setShowCreate(false);
      setSubject('');
      setDescription('');
      setPriority('normal');
    }
    setSubmitting(false);
  };

  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <AppLayout title="الدعم الفني" subtitle="إرسال ومتابعة طلبات الدعم">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700">
              مفتوحة: {openCount}
            </Badge>
            <Badge variant="outline">
              الكل: {tickets.length}
            </Badge>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          تذكرة جديدة
        </Button>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <TicketPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">لا توجد تذاكر</p>
          <p className="text-sm text-muted-foreground mb-4">أرسل تذكرة جديدة للتواصل مع الدعم الفني</p>
          <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> إنشاء تذكرة
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket, i) => {
            const status = statusConfig[ticket.status] || statusConfig.open;
            const pri = priorityConfig[ticket.priority] || priorityConfig.normal;
            const isExpanded = expandedTicket === ticket.id;

            return (
              <motion.div key={ticket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className={cn("gap-1", status.color)}>
                        {status.icon} {status.label}
                      </Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-foreground truncate">{ticket.subject}</h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ticket.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", pri.color)}>{pri.label}</Badge>
                    {ticket.admin_reply && <MessageSquare className="w-4 h-4 text-primary" />}
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
                    </div>

                    {ticket.admin_reply && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-primary">رد الدعم الفني</span>
                          {ticket.replied_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(ticket.replied_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.admin_reply}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Ticket Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تذكرة دعم جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الموضوع</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: مشكلة في طباعة الفواتير" />
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as SupportTicket['priority'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>وصف المشكلة</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="اشرح المشكلة بالتفصيل..."
                className="min-h-[120px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={submitting || !subject.trim() || !description.trim()} className="gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال التذكرة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
