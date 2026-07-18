import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLanguage } from '@/i18n';
import { useWholesale, WholesaleListing, CreditTransaction } from '@/hooks/useWholesale';
import { usePlanEnforcement } from '@/hooks/usePlanEnforcement';
import { useDevices, useAccessories } from '@/hooks/useInventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UrlTabs } from '@/components/common/UrlTabs';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, ShoppingCart, Store, Truck, Plus, Trash2, Eye, EyeOff, Send, CheckCircle, XCircle, Clock, Lock, Wallet, AlertTriangle, Banknote } from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-600',
  approved: 'bg-blue-500/15 text-blue-600',
  shipped: 'bg-purple-500/15 text-purple-600',
  delivered: 'bg-green-500/15 text-green-600',
  cancelled: 'bg-red-500/15 text-red-500',
};
const statusLabelsAr: Record<string, string> = { pending: 'بانتظار الموافقة', approved: 'تمت الموافقة', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
const creditStatusAr: Record<string, string> = { unpaid: 'غير مسدد', partial: 'مسدد جزئياً', paid: 'مسدد', returned: 'مرتجع' };
const creditTypeAr: Record<string, string> = { invoice: 'آجل بفاتورة', consignment: 'أمانة (تسليف)' };

export default function WholesalePage() {
  const { isRTL } = useLanguage();
  const { hasWholesale } = usePlanEnforcement();
  const { myListings, marketplace, myOrders, incomingOrders, myCredits, receivedCredits, loading, createListing, toggleListing, deleteListing, createOrder, updateOrderStatus, recordPayment, getCreditStats } = useWholesale();
  const { devices } = useDevices();
  const { accessories } = useAccessories();

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

  const t = isRTL;
  const stats = getCreditStats();
  const availableDevices = devices.filter(d => d.status === 'available');
  const availableAccessories = accessories.filter(a => a.quantity > 0);

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

  return (
    <AppLayout title={t ? 'بيع الجملة والتوريد' : 'Wholesale & Distribution'}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Package className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">{t ? 'منتجاتي' : 'My Listings'}</p><p className="text-xl font-bold">{myListings.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><Store className="w-5 h-5 text-green-500" /></div>
            <div><p className="text-xs text-muted-foreground">{t ? 'سوق الجملة' : 'Marketplace'}</p><p className="text-xl font-bold">{marketplace.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Wallet className="w-5 h-5 text-blue-500" /></div>
            <div><p className="text-xs text-muted-foreground">{t ? 'مديونيات لي' : 'Owed to Me'}</p><p className="text-xl font-bold">{stats.totalOwed.toLocaleString()} <span className="text-xs">{t ? 'ر.س' : 'SAR'}</span></p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10"><Banknote className="w-5 h-5 text-orange-500" /></div>
            <div><p className="text-xs text-muted-foreground">{t ? 'مديونياتي' : 'I Owe'}</p><p className="text-xl font-bold">{stats.totalOwing.toLocaleString()} <span className="text-xs">{t ? 'ر.س' : 'SAR'}</span></p></div>
          </CardContent></Card>
          {stats.overdueCount > 0 && (
            <Card className="border-destructive/30"><CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
              <div><p className="text-xs text-muted-foreground">{t ? 'متأخرة' : 'Overdue'}</p><p className="text-xl font-bold text-destructive">{stats.overdueCount}</p></div>
            </CardContent></Card>
          )}
        </div>

        <UrlTabs defaultTab="listings" className="space-y-4">

          {/* My Listings Tab */}
          <TabsContent value="listings">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t ? 'المنتجات المعروضة للبيع بالجملة' : 'Wholesale Products'}</CardTitle>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 me-1" />{t ? 'إضافة منتج' : 'Add'}</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t ? 'إضافة منتج للبيع بالجملة' : 'Add Wholesale Product'}</DialogTitle></DialogHeader>
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
                      <div><Label>{t ? 'سعر الجملة' : 'Wholesale Price'} (SAR)</Label><Input type="number" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} /></div>
                      <div><Label>{t ? 'الحد الأدنى' : 'Min Qty'}</Label><Input type="number" value={minQty} onChange={e => setMinQty(e.target.value)} /></div>
                      <Button onClick={handleAddListing} className="w-full">{t ? 'إضافة' : 'Add'}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                {myListings.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t ? 'لم تضف أي منتجات بعد' : 'No listings yet'}</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t ? 'المنتج' : 'Product'}</TableHead>
                      <TableHead>{t ? 'النوع' : 'Type'}</TableHead>
                      <TableHead>{t ? 'سعر الجملة' : 'Price'}</TableHead>
                      <TableHead>{t ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{t ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {myListings.map(listing => (
                        <TableRow key={listing.id}>
                          <TableCell className="font-medium">{listing.item_type === 'device' ? `${listing.device?.brand || ''} ${listing.device?.model || ''}` : listing.accessory?.name || '—'}</TableCell>
                          <TableCell><Badge variant="outline">{listing.item_type === 'device' ? (t ? 'جهاز' : 'Device') : (t ? 'إكسسوار' : 'Accessory')}</Badge></TableCell>
                          <TableCell>{listing.wholesale_price} {t ? 'ر.س' : 'SAR'}</TableCell>
                          <TableCell><Badge className={listing.is_active ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}>{listing.is_active ? (t ? 'نشط' : 'Active') : (t ? 'متوقف' : 'Off')}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => toggleListing(listing.id, !listing.is_active)}>{listing.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteListing(listing.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marketplace Tab */}
          <TabsContent value="marketplace">
            <Card>
              <CardHeader><CardTitle className="text-base">{t ? 'منتجات متاحة من موزعين' : 'Available Products'}</CardTitle></CardHeader>
              <CardContent className="p-0">
                {marketplace.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t ? 'لا توجد منتجات' : 'No products'}</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t ? 'الموزع' : 'Distributor'}</TableHead>
                      <TableHead>{t ? 'المنتج' : 'Product'}</TableHead>
                      <TableHead>{t ? 'السعر' : 'Price'}</TableHead>
                      <TableHead>{t ? 'طلب' : 'Order'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {marketplace.map(listing => (
                        <TableRow key={listing.id}>
                          <TableCell className="font-medium">{listing.merchant?.name || '—'}</TableCell>
                          <TableCell>{listing.item_type === 'device' ? `${listing.device?.brand || ''} ${listing.device?.model || ''}` : listing.accessory?.name || '—'}</TableCell>
                          <TableCell className="font-semibold">{listing.wholesale_price} {t ? 'ر.س' : 'SAR'}</TableCell>
                          <TableCell>
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
          </TabsContent>

          {/* My Orders Tab */}
          <TabsContent value="my-orders">
            <Card>
              <CardHeader><CardTitle className="text-base">{t ? 'طلباتي' : 'My Orders'}</CardTitle></CardHeader>
              <CardContent className="p-0">
                {myOrders.length === 0 ? <p className="text-center py-8 text-muted-foreground">{t ? 'لا توجد طلبات' : 'No orders'}</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t ? 'رقم' : '#'}</TableHead>
                      <TableHead>{t ? 'الموزع' : 'Distributor'}</TableHead>
                      <TableHead>{t ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead>{t ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{t ? 'التاريخ' : 'Date'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {myOrders.map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                          <TableCell>{order.supplier_merchant?.name || '—'}</TableCell>
                          <TableCell className="font-semibold">{order.total_amount} {t ? 'ر.س' : 'SAR'}</TableCell>
                          <TableCell><Badge className={statusColors[order.status] || 'bg-muted'}>{statusLabelsAr[order.status] || order.status}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString(t ? 'ar-SA' : 'en-US')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Incoming Orders Tab */}
          <TabsContent value="incoming">
            <Card>
              <CardHeader><CardTitle className="text-base">{t ? 'طلبات واردة' : 'Incoming Orders'}</CardTitle></CardHeader>
              <CardContent className="p-0">
                {incomingOrders.length === 0 ? <p className="text-center py-8 text-muted-foreground">{t ? 'لا توجد طلبات واردة' : 'No incoming orders'}</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t ? 'رقم' : '#'}</TableHead>
                      <TableHead>{t ? 'المشتري' : 'Buyer'}</TableHead>
                      <TableHead>{t ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead>{t ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{t ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {incomingOrders.map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                          <TableCell>{order.buyer_merchant?.name || '—'}</TableCell>
                          <TableCell className="font-semibold">{order.total_amount} {t ? 'ر.س' : 'SAR'}</TableCell>
                          <TableCell><Badge className={statusColors[order.status] || 'bg-muted'}>{statusLabelsAr[order.status] || order.status}</Badge></TableCell>
                          <TableCell>
                            {order.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, 'approved')}><CheckCircle className="w-3 h-3 me-1" />{t ? 'قبول' : 'Accept'}</Button>
                                <Button size="sm" variant="destructive" onClick={() => updateOrderStatus(order.id, 'cancelled')}><XCircle className="w-3 h-3" /></Button>
                              </div>
                            )}
                            {order.status === 'approved' && <Button size="sm" onClick={() => updateOrderStatus(order.id, 'shipped')}><Truck className="w-3 h-3 me-1" />{t ? 'شحن' : 'Ship'}</Button>}
                            {order.status === 'shipped' && <Badge className="bg-purple-500/15 text-purple-600"><Clock className="w-3 h-3 me-1" />{t ? 'بانتظار التسليم' : 'Shipping'}</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credits Out (owed to me) */}
          <TabsContent value="credits-out">
            <Card>
              <CardHeader><CardTitle className="text-base">{t ? 'مديونيات لي (آجل وأمانات)' : 'Credits Owed to Me'}</CardTitle></CardHeader>
              <CardContent className="p-0">
                {myCredits.length === 0 ? <p className="text-center py-8 text-muted-foreground">{t ? 'لا توجد مديونيات' : 'No credits'}</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t ? 'المحل' : 'Store'}</TableHead>
                      <TableHead>{t ? 'النوع' : 'Type'}</TableHead>
                      <TableHead>{t ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead>{t ? 'المسدد' : 'Paid'}</TableHead>
                      <TableHead>{t ? 'المتبقي' : 'Remaining'}</TableHead>
                      <TableHead>{t ? 'الاستحقاق' : 'Due'}</TableHead>
                      <TableHead>{t ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{t ? 'تسديد' : 'Collect'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {myCredits.map(credit => {
                        const isOverdue = credit.due_date && new Date(credit.due_date) < new Date() && credit.status !== 'paid';
                        return (
                          <TableRow key={credit.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                            <TableCell className="font-medium">{credit.buyer_merchant?.name || '—'}</TableCell>
                            <TableCell><Badge variant="outline">{creditTypeAr[credit.credit_type]}</Badge></TableCell>
                            <TableCell>{credit.amount.toLocaleString()} {t ? 'ر.س' : 'SAR'}</TableCell>
                            <TableCell className="text-green-600">{credit.paid_amount.toLocaleString()}</TableCell>
                            <TableCell className="font-semibold text-destructive">{credit.remaining_amount.toLocaleString()}</TableCell>
                            <TableCell className="text-sm">
                              {credit.due_date ? (
                                <span className={isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                                  {new Date(credit.due_date).toLocaleDateString(t ? 'ar-SA' : 'en-US')}
                                  {isOverdue && <AlertTriangle className="w-3 h-3 inline ms-1" />}
                                </span>
                              ) : '—'}
                            </TableCell>
                            <TableCell><Badge className={credit.status === 'paid' ? 'bg-green-500/15 text-green-600' : credit.status === 'partial' ? 'bg-yellow-500/15 text-yellow-600' : 'bg-red-500/15 text-red-500'}>{creditStatusAr[credit.status]}</Badge></TableCell>
                            <TableCell>
                              {credit.status !== 'paid' && (
                                <Button size="sm" variant="outline" onClick={() => { setSelectedCredit(credit); setPaymentAmount(''); setShowPaymentDialog(true); }}>
                                  <Banknote className="w-3 h-3 me-1" />{t ? 'تسديد' : 'Pay'}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credits In (I owe) */}
          <TabsContent value="credits-in">
            <Card>
              <CardHeader><CardTitle className="text-base">{t ? 'مديونياتي (اللي عليّ)' : 'What I Owe'}</CardTitle></CardHeader>
              <CardContent className="p-0">
                {receivedCredits.length === 0 ? <p className="text-center py-8 text-muted-foreground">{t ? 'لا توجد مديونيات' : 'No debts'}</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t ? 'الموزع' : 'Distributor'}</TableHead>
                      <TableHead>{t ? 'النوع' : 'Type'}</TableHead>
                      <TableHead>{t ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead>{t ? 'المسدد' : 'Paid'}</TableHead>
                      <TableHead>{t ? 'المتبقي' : 'Remaining'}</TableHead>
                      <TableHead>{t ? 'الاستحقاق' : 'Due'}</TableHead>
                      <TableHead>{t ? 'الحالة' : 'Status'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {receivedCredits.map(credit => {
                        const isOverdue = credit.due_date && new Date(credit.due_date) < new Date() && credit.status !== 'paid';
                        return (
                          <TableRow key={credit.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                            <TableCell className="font-medium">{credit.supplier_merchant?.name || '—'}</TableCell>
                            <TableCell><Badge variant="outline">{creditTypeAr[credit.credit_type]}</Badge></TableCell>
                            <TableCell>{credit.amount.toLocaleString()} {t ? 'ر.س' : 'SAR'}</TableCell>
                            <TableCell className="text-green-600">{credit.paid_amount.toLocaleString()}</TableCell>
                            <TableCell className="font-semibold text-destructive">{credit.remaining_amount.toLocaleString()}</TableCell>
                            <TableCell className="text-sm">
                              {credit.due_date ? (
                                <span className={isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                                  {new Date(credit.due_date).toLocaleDateString(t ? 'ar-SA' : 'en-US')}
                                  {isOverdue && <AlertTriangle className="w-3 h-3 inline ms-1" />}
                                </span>
                              ) : '—'}
                            </TableCell>
                            <TableCell><Badge className={credit.status === 'paid' ? 'bg-green-500/15 text-green-600' : credit.status === 'partial' ? 'bg-yellow-500/15 text-yellow-600' : 'bg-red-500/15 text-red-500'}>{creditStatusAr[credit.status]}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </UrlTabs>

        {/* Order Dialog with Credit option */}
        <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t ? 'طلب شراء بالجملة' : 'Wholesale Order'}</DialogTitle></DialogHeader>
            {selectedListing && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedListing.item_type === 'device' ? `${selectedListing.device?.brand} ${selectedListing.device?.model}` : selectedListing.accessory?.name}</p>
                  <p className="text-sm text-muted-foreground">{t ? 'من:' : 'From:'} {selectedListing.merchant?.name}</p>
                  <p className="text-lg font-bold mt-1">{selectedListing.wholesale_price} {t ? 'ر.س/وحدة' : 'SAR/unit'}</p>
                </div>
                <div><Label>{t ? 'الكمية' : 'Quantity'}</Label><Input type="number" min={selectedListing.min_quantity} value={orderQty} onChange={e => setOrderQty(e.target.value)} /></div>
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
                    <div><Label>{t ? 'نوع الآجل' : 'Credit Type'}</Label>
                      <Select value={creditType} onValueChange={(v: 'invoice' | 'consignment') => setCreditType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invoice">{t ? 'آجل بفاتورة' : 'Invoice Credit'}</SelectItem>
                          <SelectItem value="consignment">{t ? 'أمانة (تسليف)' : 'Consignment'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {creditType === 'invoice' && (
                      <div><Label>{t ? 'تاريخ الاستحقاق' : 'Due Date'}</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
                    )}
                  </>
                )}
                {orderQty && (
                  <div className="text-center p-3 bg-primary/5 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t ? 'الإجمالي' : 'Total'}</p>
                    <p className="text-2xl font-bold text-primary">{(selectedListing.wholesale_price * parseInt(orderQty || '0')).toLocaleString()} {t ? 'ر.س' : 'SAR'}</p>
                  </div>
                )}
                <Button onClick={handleOrder} className="w-full" disabled={!orderQty || parseInt(orderQty) < selectedListing.min_quantity}>
                  <Send className="w-4 h-4 me-1" />{t ? 'إرسال الطلب' : 'Send Order'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t ? 'تسجيل دفعة' : 'Record Payment'}</DialogTitle></DialogHeader>
            {selectedCredit && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-1">
                  <p className="font-medium">{selectedCredit.buyer_merchant?.name}</p>
                  <p className="text-sm text-muted-foreground">{creditTypeAr[selectedCredit.credit_type]}</p>
                  <div className="flex justify-between text-sm mt-2">
                    <span>{t ? 'المبلغ الكلي:' : 'Total:'}</span><span className="font-semibold">{selectedCredit.amount.toLocaleString()} {t ? 'ر.س' : 'SAR'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t ? 'المتبقي:' : 'Remaining:'}</span><span className="font-semibold text-destructive">{selectedCredit.remaining_amount.toLocaleString()} {t ? 'ر.س' : 'SAR'}</span>
                  </div>
                </div>
                <div><Label>{t ? 'مبلغ الدفعة' : 'Payment Amount'} (SAR)</Label><Input type="number" max={selectedCredit.remaining_amount} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
                <Button onClick={handlePayment} className="w-full" disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}>
                  <Banknote className="w-4 h-4 me-1" />{t ? 'تسجيل الدفعة' : 'Record Payment'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
