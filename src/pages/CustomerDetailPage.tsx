import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Phone, Mail, MapPin, Gift, History, ShoppingBag, Wrench,
  Star, Loader2, Pencil, Save, X, Plus, Minus,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLanguage } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import type { Customer, LoyaltyTransaction } from '@/hooks/useCustomers';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

const tierColors: Record<string, string> = {
  bronze: 'bg-amber-700/15 text-amber-700',
  silver: 'bg-slate-400/15 text-slate-500',
  gold: 'bg-yellow-500/15 text-yellow-600',
  platinum: 'bg-purple-500/15 text-purple-600',
};
const tierLabel: Record<string, { ar: string; en: string }> = {
  bronze: { ar: 'برونزي', en: 'Bronze' },
  silver: { ar: 'فضي', en: 'Silver' },
  gold: { ar: 'ذهبي', en: 'Gold' },
  platinum: { ar: 'بلاتيني', en: 'Platinum' },
};

function tierFromPoints(p: number) {
  if (p >= 5000) return 'platinum';
  if (p >= 2000) return 'gold';
  if (p >= 500) return 'silver';
  return 'bronze';
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isRTL } = useLanguage();
  const t = isRTL;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyTransaction[]>([]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  const [pointsDlg, setPointsDlg] = useState(false);
  const [pointsVal, setPointsVal] = useState('');
  const [pointsDesc, setPointsDesc] = useState('');
  const [pointsPositive, setPointsPositive] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: c, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
      if (cancelled) return;
      if (error || !c) { setLoading(false); return; }
      setCustomer(c as Customer);
      setForm({
        name: c.name || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        notes: c.notes || '',
      });

      const [{ data: s }, { data: r }, { data: l }] = await Promise.all([
        supabase.from('sales').select('*').eq('customer_phone', c.phone || '__none__')
          .order('sale_date', { ascending: false }).limit(50),
        supabase.from('repair_orders').select('*').eq('customer_phone', c.phone || '__none__')
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('loyalty_transactions').select('*').eq('customer_id', id)
          .order('created_at', { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      setSales(s || []);
      setRepairs(r || []);
      setLoyalty((l || []) as LoyaltyTransaction[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const stats = useMemo(() => {
    const totalSales = sales.reduce((s, x) => s + Number(x.total_amount || 0), 0);
    return {
      salesCount: sales.length,
      totalSales,
      repairsCount: repairs.length,
      avgTicket: sales.length ? totalSales / sales.length : 0,
    };
  }, [sales, repairs]);

  const handleSave = async () => {
    if (!customer) return;
    const { error } = await supabase.from('customers').update(form).eq('id', customer.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t ? 'تم الحفظ' : 'Saved');
    setCustomer({ ...customer, ...form });
    setEditing(false);
  };

  const handlePoints = async () => {
    if (!customer) return;
    const pts = (pointsPositive ? 1 : -1) * Math.abs(parseInt(pointsVal || '0', 10));
    if (!pts) return;
    const { error: txErr } = await supabase.from('loyalty_transactions').insert({
      merchant_id: customer.merchant_id,
      customer_id: customer.id,
      points: pts,
      type: pts > 0 ? 'earn' : 'redeem',
      description: pointsDesc || (pts > 0 ? 'إضافة يدوية' : 'استبدال'),
    });
    if (txErr) { toast.error(txErr.message); return; }
    const newPoints = Math.max(0, customer.loyalty_points + pts);
    await supabase.from('customers').update({
      loyalty_points: newPoints,
      loyalty_tier: tierFromPoints(newPoints),
    }).eq('id', customer.id);
    setCustomer({ ...customer, loyalty_points: newPoints, loyalty_tier: tierFromPoints(newPoints) });
    const { data: l } = await supabase.from('loyalty_transactions').select('*').eq('customer_id', customer.id)
      .order('created_at', { ascending: false }).limit(100);
    setLoyalty((l || []) as LoyaltyTransaction[]);
    setPointsDlg(false);
    setPointsVal('');
    setPointsDesc('');
    toast.success(t ? 'تم تحديث النقاط' : 'Points updated');
  };

  if (loading) {
    return (
      <AppLayout title={t ? 'العميل' : 'Customer'}>
        <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  if (!customer) {
    return (
      <AppLayout title={t ? 'العميل' : 'Customer'}>
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">{t ? 'العميل غير موجود' : 'Customer not found'}</p>
          <Button asChild><Link to="/customers">{t ? 'العودة للعملاء' : 'Back to customers'}</Link></Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={customer.name} subtitle={t ? 'تفاصيل العميل' : 'Customer details'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/customers"><ArrowRight className="w-4 h-4 ml-1" /> {t ? 'العملاء' : 'Customers'}</Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPointsDlg(true)}>
              <Gift className="w-4 h-4 ml-2" /> {t ? 'إدارة النقاط' : 'Manage points'}
            </Button>
            {!editing ? (
              <Button onClick={() => setEditing(true)}><Pencil className="w-4 h-4 ml-2" />{t ? 'تعديل' : 'Edit'}</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => { setEditing(false); setForm({ name: customer.name, phone: customer.phone || '', email: customer.email || '', address: customer.address || '', notes: customer.notes || '' }); }}><X className="w-4 h-4" /></Button>
                <Button onClick={handleSave}><Save className="w-4 h-4 ml-2" />{t ? 'حفظ' : 'Save'}</Button>
              </>
            )}
          </div>
        </div>

        {/* Profile + KPIs */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-2xl font-bold">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{customer.name}</h2>
                  <Badge className={tierColors[customer.loyalty_tier]}>
                    <Star className="w-3 h-3 ml-1" />
                    {t ? tierLabel[customer.loyalty_tier]?.ar : tierLabel[customer.loyalty_tier]?.en}
                  </Badge>
                </div>
              </div>

              {editing ? (
                <div className="space-y-3 pt-2">
                  <div><Label>{t ? 'الاسم' : 'Name'}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>{t ? 'الجوال' : 'Phone'}</Label><Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>{t ? 'البريد' : 'Email'}</Label><Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>{t ? 'العنوان' : 'Address'}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                  <div><Label>{t ? 'ملاحظات' : 'Notes'}</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {customer.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span dir="ltr">{customer.phone}</span></div>}
                  {customer.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span dir="ltr">{customer.email}</span></div>}
                  {customer.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{customer.address}</span></div>}
                  {customer.notes && <p className="text-muted-foreground bg-muted/40 rounded-lg p-2 mt-2 whitespace-pre-wrap">{customer.notes}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Star, label: t ? 'النقاط' : 'Points', value: customer.loyalty_points.toLocaleString(), color: 'text-yellow-600' },
              { icon: ShoppingBag, label: t ? 'المشتريات' : 'Purchases', value: stats.salesCount, color: 'text-primary' },
              { icon: Wrench, label: t ? 'الصيانات' : 'Repairs', value: stats.repairsCount, color: 'text-accent' },
              { icon: Gift, label: t ? 'متوسط الفاتورة' : 'Avg ticket', value: `${Math.round(stats.avgTicket).toLocaleString()} ${t ? 'ر.س' : 'SAR'}`, color: 'text-success' },
            ].map((k, i) => (
              <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="p-4">
                    <k.icon className={`w-5 h-5 mb-2 ${k.color}`} />
                    <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                    <p className="text-lg font-bold">{k.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <Card className="col-span-2 md:col-span-4">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{t ? 'إجمالي المشتريات' : 'Total spent'}</p>
                <p className="text-2xl font-bold">{stats.totalSales.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t ? 'ر.س' : 'SAR'}</span></p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">{t ? 'المشتريات' : 'Sales'} ({sales.length})</TabsTrigger>
            <TabsTrigger value="repairs">{t ? 'الصيانات' : 'Repairs'} ({repairs.length})</TabsTrigger>
            <TabsTrigger value="loyalty">{t ? 'سجل النقاط' : 'Loyalty'} ({loyalty.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <Card>
              <CardContent className="p-0">
                {sales.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">{t ? 'لا توجد مشتريات' : 'No purchases yet'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t ? 'الفاتورة' : 'Invoice'}</TableHead>
                        <TableHead>{t ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{t ? 'الدفع' : 'Payment'}</TableHead>
                        <TableHead>{t ? 'الإجمالي' : 'Total'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono">{s.invoice_number}</TableCell>
                          <TableCell>{format(new Date(s.sale_date), 'dd MMM yyyy', { locale: t ? ar : undefined })}</TableCell>
                          <TableCell>{s.payment_method}</TableCell>
                          <TableCell className="font-semibold">{Number(s.total_amount).toLocaleString()} {t ? 'ر.س' : 'SAR'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repairs">
            <Card>
              <CardContent className="p-0">
                {repairs.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">{t ? 'لا توجد صيانات' : 'No repairs yet'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t ? 'رقم الصيانة' : 'Repair #'}</TableHead>
                        <TableHead>{t ? 'الجهاز' : 'Device'}</TableHead>
                        <TableHead>{t ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead>{t ? 'التكلفة' : 'Cost'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repairs.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.repair_number}</TableCell>
                          <TableCell>{[r.device_brand, r.device_model].filter(Boolean).join(' ') || r.device_type}</TableCell>
                          <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                          <TableCell>{Number(r.actual_cost || r.estimated_cost || 0).toLocaleString()} {t ? 'ر.س' : 'SAR'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loyalty">
            <Card>
              <CardContent className="p-0">
                {loyalty.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">{t ? 'لا توجد حركات نقاط' : 'No loyalty activity'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead>{t ? 'النوع' : 'Type'}</TableHead>
                        <TableHead>{t ? 'النقاط' : 'Points'}</TableHead>
                        <TableHead>{t ? 'الوصف' : 'Description'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loyalty.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{format(new Date(l.created_at), 'dd MMM yyyy', { locale: t ? ar : undefined })}</TableCell>
                          <TableCell><Badge variant={l.type === 'earn' ? 'default' : 'secondary'}>{l.type === 'earn' ? (t ? 'كسب' : 'Earn') : (t ? 'استبدال' : 'Redeem')}</Badge></TableCell>
                          <TableCell className={l.points >= 0 ? 'text-success font-bold' : 'text-destructive font-bold'}>{l.points >= 0 ? '+' : ''}{l.points}</TableCell>
                          <TableCell className="text-muted-foreground">{l.description || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Loyalty Dialog */}
        <Dialog open={pointsDlg} onOpenChange={setPointsDlg}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t ? 'إدارة نقاط الولاء' : 'Manage loyalty points'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button variant={pointsPositive ? 'default' : 'outline'} onClick={() => setPointsPositive(true)} className="flex-1"><Plus className="w-4 h-4 ml-1" />{t ? 'إضافة' : 'Add'}</Button>
                <Button variant={!pointsPositive ? 'default' : 'outline'} onClick={() => setPointsPositive(false)} className="flex-1"><Minus className="w-4 h-4 ml-1" />{t ? 'استبدال' : 'Redeem'}</Button>
              </div>
              <div><Label>{t ? 'عدد النقاط' : 'Points'}</Label><Input type="number" value={pointsVal} onChange={(e) => setPointsVal(e.target.value)} dir="ltr" /></div>
              <div><Label>{t ? 'السبب' : 'Reason'}</Label><Input value={pointsDesc} onChange={(e) => setPointsDesc(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setPointsDlg(false)}>{t ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handlePoints}>{t ? 'تأكيد' : 'Confirm'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
