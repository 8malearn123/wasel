import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLanguage } from '@/i18n';
import { useCustomers, Customer, LoyaltyTransaction } from '@/hooks/useCustomers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, Star, Award, Gift, TrendingUp, Search, Plus, Minus, History } from 'lucide-react';

const tierColors: Record<string, string> = {
  bronze: 'bg-amber-700/20 text-amber-700',
  silver: 'bg-gray-400/20 text-gray-500',
  gold: 'bg-yellow-500/20 text-yellow-600',
  platinum: 'bg-purple-500/20 text-purple-600',
};

const tierLabelsAr: Record<string, string> = { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي', platinum: 'بلاتيني' };
const tierLabelsEn: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

export default function CustomersPage() {
  const { isRTL } = useLanguage();
  const { customers, loading, stats, createCustomer, updateCustomer, addLoyaltyPoints, getLoyaltyHistory } = useCustomers();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([]);
  const [showLoyaltyDialog, setShowLoyaltyDialog] = useState(false);
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsDesc, setPointsDesc] = useState('');
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Add form state
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'all' || c.loyalty_tier === tierFilter;
    return matchSearch && matchTier;
  });

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    await createCustomer(form);
    setForm({ name: '', phone: '', email: '', address: '', notes: '' });
    setShowAddDialog(false);
  };

  const handleAddPoints = async (positive: boolean) => {
    if (!selectedCustomer || !pointsAmount) return;
    const pts = parseInt(pointsAmount) * (positive ? 1 : -1);
    await addLoyaltyPoints(selectedCustomer.id, pts, pointsDesc || (positive ? 'إضافة نقاط يدوية' : 'استبدال نقاط'));
    setPointsAmount('');
    setPointsDesc('');
    setShowLoyaltyDialog(false);
    setSelectedCustomer(null);
  };

  const openHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    const history = await getLoyaltyHistory(customer.id);
    setLoyaltyHistory(history);
    setShowHistoryDialog(true);
  };

  const t = isRTL;

  return (
    <AppLayout title={isRTL ? 'قاعدة العملاء' : 'Customers'}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t ? 'قاعدة العملاء' : 'Customers'}</h1>
            <p className="text-sm text-muted-foreground">{t ? 'إدارة العملاء ونظام الولاء' : 'Manage customers & loyalty program'}</p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button><UserPlus className="w-4 h-4 me-2" />{t ? 'إضافة عميل' : 'Add Customer'}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t ? 'إضافة عميل جديد' : 'Add New Customer'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>{t ? 'الاسم' : 'Name'} *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>{t ? 'الهاتف' : 'Phone'}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>{t ? 'البريد' : 'Email'}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>{t ? 'العنوان' : 'Address'}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                <div><Label>{t ? 'ملاحظات' : 'Notes'}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={handleAdd} className="w-full">{t ? 'حفظ' : 'Save'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">{t ? 'إجمالي العملاء' : 'Total Customers'}</p><p className="text-xl font-bold">{stats.total}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10"><Star className="w-5 h-5 text-yellow-500" /></div>
            <div><p className="text-xs text-muted-foreground">{t ? 'إجمالي النقاط' : 'Total Points'}</p><p className="text-xl font-bold">{stats.totalPoints.toLocaleString()}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="w-5 h-5 text-green-500" /></div>
            <div><p className="text-xs text-muted-foreground">{t ? 'إجمالي المشتريات' : 'Total Revenue'}</p><p className="text-xl font-bold">{stats.totalSpent.toLocaleString()} {t ? 'ر.س' : 'SAR'}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><Award className="w-5 h-5 text-purple-500" /></div>
            <div><p className="text-xs text-muted-foreground">{t ? 'عملاء بلاتينيين' : 'Platinum'}</p><p className="text-xl font-bold">{stats.platinum}</p></div>
          </CardContent></Card>
        </div>

        {/* Tier Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t ? 'توزيع المستويات' : 'Tier Distribution'}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {['platinum', 'gold', 'silver', 'bronze'].map(tier => (
                <div key={tier} className="flex items-center gap-2">
                  <Badge className={tierColors[tier]}>{t ? tierLabelsAr[tier] : tierLabelsEn[tier]}</Badge>
                  <span className="text-sm font-medium">{stats[tier as keyof typeof stats]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search & Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="ps-10" placeholder={t ? 'بحث بالاسم أو الهاتف أو البريد...' : 'Search by name, phone, email...'} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {['all', 'platinum', 'gold', 'silver', 'bronze'].map(tier => (
              <Button key={tier} variant={tierFilter === tier ? 'default' : 'outline'} size="sm" onClick={() => setTierFilter(tier)}>
                {tier === 'all' ? (t ? 'الكل' : 'All') : (t ? tierLabelsAr[tier] : tierLabelsEn[tier])}
              </Button>
            ))}
          </div>
        </div>

        {/* Customers Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{t ? 'لا يوجد عملاء' : 'No customers found'}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t ? 'الاسم' : 'Name'}</TableHead>
                    <TableHead>{t ? 'الهاتف' : 'Phone'}</TableHead>
                    <TableHead>{t ? 'البريد' : 'Email'}</TableHead>
                    <TableHead>{t ? 'النقاط' : 'Points'}</TableHead>
                    <TableHead>{t ? 'المستوى' : 'Tier'}</TableHead>
                    <TableHead>{t ? 'إجمالي المشتريات' : 'Total Spent'}</TableHead>
                    <TableHead>{t ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(customer => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium"><Link to={`/customers/${customer.id}`} className="hover:text-primary transition-colors">{customer.name}</Link></TableCell>
                      <TableCell>{customer.phone || '-'}</TableCell>
                      <TableCell>{customer.email || '-'}</TableCell>
                      <TableCell><span className="font-semibold text-yellow-600">{customer.loyalty_points.toLocaleString()}</span></TableCell>
                      <TableCell><Badge className={tierColors[customer.loyalty_tier]}>{t ? tierLabelsAr[customer.loyalty_tier] : tierLabelsEn[customer.loyalty_tier]}</Badge></TableCell>
                      <TableCell>{Number(customer.total_spent).toLocaleString()} {t ? 'ر.س' : 'SAR'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedCustomer(customer); setShowLoyaltyDialog(true); }}>
                            <Gift className="w-3 h-3 me-1" />{t ? 'نقاط' : 'Points'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openHistory(customer)}>
                            <History className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add/Redeem Points Dialog */}
        <Dialog open={showLoyaltyDialog} onOpenChange={setShowLoyaltyDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t ? 'إدارة نقاط الولاء' : 'Manage Loyalty Points'} - {selectedCustomer?.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t ? 'الرصيد الحالي' : 'Current Balance'}</p>
                <p className="text-3xl font-bold text-yellow-600">{selectedCustomer?.loyalty_points.toLocaleString()}</p>
                <Badge className={tierColors[selectedCustomer?.loyalty_tier || 'bronze']}>
                  {t ? tierLabelsAr[selectedCustomer?.loyalty_tier || 'bronze'] : tierLabelsEn[selectedCustomer?.loyalty_tier || 'bronze']}
                </Badge>
              </div>
              <div><Label>{t ? 'عدد النقاط' : 'Points Amount'}</Label><Input type="number" min="1" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} /></div>
              <div><Label>{t ? 'الوصف' : 'Description'}</Label><Input value={pointsDesc} onChange={e => setPointsDesc(e.target.value)} placeholder={t ? 'سبب الإضافة/الاستبدال' : 'Reason'} /></div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleAddPoints(true)}><Plus className="w-4 h-4 me-1" />{t ? 'إضافة نقاط' : 'Add Points'}</Button>
                <Button className="flex-1" variant="destructive" onClick={() => handleAddPoints(false)}><Minus className="w-4 h-4 me-1" />{t ? 'استبدال نقاط' : 'Redeem Points'}</Button>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>{t ? 'مستويات الولاء:' : 'Loyalty Tiers:'}</p>
                <p>🥉 {t ? 'برونزي: 0-499' : 'Bronze: 0-499'} | 🥈 {t ? 'فضي: 500-1999' : 'Silver: 500-1999'} | 🥇 {t ? 'ذهبي: 2000-4999' : 'Gold: 2000-4999'} | 💎 {t ? 'بلاتيني: 5000+' : 'Platinum: 5000+'}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Points History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t ? 'سجل النقاط' : 'Points History'} - {selectedCustomer?.name}</DialogTitle></DialogHeader>
            {loyaltyHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">{t ? 'لا يوجد سجل' : 'No history'}</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {loyaltyHistory.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{tx.description || (tx.type === 'earn' ? (t ? 'كسب نقاط' : 'Earned') : (t ? 'استبدال' : 'Redeemed'))}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString(t ? 'ar-SA' : 'en-US')}</p>
                    </div>
                    <span className={`font-bold ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
