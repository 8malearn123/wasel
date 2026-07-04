import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Building2, Users, Smartphone, Package, ShoppingCart,
  Wrench, Loader2, Shield, ShieldOff, DollarSign, MapPin,
  Phone, Mail, Calendar, Crown, ShieldCheck, Store, Wallet, KeyRound,
  CheckCircle, XCircle, Globe, Activity, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useMerchantDetail } from '@/hooks/useMerchantDetail';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const roleLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  owner: { label: 'مالك', icon: <Crown className="w-3 h-3" />, color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  admin: { label: 'مدير', icon: <ShieldCheck className="w-3 h-3" />, color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
  branch_manager: { label: 'مدير فرع', icon: <Store className="w-3 h-3" />, color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  cashier: { label: 'كاشير', icon: <Wallet className="w-3 h-3" />, color: 'bg-green-500/10 text-green-700 border-green-500/20' },
  inventory_manager: { label: 'مدير مخزون', icon: <KeyRound className="w-3 h-3" />, color: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20' },
};

const deviceStatusLabels: Record<string, { label: string; color: string }> = {
  available: { label: 'متوفر', color: 'bg-green-500/10 text-green-700' },
  reserved: { label: 'محجوز', color: 'bg-amber-500/10 text-amber-700' },
  sold: { label: 'مباع', color: 'bg-blue-500/10 text-blue-700' },
  transferred: { label: 'منقول', color: 'bg-purple-500/10 text-purple-700' },
  repair: { label: 'صيانة', color: 'bg-red-500/10 text-red-700' },
};

const repairStatusLabels: Record<string, { label: string; color: string }> = {
  received: { label: 'مستلم', color: 'bg-blue-500/10 text-blue-700' },
  diagnosing: { label: 'فحص', color: 'bg-purple-500/10 text-purple-700' },
  waiting_parts: { label: 'بانتظار قطع', color: 'bg-amber-500/10 text-amber-700' },
  in_progress: { label: 'جاري', color: 'bg-cyan-500/10 text-cyan-700' },
  completed: { label: 'مكتمل', color: 'bg-green-500/10 text-green-700' },
  delivered: { label: 'مسلّم', color: 'bg-emerald-500/10 text-emerald-700' },
  warranty_expired: { label: 'انتهى الضمان', color: 'bg-gray-500/10 text-gray-600' },
  cancelled: { label: 'ملغي', color: 'bg-red-500/10 text-red-700' },
};

const onlineStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'معلق', color: 'bg-warning/15 text-warning' },
  confirmed: { label: 'مؤكد', color: 'bg-primary/15 text-primary' },
  processing: { label: 'قيد التجهيز', color: 'bg-cyan-500/10 text-cyan-700' },
  shipped: { label: 'تم الشحن', color: 'bg-blue-500/10 text-blue-700' },
  delivered: { label: 'مسلّم', color: 'bg-green-500/10 text-green-700' },
  cancelled: { label: 'ملغي', color: 'bg-red-500/10 text-red-700' },
};

const subStatusLabels: Record<string, { label: string; color: string }> = {
  trial: { label: 'تجريبي', color: 'bg-amber-500/10 text-amber-700' },
  active: { label: 'نشط', color: 'bg-green-500/10 text-green-700' },
  expired: { label: 'منتهي', color: 'bg-red-500/10 text-red-700' },
  cancelled: { label: 'موقوف', color: 'bg-gray-500/10 text-gray-600' },
};

const actionLabels: Record<string, string> = {
  branch_activated: 'تفعيل فرع',
  device_added: 'إضافة جهاز',
  device_sold: 'بيع جهاز',
  sale_created: 'إنشاء فاتورة',
  repair_created: 'إنشاء إصلاح',
  transfer_created: 'إنشاء تحويل',
  user_created: 'إضافة مستخدم',
};

export default function MerchantDetailPage() {
  const { merchantId } = useParams();
  const navigate = useNavigate();
  const {
    merchant, subscription, branches, users,
    devices, accessories, sales, repairs,
    onlineOrders, activityLogs,
    loading, totalSalesAmount, totalOnlineAmount,
    totalDevices, availableDevices, activeRepairs,
    lowStockAccessories, inventoryValue,
  } = useMerchantDetail(merchantId);

  if (loading) {
    return (
      <AppLayout title="تفاصيل الشركة" subtitle="">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!merchant) {
    return (
      <AppLayout title="الشركة غير موجودة" subtitle="">
        <div className="text-center py-20">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">لم يتم العثور على الشركة</p>
          <Button onClick={() => navigate('/platform-admin')}>
            <ArrowRight className="w-4 h-4 ml-2" /> العودة
          </Button>
        </div>
      </AppLayout>
    );
  }

  const subStatus = subStatusLabels[subscription?.status || ''] || { label: subscription?.status || '—', color: 'bg-muted text-muted-foreground' };

  return (
    <AppLayout title={merchant.name} subtitle="عرض تفصيلي لبيانات الشركة">
      {/* Back + Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/platform-admin')} className="mb-4">
          <ArrowRight className="w-4 h-4 ml-1" /> العودة لإدارة المنصة
        </Button>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{merchant.name}</h2>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {merchant.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{merchant.email}</span>}
                  {merchant.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{merchant.phone}</span>}
                  {merchant.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{merchant.address}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> انضم {format(new Date(merchant.created_at), 'dd MMM yyyy', { locale: ar })}</span>
                </div>
                {(merchant.bank_name || merchant.iban) && (
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {merchant.bank_name && <span>🏦 {merchant.bank_name}</span>}
                    {merchant.iban && <span className="font-mono">{merchant.iban}</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {subscription && (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn("text-sm", subStatus.color)}>{subStatus.label}</Badge>
                  <span className="text-sm font-medium text-foreground">{subscription.plan}</span>
                </div>
              )}
              {merchant.platform_fee_percentage != null && (
                <span className="text-xs text-muted-foreground">عمولة المنصة: {merchant.platform_fee_percentage}%</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats - 7 columns */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 mb-6">
        {[
          { icon: Store, label: 'الفروع', value: branches.length, sub: `/${subscription?.max_branches || '∞'}`, color: 'text-primary' },
          { icon: Users, label: 'المستخدمين', value: users.length, sub: `/${subscription?.max_users || '∞'}`, color: 'text-purple-600' },
          { icon: Smartphone, label: 'الأجهزة', value: `${availableDevices}/${totalDevices}`, sub: '', color: 'text-cyan-600' },
          { icon: DollarSign, label: 'مبيعات محلية', value: totalSalesAmount.toLocaleString(), sub: ' ر.س', color: 'text-green-600' },
          { icon: Globe, label: 'مبيعات أونلاين', value: totalOnlineAmount.toLocaleString(), sub: ' ر.س', color: 'text-primary' },
          { icon: Wrench, label: 'إصلاحات نشطة', value: activeRepairs, sub: '', color: 'text-amber-600' },
          { icon: TrendingUp, label: 'قيمة المخزون', value: inventoryValue.toLocaleString(), sub: ' ر.س', color: 'text-primary' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-3 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{stat.value}<span className="text-xs font-normal text-muted-foreground">{stat.sub}</span></p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sales" dir="rtl">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="sales" className="gap-1.5"><ShoppingCart className="w-4 h-4" />المبيعات <Badge variant="secondary" className="mr-1 text-xs">{sales.length}</Badge></TabsTrigger>
          <TabsTrigger value="online" className="gap-1.5"><Globe className="w-4 h-4" />أونلاين <Badge variant="secondary" className="mr-1 text-xs">{onlineOrders.length}</Badge></TabsTrigger>
          <TabsTrigger value="devices" className="gap-1.5"><Smartphone className="w-4 h-4" />الأجهزة <Badge variant="secondary" className="mr-1 text-xs">{devices.length}</Badge></TabsTrigger>
          <TabsTrigger value="accessories" className="gap-1.5"><Package className="w-4 h-4" />الإكسسوارات <Badge variant="secondary" className="mr-1 text-xs">{accessories.length}</Badge></TabsTrigger>
          <TabsTrigger value="repairs" className="gap-1.5"><Wrench className="w-4 h-4" />الإصلاحات <Badge variant="secondary" className="mr-1 text-xs">{repairs.length}</Badge></TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><Users className="w-4 h-4" />الفريق</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity className="w-4 h-4" />النشاط</TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {sales.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>لا توجد مبيعات</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الفاتورة</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الدفع</TableHead>
                      <TableHead>طريقة الدفع</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">{sale.invoice_number}</TableCell>
                        <TableCell>{sale.customer_name || '—'}</TableCell>
                        <TableCell className="font-semibold">{sale.total_amount.toLocaleString()} ر.س</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={sale.payment_status === 'paid' ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-700'}>
                            {sale.payment_status === 'paid' ? 'مدفوع' : sale.payment_status === 'partial' ? 'جزئي' : 'غير مدفوع'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sale.payment_method === 'cash' ? 'نقد' : sale.payment_method === 'card' ? 'بطاقة' : sale.payment_method === 'bank_transfer' ? 'تحويل' : sale.payment_method}
                        </TableCell>
                        <TableCell>{(sale.branch as any)?.name || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(sale.sale_date), 'dd/MM/yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Online Orders Tab */}
        <TabsContent value="online">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {onlineOrders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><Globe className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>لا توجد طلبات أونلاين</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>المدينة</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الدفع</TableHead>
                      <TableHead>الشحن</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {onlineOrders.map((order) => {
                      const os = onlineStatusLabels[order.status || ''] || { label: order.status || '—', color: 'bg-muted text-muted-foreground' };
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                          <TableCell>
                            <div>{order.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
                          </TableCell>
                          <TableCell>{order.shipping_city}</TableCell>
                          <TableCell className="font-semibold">{Number(order.total_amount || 0).toLocaleString()} ر.س</TableCell>
                          <TableCell><Badge variant="outline" className={os.color}>{os.label}</Badge></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={order.payment_status === 'paid' ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-700'}>
                              {order.payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {order.shipping_provider || '—'}
                            {order.tracking_number && <div className="font-mono text-muted-foreground">{order.tracking_number}</div>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy') : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {devices.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><Smartphone className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>لا توجد أجهزة</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IMEI</TableHead>
                      <TableHead>الجهاز</TableHead>
                      <TableHead>التخزين</TableHead>
                      <TableHead>التكلفة</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الفرع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => {
                      const st = deviceStatusLabels[device.status] || { label: device.status, color: 'bg-muted text-muted-foreground' };
                      return (
                        <TableRow key={device.id}>
                          <TableCell className="font-mono text-xs">{device.imei}</TableCell>
                          <TableCell>{device.brand} {device.model} {device.color && <span className="text-muted-foreground">({device.color})</span>}</TableCell>
                          <TableCell>{device.storage || '—'}</TableCell>
                          <TableCell className="text-sm">{Number(device.cost).toLocaleString()} ر.س</TableCell>
                          <TableCell className="font-semibold text-sm">{Number(device.price).toLocaleString()} ر.س</TableCell>
                          <TableCell><Badge variant="outline" className={st.color}>{st.label}</Badge></TableCell>
                          <TableCell>{(device.branch as any)?.name || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Accessories Tab */}
        <TabsContent value="accessories">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {accessories.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><Package className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>لا توجد إكسسوارات</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>المنتج</TableHead>
                      <TableHead>الفئة</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>الحد الأدنى</TableHead>
                      <TableHead>التكلفة</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>الفرع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessories.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-mono text-xs">{acc.sku}</TableCell>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell>{acc.category || '—'}</TableCell>
                        <TableCell className={cn("font-semibold", acc.quantity <= (acc.min_quantity || 5) && "text-destructive")}>
                          {acc.quantity}
                          {acc.quantity <= (acc.min_quantity || 5) && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{acc.min_quantity || 5}</TableCell>
                        <TableCell className="text-sm">{Number(acc.cost).toLocaleString()} ر.س</TableCell>
                        <TableCell className="font-semibold text-sm">{Number(acc.price).toLocaleString()} ر.س</TableCell>
                        <TableCell>{(acc.branch as any)?.name || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Repairs Tab */}
        <TabsContent value="repairs">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {repairs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>لا توجد طلبات إصلاح</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الإصلاح</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الجهاز</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التكلفة</TableHead>
                      <TableHead>الضمان</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repairs.map((repair) => {
                      const rs = repairStatusLabels[repair.status] || { label: repair.status, color: 'bg-muted text-muted-foreground' };
                      const warrantyActive = repair.warranty_ends_at && new Date(repair.warranty_ends_at) > new Date();
                      return (
                        <TableRow key={repair.id}>
                          <TableCell className="font-mono text-sm">{repair.repair_number}</TableCell>
                          <TableCell>
                            <div>{repair.customer_name}</div>
                            {repair.customer_phone && <div className="text-xs text-muted-foreground">{repair.customer_phone}</div>}
                          </TableCell>
                          <TableCell>{repair.device_brand} {repair.device_model || repair.device_type}</TableCell>
                          <TableCell><Badge variant="outline" className={rs.color}>{rs.label}</Badge></TableCell>
                          <TableCell className="text-sm">{Number(repair.actual_cost || repair.estimated_cost || 0).toLocaleString()} ر.س</TableCell>
                          <TableCell>
                            {repair.warranty_days ? (
                              <div className="flex items-center gap-1">
                                {warrantyActive ? <Shield className="w-3.5 h-3.5 text-green-600" /> : <ShieldOff className="w-3.5 h-3.5 text-gray-400" />}
                                <span className="text-xs">{repair.warranty_days} يوم</span>
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell>{(repair.branch as any)?.name || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(repair.received_at), 'dd/MM/yyyy')}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Branches */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Store className="w-5 h-5 text-primary" /> الفروع ({branches.length})</h3>
              <div className="space-y-3">
                {branches.map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        {branch.is_warehouse ? <Package className="w-4 h-4 text-primary" /> : <Store className="w-4 h-4 text-primary" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{branch.name}</p>
                        {branch.address && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{branch.address}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {branch.is_warehouse && <Badge variant="outline" className="text-xs">مستودع</Badge>}
                      {branch.is_active ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-destructive" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Users */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> المستخدمين ({users.length})</h3>
              <div className="space-y-3">
                {users.map((u) => {
                  const role = roleLabels[u.role] || { label: u.role, icon: null, color: 'bg-muted text-muted-foreground' };
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {(u.profile?.full_name || '?')[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.profile?.full_name || 'بدون اسم'}</p>
                          {u.branch && <p className="text-xs text-muted-foreground">{(u.branch as any)?.name}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("flex items-center gap-1 text-xs", role.color)}>
                          {role.icon} {role.label}
                        </Badge>
                        {!u.is_active && <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">معطل</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {activityLogs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><Activity className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>لا يوجد نشاط مسجل</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الإجراء</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {actionLabels[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.entity_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
