import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLanguage } from '@/i18n';
import { useWholesale, WholesaleListing, WholesaleOrder, CreditTransaction } from '@/hooks/useWholesale';
import { usePlanEnforcement } from '@/hooks/usePlanEnforcement';
import { useDevices, useAccessories } from '@/hooks/useInventory';
import { useTabParam } from '@/hooks/useTabParam';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Package, Store, Truck, Plus, Trash2, Eye, EyeOff, Send, CheckCircle, XCircle, Clock,
  Lock, Wallet, AlertTriangle, Banknote, Search, Loader2, Inbox, ArrowLeftRight,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  approved: 'bg-primary/15 text-primary',
  shipped: 'bg-primary/15 text-primary',
  delivered: 'bg-success/15 text-success',
  cancelled: 'bg-destructive/15 text-destructive',
};
const statusLabelsAr: Record<string, string> = { pending: 'بانتظار الموافقة', approved: 'تمت الموافقة', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
const statusLabelsEn: Record<string, string> = { pending: 'Pending', approved: 'Approved', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const creditStatusAr: Record<string, string> = { unpaid: 'غير مسدد', partial: 'مسدد جزئياً', paid: 'مسدد', returned: 'مرتجع' };
const creditStatusEn: Record<string, string> = { unpaid: 'Unpaid', partial: 'Partly paid', paid: 'Paid', returned: 'Returned' };
const creditTypeAr: Record<string, string> = { invoice: 'آجل بفاتورة', consignment: 'أمانة (تسليف)' };
const creditTypeEn: Record<string, string> = { invoice: 'Invoice credit', consignment: 'Consignment' };

// The four sections the page shows. Buying and selling used to be six separate
// sidebar entries; each pair now shares a section with a side switch.
type Section = 'marketplace' | 'listings' | 'orders' | 'credits';
const SECTIONS: { key: Section; ar: string; en: string }[] = [
  { key: 'marketplace', ar: 'سوق الجملة', en: 'Marketplace' },
  { key: 'listings', ar: 'منتجاتي', en: 'My listings' },
  { key: 'orders', ar: 'الطلبات', en: 'Orders' },
  { key: 'credits', ar: 'المديونيات', en: 'Credits' },
];

// Links made when each of these was its own sidebar entry still work
const LEGACY_TABS: Record<string, { section: Section; side: string }> = {
  'my-orders': { section: 'orders', side: 'mine' },
  incoming: { section: 'orders', side: 'incoming' },
  'credits-out': { section: 'credits', side: 'out' },
  'credits-in': { section: 'credits', side: 'in' },
};

const isOverdue = (credit: CreditTransaction) =>
  Boolean(credit.due_date) && new Date(credit.due_date as string) < new Date() && credit.status !== 'paid';

const listingName = (listing: WholesaleListing) =>
  listing.item_type === 'device'
    ? `${listing.device?.brand || ''} ${listing.device?.model || ''}`.trim() || '—'
    : listing.accessory?.name || '—';

export default function WholesalePage() {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const { hasWholesale } = usePlanEnforcement();
  const {
    myListings, marketplace, myOrders, incomingOrders, myCredits, receivedCredits, loading,
    createListing, toggleListing, deleteListing, createOrder, updateOrderStatus, recordPayment,
  } = useWholesale();
  const { devices } = useDevices();
  const { accessories } = useAccessories();

  const [rawTab, setRawTab] = useTabParam('marketplace');
  const legacy = LEGACY_TABS[rawTab];
  const section: Section = legacy
    ? legacy.section
    : (SECTIONS.some(s => s.key === rawTab) ? (rawTab as Section) : 'marketplace');
  // Which way round: orders I placed vs orders sent to me, money owed to me vs money I owe
  const [orderSide, setOrderSide] = useState<'mine' | 'incoming'>(legacy?.section === 'orders' ? (legacy.side as 'mine' | 'incoming') : 'mine');
  const [creditSide, setCreditSide] = useState<'out' | 'in'>(legacy?.section === 'credits' ? (legacy.side as 'out' | 'in') : 'out');

  useEffect(() => {
    if (legacy) setRawTab(legacy.section);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTab]);

  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [itemType, setItemType] = useState('device');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [minQty, setMinQty] = useState('1');
  const [orderQty, setOrderQty] = useState('');
  const [selectedListing, setSelectedListing] = useState<WholesaleListing | null>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderPaymentType, setOrderPaymentType] = useState<'cash' | 'credit'>('cash');
  const [creditType, setCreditType] = useState<'invoice' | 'consignment'>('invoice');
  const [dueDate, setDueDate] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditTransaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const availableDevices = devices.filter(d => d.status === 'available');
  const availableAccessories = accessories.filter(a => a.quantity > 0);

  const totals = useMemo(() => {
    const owed = myCredits.filter(c => c.status !== 'paid').reduce((s, c) => s + c.remaining_amount, 0);
    const owing = receivedCredits.filter(c => c.status !== 'paid').reduce((s, c) => s + c.remaining_amount, 0);
    return {
      owed,
      owing,
      // Late on both sides — a bill I forgot to pay costs as much as one I forgot to collect
      overdue: myCredits.filter(isOverdue).length + receivedCredits.filter(isOverdue).length,
      pendingIncoming: incomingOrders.filter(o => o.status === 'pending').length,
      openCredits: myCredits.filter(c => c.status !== 'paid').length + receivedCredits.filter(c => c.status !== 'paid').length,
    };
  }, [myCredits, receivedCredits, incomingOrders]);

  const counts: Record<Section, number> = {
    marketplace: marketplace.length,
    listings: myListings.length,
    orders: myOrders.length + incomingOrders.length,
    credits: totals.openCredits,
  };

  const term = search.trim().toLowerCase();
  const matchesListing = (listing: WholesaleListing) =>
    !term ||
    listingName(listing).toLowerCase().includes(term) ||
    (listing.merchant?.name || '').toLowerCase().includes(term) ||
    (listing.device?.imei || '').toLowerCase().includes(term) ||
    (listing.accessory?.sku || '').toLowerCase().includes(term);

  const filteredMarketplace = marketplace.filter(matchesListing);
  const filteredListings = myListings.filter(matchesListing);
  const orders = orderSide === 'mine' ? myOrders : incomingOrders;
  const credits = creditSide === 'out' ? myCredits : receivedCredits;

  const goTo = (next: Section) => { setRawTab(next); setSearch(''); };

  const handleAddListing = async () => {
    if (!selectedItemId || !wholesalePrice) return;
    await createListing({
      item_type: itemType,
      device_id: itemType === 'device' ? selectedItemId : undefined,
      accessory_id: itemType === 'accessory' ? selectedItemId : undefined,
      wholesale_price: parseFloat(wholesalePrice),
      min_quantity: parseInt(minQty) || 1,
    });
    setShowAddDialog(false);
    setSelectedItemId('');
    setWholesalePrice('');
    setMinQty('1');
  };

  const handleOrder = async () => {
    if (!selectedListing || !orderQty) return;
    await createOrder(
      selectedListing.id,
      parseInt(orderQty),
      selectedListing,
      orderPaymentType === 'credit' ? creditType : undefined,
      orderPaymentType === 'credit' ? dueDate : undefined,
    );
    setShowOrderDialog(false);
    setSelectedListing(null);
    setOrderQty('');
    setOrderPaymentType('cash');
    setDueDate('');
    goTo('orders');
    setOrderSide('mine');
  };

  const handlePayment = async () => {
    if (!selectedCredit || !paymentAmount) return;
    await recordPayment(selectedCredit.id, parseFloat(paymentAmount));
    setShowPaymentDialog(false);
    setSelectedCredit(null);
    setPaymentAmount('');
  };

  if (!hasWholesale) {
    return (
      <AppLayout title={t ? 'بيع الجملة' : 'Wholesale'}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{t ? 'ميزة بيع الجملة' : 'Wholesale Feature'}</h2>
          <p className="text-muted-foreground max-w-md mb-4">
            {t ? 'هذه الميزة متاحة فقط في باقة الموزع. قم بالترقية لتتمكن من بيع الأجهزة والإكسسوارات بالجملة لمحلات أخرى على المنصة.' : 'This feature is available only in the Distributor plan.'}
          </p>
          <Button onClick={() => window.location.href = '/subscription'}>{t ? 'ترقية الباقة' : 'Upgrade Plan'}</Button>
        </div>
      </AppLayout>
    );
  }

  const money = (value: number) => `${value.toLocaleString(t ? 'ar-SA' : 'en-US')} ${t ? 'ر.س' : 'SAR'}`;

  // Each tile opens the section it counts, on the right side of it
  const tiles: { id: string; section: Section; label: string; value: string; icon: typeof Package; tone: string; bg: string; open?: () => void }[] = [
    { id: 'market', section: 'marketplace', label: t ? 'معروض في السوق' : 'On the marketplace', value: String(marketplace.length), icon: Store, tone: 'text-success', bg: 'bg-success/10' },
    { id: 'mine', section: 'listings', label: t ? 'منتجاتي' : 'My listings', value: String(myListings.length), icon: Package, tone: 'text-primary', bg: 'bg-primary/10' },
    { id: 'pending', section: 'orders', label: t ? 'طلبات بانتظاري' : 'Orders awaiting me', value: String(totals.pendingIncoming), icon: Inbox, tone: totals.pendingIncoming ? 'text-warning' : 'text-muted-foreground', bg: 'bg-warning/10', open: () => setOrderSide('incoming') },
    { id: 'owed', section: 'credits', label: t ? 'مديونيات لي' : 'Owed to me', value: money(totals.owed), icon: Wallet, tone: 'text-primary', bg: 'bg-primary/10', open: () => setCreditSide('out') },
    { id: 'owing', section: 'credits', label: t ? 'مديونياتي' : 'I owe', value: money(totals.owing), icon: Banknote, tone: 'text-warning', bg: 'bg-warning/10', open: () => setCreditSide('in') },
  ];

  return (
    <AppLayout
      title={t ? 'بيع الجملة' : 'Wholesale'}
      subtitle={t ? 'السوق، منتجاتك، الطلبات والمديونيات في صفحة واحدة' : 'Marketplace, listings, orders and credits in one place'}
    >
      <div className="space-y-6">
        {/* Each tile opens the section it counts */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {tiles.map((tile, i) => (
            <motion.button
              key={tile.id}
              type="button"
              onClick={() => { goTo(tile.section); tile.open?.(); }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                'p-4 rounded-xl bg-card border shadow-sm text-start transition-all hover:shadow-md',
                section === tile.section ? 'border-primary/50' : 'border-border',
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', tile.bg)}><tile.icon className={cn('w-5 h-5', tile.tone)} /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{tile.label}</p>
                  <p className="text-lg font-bold truncate">{tile.value}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {totals.overdue > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-destructive font-medium">
              {t ? `${totals.overdue} مديونية تجاوزت تاريخ الاستحقاق` : `${totals.overdue} credits are past their due date`}
            </span>
            <Button variant="ghost" size="sm" className="ms-auto" onClick={() => goTo('credits')}>
              {t ? 'عرض' : 'View'}
            </Button>
          </div>
        )}

        {/* The switcher used to live in the sidebar only */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => goTo(s.key)}
                aria-pressed={section === s.key}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
                  section === s.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t ? s.ar : s.en}
                <span className={cn(
                  'text-[11px] tabular-nums px-1.5 rounded-full',
                  section === s.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}>
                  {counts[s.key]}
                </span>
                {s.key === 'orders' && totals.pendingIncoming > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" aria-hidden />
                )}
              </button>
            ))}
          </div>

          {(section === 'marketplace' || section === 'listings') && (
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t ? 'ابحث بالمنتج أو المحل أو IMEI' : 'Search product, store or IMEI'}
                className="ps-9"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* ---------- Marketplace ---------- */}
            {section === 'marketplace' && (
              <Card>
                <CardHeader><CardTitle className="text-base">{t ? 'منتجات متاحة من موزعين' : 'Available from distributors'}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {filteredMarketplace.length === 0 ? (
                    <EmptyState icon={Store} text={term ? (t ? 'لا نتائج مطابقة' : 'Nothing matches') : (t ? 'لا توجد منتجات معروضة حالياً' : 'No products on offer')} />
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>{t ? 'الموزع' : 'Distributor'}</TableHead>
                        <TableHead>{t ? 'المنتج' : 'Product'}</TableHead>
                        <TableHead className="text-center">{t ? 'النوع' : 'Type'}</TableHead>
                        <TableHead className="text-center">{t ? 'الحد الأدنى' : 'Min qty'}</TableHead>
                        <TableHead className="text-center">{t ? 'سعر الجملة' : 'Price'}</TableHead>
                        <TableHead className="text-end">{t ? 'طلب' : 'Order'}</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredMarketplace.map(listing => (
                          <TableRow key={listing.id}>
                            <TableCell className="font-medium">{listing.merchant?.name || '—'}</TableCell>
                            <TableCell>{listingName(listing)}</TableCell>
                            <TableCell className="text-center"><Badge variant="outline">{listing.item_type === 'device' ? (t ? 'جهاز' : 'Device') : (t ? 'إكسسوار' : 'Accessory')}</Badge></TableCell>
                            <TableCell className="text-center tabular-nums">{listing.min_quantity}</TableCell>
                            <TableCell className="text-center font-semibold tabular-nums">{money(listing.wholesale_price)}</TableCell>
                            <TableCell className="text-end">
                              <Button size="sm" onClick={() => { setSelectedListing(listing); setOrderQty(String(listing.min_quantity)); setShowOrderDialog(true); }}>
                                <Send className="w-3 h-3 me-1" />{t ? 'اطلب' : 'Order'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ---------- My listings ---------- */}
            {section === 'listings' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{t ? 'المنتجات المعروضة للبيع بالجملة' : 'Wholesale products'}</CardTitle>
                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 me-1" />{t ? 'إضافة منتج' : 'Add'}</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{t ? 'إضافة منتج للبيع بالجملة' : 'Add wholesale product'}</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div><Label>{t ? 'نوع المنتج' : 'Type'}</Label>
                          <Select value={itemType} onValueChange={v => { setItemType(v); setSelectedItemId(''); }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="device">{t ? 'جهاز' : 'Device'}</SelectItem>
                              <SelectItem value="accessory">{t ? 'إكسسوار' : 'Accessory'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>{t ? 'المنتج' : 'Product'}</Label>
                          <SearchableSelect
                            value={selectedItemId}
                            onChange={setSelectedItemId}
                            placeholder={t ? 'اختر' : 'Select'}
                            options={itemType === 'device'
                              ? availableDevices.map(d => ({ value: d.id, label: `${d.brand || ''} ${d.model}`.trim(), hint: d.imei }))
                              : availableAccessories.map(a => ({ value: a.id, label: a.name, hint: `${a.quantity}` }))}
                          />
                        </div>
                        <div><Label>{t ? 'سعر الجملة' : 'Wholesale price'} ({t ? 'ر.س' : 'SAR'})</Label><Input type="number" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} /></div>
                        <div><Label>{t ? 'أقل كمية للطلب' : 'Min order qty'}</Label><Input type="number" min={1} value={minQty} onChange={e => setMinQty(e.target.value)} /></div>
                        <Button onClick={handleAddListing} className="w-full" disabled={!selectedItemId || !wholesalePrice}>{t ? 'إضافة' : 'Add'}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredListings.length === 0 ? (
                    <EmptyState icon={Package} text={term ? (t ? 'لا نتائج مطابقة' : 'Nothing matches') : (t ? 'لم تضف أي منتجات بعد' : 'No listings yet')} />
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>{t ? 'المنتج' : 'Product'}</TableHead>
                        <TableHead className="text-center">{t ? 'النوع' : 'Type'}</TableHead>
                        <TableHead className="text-center">{t ? 'الحد الأدنى' : 'Min qty'}</TableHead>
                        <TableHead className="text-center">{t ? 'سعر الجملة' : 'Price'}</TableHead>
                        <TableHead className="text-center">{t ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead className="text-end">{t ? 'إجراءات' : 'Actions'}</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredListings.map(listing => (
                          <TableRow key={listing.id} className={listing.is_active ? '' : 'opacity-60'}>
                            <TableCell className="font-medium">{listingName(listing)}</TableCell>
                            <TableCell className="text-center"><Badge variant="outline">{listing.item_type === 'device' ? (t ? 'جهاز' : 'Device') : (t ? 'إكسسوار' : 'Accessory')}</Badge></TableCell>
                            <TableCell className="text-center tabular-nums">{listing.min_quantity}</TableCell>
                            <TableCell className="text-center tabular-nums">{money(listing.wholesale_price)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={listing.is_active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}>
                                {listing.is_active ? (t ? 'معروض' : 'Listed') : (t ? 'متوقف' : 'Hidden')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" title={listing.is_active ? (t ? 'إخفاء من السوق' : 'Hide') : (t ? 'عرض في السوق' : 'List')} onClick={() => toggleListing(listing.id, !listing.is_active)}>
                                  {listing.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                                <Button variant="ghost" size="sm" title={t ? 'حذف' : 'Delete'} onClick={() => deleteListing(listing.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ---------- Orders: mine and incoming, one table ---------- */}
            {section === 'orders' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base">{orderSide === 'mine' ? (t ? 'طلبات أرسلتها' : 'Orders I placed') : (t ? 'طلبات وصلتني' : 'Orders sent to me')}</CardTitle>
                  <SideSwitch
                    value={orderSide}
                    onChange={next => setOrderSide(next)}
                    options={[
                      { key: 'mine', label: t ? 'طلباتي (شراء)' : 'My orders', count: myOrders.length },
                      { key: 'incoming', label: t ? 'طلبات واردة (بيع)' : 'Incoming', count: incomingOrders.length, dot: totals.pendingIncoming > 0 },
                    ]}
                  />
                </CardHeader>
                <CardContent className="p-0">
                  {orders.length === 0 ? (
                    <EmptyState icon={ArrowLeftRight} text={orderSide === 'mine' ? (t ? 'لم ترسل أي طلب بعد' : 'No orders placed yet') : (t ? 'لا توجد طلبات واردة' : 'No incoming orders')} />
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>{t ? 'رقم' : '#'}</TableHead>
                        <TableHead>{orderSide === 'mine' ? (t ? 'الموزع' : 'Distributor') : (t ? 'المشتري' : 'Buyer')}</TableHead>
                        <TableHead className="text-center">{t ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead className="text-center">{t ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead className="text-center">{t ? 'التاريخ' : 'Date'}</TableHead>
                        {orderSide === 'incoming' && <TableHead className="text-end">{t ? 'إجراءات' : 'Actions'}</TableHead>}
                      </TableRow></TableHeader>
                      <TableBody>
                        {orders.map((order: WholesaleOrder) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm" dir="ltr">{order.order_number}</TableCell>
                            <TableCell>{(orderSide === 'mine' ? order.supplier_merchant?.name : order.buyer_merchant?.name) || '—'}</TableCell>
                            <TableCell className="text-center font-semibold tabular-nums">{money(order.total_amount)}</TableCell>
                            <TableCell className="text-center"><Badge className={statusColors[order.status] || 'bg-muted'}>{(t ? statusLabelsAr : statusLabelsEn)[order.status] || order.status}</Badge></TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString(t ? 'ar-SA' : 'en-US')}</TableCell>
                            {orderSide === 'incoming' && (
                              <TableCell>
                                <div className="flex gap-1 justify-end">
                                  {order.status === 'pending' && (
                                    <>
                                      <Button size="sm" onClick={() => updateOrderStatus(order.id, 'approved')}><CheckCircle className="w-3 h-3 me-1" />{t ? 'قبول' : 'Accept'}</Button>
                                      <Button size="sm" variant="destructive" onClick={() => updateOrderStatus(order.id, 'cancelled')}><XCircle className="w-3 h-3" /></Button>
                                    </>
                                  )}
                                  {order.status === 'approved' && <Button size="sm" onClick={() => updateOrderStatus(order.id, 'shipped')}><Truck className="w-3 h-3 me-1" />{t ? 'شحن' : 'Ship'}</Button>}
                                  {order.status === 'shipped' && <Button size="sm" variant="outline" onClick={() => updateOrderStatus(order.id, 'delivered')}><CheckCircle className="w-3 h-3 me-1" />{t ? 'تم التسليم' : 'Delivered'}</Button>}
                                  {order.status === 'delivered' && <Badge className="bg-success/15 text-success"><Clock className="w-3 h-3 me-1" />{t ? 'مكتمل' : 'Done'}</Badge>}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ---------- Credits: owed to me and what I owe, one table ---------- */}
            {section === 'credits' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{creditSide === 'out' ? (t ? 'مديونيات لي' : 'Owed to me') : (t ? 'مديونياتي' : 'What I owe')}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t ? 'المتبقي: ' : 'Remaining: '}
                      <span className="font-semibold text-foreground">{money(creditSide === 'out' ? totals.owed : totals.owing)}</span>
                    </p>
                  </div>
                  <SideSwitch
                    value={creditSide}
                    onChange={next => setCreditSide(next)}
                    options={[
                      { key: 'out', label: t ? 'لي' : 'Owed to me', count: myCredits.filter(c => c.status !== 'paid').length },
                      { key: 'in', label: t ? 'عليّ' : 'I owe', count: receivedCredits.filter(c => c.status !== 'paid').length },
                    ]}
                  />
                </CardHeader>
                <CardContent className="p-0">
                  {credits.length === 0 ? (
                    <EmptyState icon={Wallet} text={t ? 'لا توجد مديونيات' : 'No credits'} />
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>{creditSide === 'out' ? (t ? 'المحل' : 'Store') : (t ? 'الموزع' : 'Distributor')}</TableHead>
                        <TableHead className="text-center">{t ? 'النوع' : 'Type'}</TableHead>
                        <TableHead className="text-center">{t ? 'المبلغ' : 'Amount'}</TableHead>
                        <TableHead className="text-center">{t ? 'المسدد' : 'Paid'}</TableHead>
                        <TableHead className="text-center">{t ? 'المتبقي' : 'Remaining'}</TableHead>
                        <TableHead className="text-center">{t ? 'الاستحقاق' : 'Due'}</TableHead>
                        <TableHead className="text-center">{t ? 'الحالة' : 'Status'}</TableHead>
                        {creditSide === 'out' && <TableHead className="text-end">{t ? 'تحصيل' : 'Collect'}</TableHead>}
                      </TableRow></TableHeader>
                      <TableBody>
                        {credits.map(credit => {
                          const late = isOverdue(credit);
                          return (
                            <TableRow key={credit.id} className={late ? 'bg-destructive/5' : ''}>
                              <TableCell className="font-medium">{(creditSide === 'out' ? credit.buyer_merchant?.name : credit.supplier_merchant?.name) || '—'}</TableCell>
                              <TableCell className="text-center"><Badge variant="outline">{(t ? creditTypeAr : creditTypeEn)[credit.credit_type]}</Badge></TableCell>
                              <TableCell className="text-center tabular-nums">{money(credit.amount)}</TableCell>
                              <TableCell className="text-center tabular-nums text-success">{credit.paid_amount.toLocaleString(t ? 'ar-SA' : 'en-US')}</TableCell>
                              <TableCell className="text-center tabular-nums font-semibold text-destructive">{credit.remaining_amount.toLocaleString(t ? 'ar-SA' : 'en-US')}</TableCell>
                              <TableCell className="text-center text-sm">
                                {credit.due_date ? (
                                  <span className={late ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                                    {new Date(credit.due_date).toLocaleDateString(t ? 'ar-SA' : 'en-US')}
                                    {late && <AlertTriangle className="w-3 h-3 inline ms-1" />}
                                  </span>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={credit.status === 'paid' ? 'bg-success/15 text-success' : credit.status === 'partial' ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'}>
                                  {(t ? creditStatusAr : creditStatusEn)[credit.status] || credit.status}
                                </Badge>
                              </TableCell>
                              {creditSide === 'out' && (
                                <TableCell>
                                  <div className="flex justify-end">
                                    {credit.status !== 'paid' && (
                                      <Button size="sm" variant="outline" onClick={() => { setSelectedCredit(credit); setPaymentAmount(''); setShowPaymentDialog(true); }}>
                                        <Banknote className="w-3 h-3 me-1" />{t ? 'تسجيل دفعة' : 'Record payment'}
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Order dialog with the credit option */}
        <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t ? 'طلب شراء بالجملة' : 'Wholesale order'}</DialogTitle></DialogHeader>
            {selectedListing && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{listingName(selectedListing)}</p>
                  <p className="text-sm text-muted-foreground">{t ? 'من: ' : 'From: '}{selectedListing.merchant?.name}</p>
                  <p className="text-lg font-bold mt-1">{money(selectedListing.wholesale_price)}<span className="text-sm font-normal text-muted-foreground">{t ? ' / وحدة' : ' / unit'}</span></p>
                </div>
                <div>
                  <Label>{t ? 'الكمية' : 'Quantity'}</Label>
                  <Input type="number" min={selectedListing.min_quantity} value={orderQty} onChange={e => setOrderQty(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">{t ? `أقل كمية: ${selectedListing.min_quantity}` : `Minimum: ${selectedListing.min_quantity}`}</p>
                </div>
                <div><Label>{t ? 'طريقة الدفع' : 'Payment'}</Label>
                  <Select value={orderPaymentType} onValueChange={(v: 'cash' | 'credit') => setOrderPaymentType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t ? 'كاش / دفع فوري' : 'Cash'}</SelectItem>
                      <SelectItem value="credit">{t ? 'آجل / أمانة' : 'Credit'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {orderPaymentType === 'credit' && (
                  <>
                    <div><Label>{t ? 'نوع الآجل' : 'Credit type'}</Label>
                      <Select value={creditType} onValueChange={(v: 'invoice' | 'consignment') => setCreditType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invoice">{t ? 'آجل بفاتورة' : 'Invoice credit'}</SelectItem>
                          <SelectItem value="consignment">{t ? 'أمانة (تسليف)' : 'Consignment'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {creditType === 'invoice' && (
                      <div><Label>{t ? 'تاريخ الاستحقاق' : 'Due date'}</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
                    )}
                  </>
                )}
                {orderQty && (
                  <div className="text-center p-3 bg-primary/5 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t ? 'الإجمالي' : 'Total'}</p>
                    <p className="text-2xl font-bold text-primary">{money(selectedListing.wholesale_price * (parseInt(orderQty) || 0))}</p>
                  </div>
                )}
                <Button onClick={handleOrder} className="w-full" disabled={!orderQty || parseInt(orderQty) < selectedListing.min_quantity}>
                  <Send className="w-4 h-4 me-1" />{t ? 'إرسال الطلب' : 'Send order'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t ? 'تسجيل دفعة' : 'Record payment'}</DialogTitle></DialogHeader>
            {selectedCredit && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-1">
                  <p className="font-medium">{selectedCredit.buyer_merchant?.name || selectedCredit.supplier_merchant?.name}</p>
                  <p className="text-sm text-muted-foreground">{(t ? creditTypeAr : creditTypeEn)[selectedCredit.credit_type]}</p>
                  <div className="flex justify-between text-sm mt-2">
                    <span>{t ? 'المبلغ الكلي:' : 'Total:'}</span><span className="font-semibold">{money(selectedCredit.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t ? 'المتبقي:' : 'Remaining:'}</span><span className="font-semibold text-destructive">{money(selectedCredit.remaining_amount)}</span>
                  </div>
                </div>
                <div>
                  <Label>{t ? 'مبلغ الدفعة' : 'Payment amount'} ({t ? 'ر.س' : 'SAR'})</Label>
                  <Input type="number" max={selectedCredit.remaining_amount} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-0 h-auto mt-1"
                    onClick={() => setPaymentAmount(String(selectedCredit.remaining_amount))}
                  >
                    {t ? 'سداد المتبقي كاملاً' : 'Pay the full remainder'}
                  </Button>
                </div>
                <Button
                  onClick={handlePayment}
                  className="w-full"
                  disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > selectedCredit.remaining_amount}
                >
                  <Banknote className="w-4 h-4 me-1" />{t ? 'تسجيل الدفعة' : 'Record payment'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Package; text: string }) {
  return (
    <div className="py-14 text-center">
      <Icon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

// Buying vs selling — the two halves that used to be two sidebar entries each
function SideSwitch<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (next: T) => void;
  options: { key: T; label: string; count: number; dot?: boolean }[];
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
      {options.map(option => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={cn(
            'px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
            value === option.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
          <span className={cn(
            'text-[11px] tabular-nums px-1.5 rounded-full',
            value === option.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}>
            {option.count}
          </span>
          {option.dot && <span className="w-1.5 h-1.5 rounded-full bg-warning" aria-hidden />}
        </button>
      ))}
    </div>
  );
}
