import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Truck, Plus, Loader2, MoreHorizontal, Edit, Trash2, Phone, Mail,
  DollarSign, FileText, Package, CheckCircle2, Clock, Send, Eye,
  AlertTriangle, ArrowRight, CreditCard, PackageCheck, Printer
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/useTabParam";
import { SearchableSelect } from '@/components/common/SearchableSelect';

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useSuppliers, usePurchaseOrders } from "@/hooks/useSuppliers";
import { useDevices, useAccessories } from "@/hooks/useInventory";
import type { Supplier, PurchaseOrder, PurchaseStatus } from "@/types/database";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; labelAr: string; color: string }> = {
  draft: { label: 'Draft', labelAr: 'مسودة', color: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pending', labelAr: 'معلق', color: 'bg-warning/10 text-warning border-warning/30' },
  approved: { label: 'Approved', labelAr: 'معتمد', color: 'bg-primary/10 text-primary border-primary/30' },
  received: { label: 'Received', labelAr: 'تم الاستلام', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  cancelled: { label: 'Cancelled', labelAr: 'ملغي', color: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const paymentStatusConfig: Record<string, { label: string; labelAr: string; color: string }> = {
  unpaid: { label: 'Unpaid', labelAr: 'غير مدفوع', color: 'bg-destructive/10 text-destructive' },
  partial: { label: 'Partial', labelAr: 'جزئي', color: 'bg-warning/10 text-warning' },
  paid: { label: 'Paid', labelAr: 'مدفوع', color: 'bg-green-500/10 text-green-600' },
};

export default function SuppliersPage({ mode = 'suppliers' }: { mode?: 'suppliers' | 'purchases' }) {
  const [activeTab, setActiveTab] = useTabParam(mode === 'purchases' ? 'orders' : 'suppliers');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [showReceive, setShowReceive] = useState<PurchaseOrder | null>(null);
  const [showPayment, setShowPayment] = useState<PurchaseOrder | null>(null);
  const [showPODetails, setShowPODetails] = useState<PurchaseOrder | null>(null);
  const { t, isRTL } = useLanguage();
  const { suppliers, loading: suppliersLoading, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { orders, loading: ordersLoading, createPurchaseOrder, updateOrderStatus, recordPayment, receivePurchase } = usePurchaseOrders();
  const { devices } = useDevices();
  const { accessories } = useAccessories();

  const activeSuppliers = suppliers.filter(s => s.is_active);

  // Calculate amounts owed per supplier from unpaid/partial purchase orders
  const supplierDebts = useMemo(() => {
    const debts: Record<string, { totalOwed: number; ordersCount: number }> = {};
    orders.forEach(order => {
      if (order.payment_status !== 'paid' && order.status !== 'cancelled') {
        const remaining = Number(order.total_amount) - Number(order.paid_amount);
        if (remaining > 0) {
          if (!debts[order.supplier_id]) debts[order.supplier_id] = { totalOwed: 0, ordersCount: 0 };
          debts[order.supplier_id].totalOwed += remaining;
          debts[order.supplier_id].ordersCount += 1;
        }
      }
    });
    return debts;
  }, [orders]);

  const totalOwed = Object.values(supplierDebts).reduce((s, d) => s + d.totalOwed, 0);
  const unpaidOrdersCount = orders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled').length;
  const pendingReceiveCount = orders.filter(o => o.status === 'approved' || o.status === 'pending').length;

  const filteredSuppliers = activeSuppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout
      title={mode === 'purchases'
        ? (isRTL ? 'المشتريات' : 'Purchases')
        : (isRTL ? 'الموردين وأوامر الشراء' : 'Suppliers & Purchase Orders')}
      subtitle={mode === 'purchases'
        ? (isRTL ? 'إدارة أوامر الشراء والمدفوعات واستلام البضاعة' : 'Manage purchase orders, payments & receiving')
        : (isRTL ? 'إدارة الموردين والمشتريات والمديونيات' : 'Manage suppliers, purchases & debts')}>
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <StatCard icon={Truck} value={activeSuppliers.length} label={isRTL ? 'الموردين النشطين' : 'Active Suppliers'} color="primary" delay={0} />
        <StatCard icon={FileText} value={orders.length} label={isRTL ? 'أوامر الشراء' : 'Purchase Orders'} color="primary" delay={0.05} />
        <StatCard icon={DollarSign} value={`${totalOwed.toLocaleString()} ر.س`} label={isRTL ? 'إجمالي المديونيات' : 'Total Owed'} color="destructive" delay={0.1} />
        <StatCard icon={PackageCheck} value={pendingReceiveCount} label={isRTL ? 'بانتظار الاستلام' : 'Pending Receive'} color="warning" delay={0.15} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Suppliers Tab */}
        <TabsContent value="suppliers">
          <div className="flex justify-between items-center mb-4">
            <Input placeholder={isRTL ? 'بحث عن مورد...' : 'Search suppliers...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-64" />
            <Button className="gap-2 bg-gradient-primary hover:opacity-90" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4" />
              {isRTL ? 'إضافة مورد' : 'Add Supplier'}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliersLoading ? (
              <div className="col-span-full flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="col-span-full text-center py-20 bg-card rounded-xl border border-border">
                <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{isRTL ? 'لا يوجد موردين' : 'No suppliers found'}</p>
                <Button className="mt-4" onClick={() => setShowAdd(true)}>{isRTL ? 'أضف أول مورد' : 'Add your first supplier'}</Button>
              </div>
            ) : (
              filteredSuppliers.map((supplier, index) => {
                const debt = supplierDebts[supplier.id];
                return (
                  <motion.div key={supplier.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                    className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Truck className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{supplier.name}</h3>
                          {supplier.contact_name && <p className="text-sm text-muted-foreground">{supplier.contact_name}</p>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(supplier)}><Edit className="w-4 h-4 mr-2" /> {isRTL ? 'تعديل' : 'Edit'}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteSupplier(supplier.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> {isRTL ? 'حذف' : 'Remove'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-3 space-y-1">
                      {supplier.phone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5" />{supplier.phone}</div>}
                      {supplier.email && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="w-3.5 h-3.5" />{supplier.email}</div>}
                    </div>
                    {debt && debt.totalOwed > 0 && (
                      <div className="mt-3 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-destructive font-medium">{isRTL ? 'مستحقات' : 'Owed'} ({debt.ordersCount} {isRTL ? 'طلب' : 'orders'})</span>
                          <span className="font-bold text-destructive">{debt.totalOwed.toLocaleString()} {isRTL ? 'ر.س' : 'SAR'}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Purchase Orders Tab */}
        <TabsContent value="orders">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-foreground">{isRTL ? 'أوامر الشراء' : 'Purchase Orders'}</h3>
            <Button className="gap-2 bg-gradient-primary hover:opacity-90" onClick={() => setShowCreatePO(true)} disabled={activeSuppliers.length === 0}>
              <Plus className="w-4 h-4" />
              {isRTL ? 'طلب شراء جديد' : 'New Purchase Order'}
            </Button>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{isRTL ? 'لا توجد أوامر شراء' : 'No purchase orders yet'}</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'رقم الطلب' : 'Order #'}</TableHead>
                    <TableHead>{isRTL ? 'المورد' : 'Supplier'}</TableHead>
                    <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                    <TableHead>{isRTL ? 'المدفوع' : 'Paid'}</TableHead>
                    <TableHead>{isRTL ? 'المتبقي' : 'Remaining'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'الدفع' : 'Payment'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(order => {
                    const remaining = Number(order.total_amount) - Number(order.paid_amount);
                    const sc = statusConfig[order.status] || statusConfig.draft;
                    const pc = paymentStatusConfig[order.payment_status] || paymentStatusConfig.unpaid;
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.supplier?.name || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(order.order_date).toLocaleDateString('ar-SA')}</TableCell>
                        <TableCell className="font-semibold">{Number(order.total_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-green-600">{Number(order.paid_amount).toLocaleString()}</TableCell>
                        <TableCell className={remaining > 0 ? 'text-destructive font-semibold' : 'text-green-600'}>{remaining.toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className={sc.color}>{isRTL ? sc.labelAr : sc.label}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={pc.color}>{isRTL ? pc.labelAr : pc.label}</Badge></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setShowPODetails(order)}>
                                <Eye className="w-4 h-4 mr-2" /> {isRTL ? 'التفاصيل' : 'Details'}
                              </DropdownMenuItem>
                              {order.status === 'draft' && (
                                <DropdownMenuItem onClick={() => updateOrderStatus(order.id, 'pending')}>
                                  <Send className="w-4 h-4 mr-2" /> {isRTL ? 'إرسال للمورد' : 'Send to Supplier'}
                                </DropdownMenuItem>
                              )}
                              {(order.status === 'pending' || order.status === 'approved') && (
                                <DropdownMenuItem onClick={() => setShowReceive(order)}>
                                  <PackageCheck className="w-4 h-4 mr-2" /> {isRTL ? 'استلام وجرد' : 'Receive & Inspect'}
                                </DropdownMenuItem>
                              )}
                              {order.payment_status !== 'paid' && order.status !== 'cancelled' && (
                                <DropdownMenuItem onClick={() => setShowPayment(order)}>
                                  <CreditCard className="w-4 h-4 mr-2" /> {isRTL ? 'تسجيل دفعة' : 'Record Payment'}
                                </DropdownMenuItem>
                              )}
                              {order.status === 'draft' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => updateOrderStatus(order.id, 'cancelled')}>
                                    <Trash2 className="w-4 h-4 mr-2" /> {isRTL ? 'إلغاء' : 'Cancel'}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Debts Tab */}
        <TabsContent value="debts">
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                <div>
                  <p className="font-semibold text-foreground">{isRTL ? 'إجمالي المبالغ المستحقة للموردين' : 'Total Amounts Owed to Suppliers'}</p>
                  <p className="text-sm text-muted-foreground">{unpaidOrdersCount} {isRTL ? 'طلب غير مسدد' : 'unpaid orders'}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-destructive">{totalOwed.toLocaleString()} {isRTL ? 'ر.س' : 'SAR'}</p>
            </div>

            {activeSuppliers.filter(s => supplierDebts[s.id]?.totalOwed > 0).length === 0 ? (
              <div className="text-center py-16 bg-card rounded-xl border border-border">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">{isRTL ? 'لا توجد مديونيات مستحقة' : 'No outstanding debts'}</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'المورد' : 'Supplier'}</TableHead>
                      <TableHead>{isRTL ? 'عدد الطلبات' : 'Orders'}</TableHead>
                      <TableHead>{isRTL ? 'المبلغ المستحق' : 'Amount Owed'}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSuppliers
                      .filter(s => supplierDebts[s.id]?.totalOwed > 0)
                      .sort((a, b) => (supplierDebts[b.id]?.totalOwed || 0) - (supplierDebts[a.id]?.totalOwed || 0))
                      .map(supplier => {
                        const debt = supplierDebts[supplier.id];
                        return (
                          <TableRow key={supplier.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Truck className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{supplier.name}</p>
                                  {supplier.phone && <p className="text-xs text-muted-foreground">{supplier.phone}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline">{debt.ordersCount}</Badge></TableCell>
                            <TableCell className="text-destructive font-bold text-lg">{debt.totalOwed.toLocaleString()} {isRTL ? 'ر.س' : 'SAR'}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => { setActiveTab('orders'); }}>
                                <Eye className="w-4 h-4 mr-1" /> {isRTL ? 'عرض الطلبات' : 'View Orders'}
                              </Button>
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
      </Tabs>

      {/* Dialogs */}
      <SupplierDialog open={showAdd || !!editing} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditing(null); } }}
        supplier={editing} onSave={async (data) => { if (editing) await updateSupplier(editing.id, data); else await addSupplier(data as any); }} isRTL={isRTL} />

      <CreatePODialog open={showCreatePO} onOpenChange={setShowCreatePO} suppliers={activeSuppliers}
        devices={devices} accessories={accessories}
        onSave={createPurchaseOrder} isRTL={isRTL} />

      <ReceiveDialog open={!!showReceive} onOpenChange={(open) => { if (!open) setShowReceive(null); }}
        order={showReceive} onReceive={receivePurchase} isRTL={isRTL} />

      <PaymentDialog open={!!showPayment} onOpenChange={(open) => { if (!open) setShowPayment(null); }}
        order={showPayment} onPay={recordPayment} isRTL={isRTL} />

      <PODetailsDialog open={!!showPODetails} onOpenChange={(open) => { if (!open) setShowPODetails(null); }}
        order={showPODetails} isRTL={isRTL} />
    </AppLayout>
  );
}

// --- Stat Card ---
function StatCard({ icon: Icon, value, label, color, delay }: { icon: any; value: any; label: string; color: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="p-4 rounded-xl bg-card border border-border shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-${color}/10 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 text-${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

// --- Supplier Dialog ---
function SupplierDialog({ open, onOpenChange, supplier, onSave, isRTL }: { open: boolean; onOpenChange: (o: boolean) => void; supplier?: Supplier | null; onSave: (d: Partial<Supplier>) => Promise<void>; isRTL: boolean }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '' });

  const handleOpen = () => {
    if (supplier) setFormData({ name: supplier.name, contact_name: supplier.contact_name || '', phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '', notes: supplier.notes || '' });
    else setFormData({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) handleOpen(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader><DialogTitle>{supplier ? (isRTL ? 'تعديل المورد' : 'Edit Supplier') : (isRTL ? 'إضافة مورد جديد' : 'Add New Supplier')}</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => { e.preventDefault(); setLoading(true); await onSave({ name: formData.name, contact_name: formData.contact_name || null, phone: formData.phone || null, email: formData.email || null, address: formData.address || null, notes: formData.notes || null, is_active: true }); setLoading(false); onOpenChange(false); }}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{isRTL ? 'اسم الشركة *' : 'Company Name *'}</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>{isRTL ? 'جهة الاتصال' : 'Contact Person'}</Label><Input value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{isRTL ? 'الهاتف' : 'Phone'}</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>{isRTL ? 'البريد' : 'Email'}</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>{isRTL ? 'العنوان' : 'Address'}</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{supplier ? (isRTL ? 'حفظ' : 'Save') : (isRTL ? 'إضافة' : 'Add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Create PO Dialog ---
type POItemDraft = {
  type: 'device' | 'accessory';
  productId: string;
  quantity: number;
  unitCost: number;
  price: number;
  model: string;
  brand: string;
  color: string;
  storage: string;
};

function CreatePODialog({ open, onOpenChange, suppliers, devices, accessories, onSave, isRTL }: {
  open: boolean; onOpenChange: (o: boolean) => void; suppliers: Supplier[];
  devices: any[]; accessories: any[];
  onSave: (supplierId: string, items: any[], notes?: string) => Promise<any>; isRTL: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItemDraft[]>([]);

  // Distinct device models from actual inventory (keyed by a representative device row)
  const deviceModels = useMemo(() => {
    const map = new Map<string, { id: string; brand: string; model: string; storage: string; color: string; cost: number; price: number; available: number }>();
    for (const d of devices) {
      const key = `${d.brand || ''}|${d.model}|${d.storage || ''}`;
      const existing = map.get(key);
      if (existing) {
        if (d.status === 'available') existing.available += 1;
      } else {
        map.set(key, {
          id: d.id, brand: d.brand || '', model: d.model, storage: d.storage || '', color: d.color || '',
          cost: Number(d.cost), price: Number(d.price), available: d.status === 'available' ? 1 : 0,
        });
      }
    }
    return [...map.values()];
  }, [devices]);

  const activeAccessories = useMemo(() => accessories.filter((a: any) => a.is_active !== false), [accessories]);
  const hasInventory = deviceModels.length > 0 || activeAccessories.length > 0;

  const addItem = () => setItems([...items, {
    type: deviceModels.length > 0 ? 'device' : 'accessory',
    productId: '', quantity: 1, unitCost: 0, price: 0, model: '', brand: '', color: '', storage: '',
  }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<POItemDraft>) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };

  const selectProduct = (i: number, productId: string) => {
    const item = items[i];
    if (item.type === 'device') {
      const m = deviceModels.find(d => d.id === productId);
      if (m) updateItem(i, { productId, unitCost: m.cost, price: m.price, model: m.model, brand: m.brand, color: m.color, storage: m.storage });
    } else {
      const a = activeAccessories.find((x: any) => x.id === productId);
      if (a) updateItem(i, { productId, unitCost: Number(a.cost), price: Number(a.price), model: a.name, brand: a.brand || '', color: '', storage: '' });
    }
  };

  const total = items.reduce((s, it) => s + it.unitCost * it.quantity, 0);
  const allSelected = items.length > 0 && items.every(it => it.productId && it.quantity > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSupplierId(''); setNotes(''); setItems([]); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'إنشاء طلب شراء جديد' : 'Create New Purchase Order'}</DialogTitle>
          <DialogDescription>{isRTL ? 'اختر منتجات من مخزونك لطلب كميات إضافية من المورد' : 'Pick products from your inventory to reorder from the supplier'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'المورد *' : 'Supplier *'}</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر المورد' : 'Select supplier'} /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {!hasInventory ? (
            <div className="p-4 rounded-lg border border-warning/30 bg-warning/5 text-sm text-muted-foreground">
              {isRTL ? 'أضف أجهزة أو إكسسوارات للمخزون أولاً حتى تقدر تختار منها في طلب الشراء.' : 'Add devices or accessories to your inventory first so you can pick them in a purchase order.'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>{isRTL ? 'المنتجات' : 'Items'}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="w-4 h-4 mr-1" />{isRTL ? 'إضافة منتج' : 'Add Item'}</Button>
              </div>
              {items.map((item, i) => (
                <div key={i} className="p-3 border border-border rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline">{isRTL ? `منتج ${i + 1}` : `Item ${i + 1}`}</Badge>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeItem(i)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label className="text-xs">{isRTL ? 'النوع' : 'Type'}</Label>
                      <Select value={item.type} onValueChange={(v: 'device' | 'accessory') => updateItem(i, { type: v, productId: '', unitCost: 0, price: 0, model: '', brand: '', color: '', storage: '' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {deviceModels.length > 0 && <SelectItem value="device">{isRTL ? 'جهاز' : 'Device'}</SelectItem>}
                          {activeAccessories.length > 0 && <SelectItem value="accessory">{isRTL ? 'إكسسوار' : 'Accessory'}</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 col-span-2"><Label className="text-xs">{isRTL ? 'المنتج من المخزون *' : 'Product from inventory *'}</Label>
                      <SearchableSelect
                        value={item.productId}
                        onChange={(v) => selectProduct(i, v)}
                        placeholder={isRTL ? 'اختر المنتج' : 'Select product'}
                        options={item.type === 'device'
                          ? deviceModels.map(m => ({
                              value: m.id,
                              label: `${m.brand ? m.brand + ' ' : ''}${m.model}${m.storage ? ' · ' + m.storage : ''}`,
                              hint: `${isRTL ? 'متوفر' : 'stock'}: ${m.available}`,
                            }))
                          : activeAccessories.map((a: any) => ({
                              value: a.id,
                              label: `${a.name}${a.sku ? ' (' + a.sku + ')' : ''}`,
                              hint: `${isRTL ? 'متوفر' : 'stock'}: ${a.quantity}`,
                            }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label className="text-xs">{isRTL ? 'الكمية المطلوبة' : 'Qty to order'}</Label><Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} /></div>
                    <div className="space-y-1"><Label className="text-xs">{isRTL ? 'تكلفة الوحدة' : 'Unit Cost'}</Label><Input type="number" min={0} value={item.unitCost} onChange={(e) => updateItem(i, { unitCost: Number(e.target.value) })} /></div>
                    {item.type === 'device' && (
                      <div className="space-y-1"><Label className="text-xs">{isRTL ? 'سعر البيع' : 'Sell Price'}</Label><Input type="number" min={0} value={item.price} onChange={(e) => updateItem(i, { price: Number(e.target.value) })} /></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2"><Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
            <span className="font-medium">{isRTL ? 'الإجمالي' : 'Total'}</span>
            <span className="text-xl font-bold text-primary">{total.toLocaleString()} {isRTL ? 'ر.س' : 'SAR'}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={loading || !supplierId || !allSelected} onClick={async () => {
            setLoading(true);
            const poItems = items.map(it => it.type === 'accessory'
              ? { type: 'accessory', accessoryId: it.productId, quantity: it.quantity, unitCost: it.unitCost }
              : { type: 'device', deviceId: it.productId, quantity: it.quantity, unitCost: it.unitCost, model: it.model, brand: it.brand || undefined, color: it.color || undefined, storage: it.storage || undefined, price: it.price || undefined });
            await onSave(supplierId, poItems, notes || undefined);
            setLoading(false);
            onOpenChange(false);
          }}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isRTL ? 'إنشاء الطلب' : 'Create Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Receive & Inspect Dialog ---
function ReceiveDialog({ open, onOpenChange, order, onReceive, isRTL }: { open: boolean; onOpenChange: (o: boolean) => void; order: PurchaseOrder | null; onReceive: (orderId: string, items: any[]) => Promise<any>; isRTL: boolean }) {
  const [loading, setLoading] = useState(false);
  const [receiveItems, setReceiveItems] = useState<Array<{ type: 'device' | 'accessory'; accessoryId?: string; imei: string; model: string; brand: string; color: string; storage: string; quantity: number; unitCost: number; price: number; checked: boolean }>>([]);

  const handleOpen = () => {
    if (order?.items) {
      setReceiveItems(order.items.map(item => ({
        type: item.device_id ? 'device' : 'accessory',
        accessoryId: item.accessory_id || undefined,
        // The device reference is the catalog model — the received unit gets its own new IMEI
        imei: '',
        model: item.device?.model || item.accessory?.name || '',
        brand: item.device?.brand || item.accessory?.brand || '',
        color: item.device?.color || '',
        storage: item.device?.storage || '',
        quantity: item.quantity,
        unitCost: item.unit_cost,
        price: item.device?.price || item.accessory?.price || 0,
        checked: false,
      })));
    } else {
      setReceiveItems([]);
    }
  };

  const allChecked = receiveItems.length > 0 && receiveItems.every(it => it.checked);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) handleOpen(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-primary" />
            {isRTL ? 'استلام وجرد البضاعة' : 'Receive & Inspect Goods'}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? `طلب شراء ${order?.order_number} - تحقق من كل منتج عند الاستلام` : `PO ${order?.order_number} - Verify each item on receipt`}
          </DialogDescription>
        </DialogHeader>

        {receiveItems.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>{isRTL ? 'لا توجد منتجات في هذا الطلب. أضف المنتجات يدوياً.' : 'No items in this order. Add items manually.'}</p>
            <Button variant="outline" className="mt-3" onClick={() => setReceiveItems([...receiveItems, { type: 'device', imei: '', model: '', brand: '', color: '', storage: '', quantity: 1, unitCost: 0, price: 0, checked: false }])}>
              <Plus className="w-4 h-4 mr-1" /> {isRTL ? 'إضافة منتج' : 'Add Item'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button variant="outline" size="sm" onClick={() => setReceiveItems([...receiveItems, { type: 'device', imei: '', model: '', brand: '', color: '', storage: '', quantity: 1, unitCost: 0, price: 0, checked: false }])}>
              <Plus className="w-4 h-4 mr-1" /> {isRTL ? 'إضافة منتج' : 'Add Item'}
            </Button>
            {receiveItems.map((item, i) => (
              <div key={i} className={`p-3 border rounded-lg transition-colors ${item.checked ? 'border-green-500/50 bg-green-500/5' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className={item.checked ? 'bg-green-500/10 text-green-600' : ''}>
                    {item.checked ? (isRTL ? '✓ تم الجرد' : '✓ Verified') : (isRTL ? `منتج ${i + 1}` : `Item ${i + 1}`)}
                  </Badge>
                  <div className="flex gap-1">
                    <Button type="button" variant={item.checked ? 'default' : 'outline'} size="sm"
                      className={item.checked ? 'bg-green-600 hover:bg-green-700' : ''}
                      onClick={() => { const updated = [...receiveItems]; updated[i].checked = !updated[i].checked; setReceiveItems(updated); }}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> {isRTL ? 'جرد' : 'Verify'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setReceiveItems(receiveItems.filter((_, idx) => idx !== i))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1"><Label className="text-xs">{isRTL ? 'النوع' : 'Type'}</Label>
                    <Select value={item.type} onValueChange={(v: any) => { const u = [...receiveItems]; u[i].type = v; setReceiveItems(u); }}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="device">{isRTL ? 'جهاز' : 'Device'}</SelectItem><SelectItem value="accessory">{isRTL ? 'إكسسوار' : 'Accessory'}</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">{isRTL ? 'الموديل' : 'Model'}</Label><Input className="h-8" value={item.model} onChange={(e) => { const u = [...receiveItems]; u[i].model = e.target.value; setReceiveItems(u); }} /></div>
                  <div className="space-y-1"><Label className="text-xs">{isRTL ? 'الماركة' : 'Brand'}</Label><Input className="h-8" value={item.brand} onChange={(e) => { const u = [...receiveItems]; u[i].brand = e.target.value; setReceiveItems(u); }} /></div>
                </div>
                {item.type === 'device' && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="space-y-1"><Label className="text-xs">IMEI *</Label><Input className="h-8" value={item.imei} onChange={(e) => { const u = [...receiveItems]; u[i].imei = e.target.value; setReceiveItems(u); }} /></div>
                    <div className="space-y-1"><Label className="text-xs">{isRTL ? 'اللون' : 'Color'}</Label><Input className="h-8" value={item.color} onChange={(e) => { const u = [...receiveItems]; u[i].color = e.target.value; setReceiveItems(u); }} /></div>
                    <div className="space-y-1"><Label className="text-xs">{isRTL ? 'السعة' : 'Storage'}</Label><Input className="h-8" value={item.storage} onChange={(e) => { const u = [...receiveItems]; u[i].storage = e.target.value; setReceiveItems(u); }} /></div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="space-y-1"><Label className="text-xs">{isRTL ? 'الكمية' : 'Qty'}</Label><Input className="h-8" type="number" min={1} value={item.quantity} onChange={(e) => { const u = [...receiveItems]; u[i].quantity = Number(e.target.value); setReceiveItems(u); }} /></div>
                  <div className="space-y-1"><Label className="text-xs">{isRTL ? 'التكلفة' : 'Cost'}</Label><Input className="h-8" type="number" min={0} value={item.unitCost} onChange={(e) => { const u = [...receiveItems]; u[i].unitCost = Number(e.target.value); setReceiveItems(u); }} /></div>
                  <div className="space-y-1"><Label className="text-xs">{isRTL ? 'سعر البيع' : 'Sell Price'}</Label><Input className="h-8" type="number" min={0} value={item.price} onChange={(e) => { const u = [...receiveItems]; u[i].price = Number(e.target.value); setReceiveItems(u); }} /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={loading || !allChecked} className="bg-green-600 hover:bg-green-700" onClick={async () => {
            if (!order) return;
            setLoading(true);
            const items = receiveItems.map(it => ({
              type: it.type, quantity: it.quantity, unitCost: it.unitCost,
              accessoryId: it.accessoryId, imei: it.imei || undefined, model: it.model, brand: it.brand,
              color: it.color || undefined, storage: it.storage || undefined, price: it.price || undefined,
            }));
            await onReceive(order.id, items);
            setLoading(false);
            onOpenChange(false);
          }}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <PackageCheck className="w-4 h-4 mr-1" />
            {isRTL ? 'تأكيد الاستلام وإدخال المخزون' : 'Confirm & Add to Inventory'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Payment Dialog ---
function PaymentDialog({ open, onOpenChange, order, onPay, isRTL }: { open: boolean; onOpenChange: (o: boolean) => void; order: PurchaseOrder | null; onPay: (orderId: string, amount: number) => Promise<any>; isRTL: boolean }) {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const remaining = order ? Number(order.total_amount) - Number(order.paid_amount) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o && order) setAmount(remaining); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'تسجيل دفعة' : 'Record Payment'}</DialogTitle>
          <DialogDescription>{isRTL ? `طلب ${order?.order_number} - المتبقي: ${remaining.toLocaleString()} ر.س` : `PO ${order?.order_number} - Remaining: ${remaining.toLocaleString()} SAR`}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 bg-muted rounded-lg"><p className="text-muted-foreground">{isRTL ? 'الإجمالي' : 'Total'}</p><p className="font-bold">{Number(order?.total_amount || 0).toLocaleString()}</p></div>
            <div className="p-2 bg-green-500/10 rounded-lg"><p className="text-muted-foreground">{isRTL ? 'المدفوع' : 'Paid'}</p><p className="font-bold text-green-600">{Number(order?.paid_amount || 0).toLocaleString()}</p></div>
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'مبلغ الدفعة' : 'Payment Amount'}</Label>
            <Input type="number" min={1} max={remaining} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setAmount(remaining)}>{isRTL ? 'دفع كامل المبلغ' : 'Pay Full Amount'}</Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={loading || amount <= 0 || amount > remaining} onClick={async () => {
            if (!order) return;
            setLoading(true);
            await onPay(order.id, amount);
            setLoading(false);
            onOpenChange(false);
          }}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <CreditCard className="w-4 h-4 mr-1" />
            {isRTL ? 'تسجيل الدفعة' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- PO Details Dialog ---
function PODetailsDialog({ open, onOpenChange, order, isRTL }: { open: boolean; onOpenChange: (o: boolean) => void; order: PurchaseOrder | null; isRTL: boolean }) {
  const { merchant } = useAuth();
  if (!order) return null;
  const remaining = Number(order.total_amount) - Number(order.paid_amount);
  const sc = statusConfig[order.status] || statusConfig.draft;
  const pc = paymentStatusConfig[order.payment_status] || paymentStatusConfig.unpaid;

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) { toast.error(isRTL ? 'تم حظر النافذة المنبثقة من المتصفح' : 'Popup blocked by browser'); return; }
    const rows = (order.items || []).map(item => `
      <tr>
        <td>${item.device?.model || item.accessory?.name || '-'}</td>
        <td>${item.quantity}</td>
        <td>${Number(item.unit_cost).toLocaleString()}</td>
        <td>${(item.quantity * Number(item.unit_cost)).toLocaleString()}</td>
      </tr>`).join('');
    win.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>${order.order_number}</title>
      <style>
        body{font-family:'IBM Plex Sans Arabic',Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0 0 4px}.muted{color:#666;font-size:12px}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:13px}
        th{background:#f5f5f5}
        .totals{margin-top:16px;display:flex;gap:24px}.totals div{font-size:14px}
        .badge{display:inline-block;padding:2px 10px;border:1px solid #ccc;border-radius:99px;font-size:12px;margin-inline-start:6px}
      </style></head><body>
      <div class="head">
        <div><h1>طلب شراء</h1><div class="muted">${merchant?.name || ''}</div></div>
        <div style="text-align:left"><div style="font-weight:bold">${order.order_number}</div>
        <div class="muted">${new Date(order.order_date).toLocaleDateString('ar-SA')}</div></div>
      </div>
      <p>المورد: <b>${order.supplier?.name || '-'}</b> — الفرع: <b>${order.branch?.name || '-'}</b>
        <span class="badge">${sc.labelAr}</span><span class="badge">${pc.labelAr}</span></p>
      <table><thead><tr><th>المنتج</th><th>الكمية</th><th>التكلفة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals">
        <div>الإجمالي: <b>${Number(order.total_amount).toLocaleString()} ر.س</b></div>
        <div>المدفوع: <b>${Number(order.paid_amount).toLocaleString()} ر.س</b></div>
        <div>المتبقي: <b>${remaining.toLocaleString()} ر.س</b></div>
      </div>
      ${order.notes ? `<p class="muted">ملاحظات: ${order.notes}</p>` : ''}
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'تفاصيل طلب الشراء' : 'Purchase Order Details'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground">{isRTL ? 'رقم الطلب' : 'Order #'}</p><p className="font-mono font-bold">{order.order_number}</p></div>
            <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground">{isRTL ? 'المورد' : 'Supplier'}</p><p className="font-bold">{order.supplier?.name}</p></div>
            <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground">{isRTL ? 'التاريخ' : 'Date'}</p><p>{new Date(order.order_date).toLocaleDateString('ar-SA')}</p></div>
            <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground">{isRTL ? 'الفرع' : 'Branch'}</p><p>{order.branch?.name || '-'}</p></div>
          </div>
          <div className="flex gap-2"><Badge variant="outline" className={sc.color}>{isRTL ? sc.labelAr : sc.label}</Badge><Badge variant="outline" className={pc.color}>{isRTL ? pc.labelAr : pc.label}</Badge></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted rounded-lg text-center"><p className="text-xs text-muted-foreground">{isRTL ? 'الإجمالي' : 'Total'}</p><p className="text-lg font-bold">{Number(order.total_amount).toLocaleString()}</p></div>
            <div className="p-3 bg-green-500/10 rounded-lg text-center"><p className="text-xs text-muted-foreground">{isRTL ? 'المدفوع' : 'Paid'}</p><p className="text-lg font-bold text-green-600">{Number(order.paid_amount).toLocaleString()}</p></div>
            <div className="p-3 bg-destructive/10 rounded-lg text-center"><p className="text-xs text-muted-foreground">{isRTL ? 'المتبقي' : 'Remaining'}</p><p className="text-lg font-bold text-destructive">{remaining.toLocaleString()}</p></div>
          </div>
          {order.items && order.items.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">{isRTL ? 'المنتجات' : 'Items'}</h4>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{isRTL ? 'المنتج' : 'Item'}</TableHead>
                  <TableHead>{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                  <TableHead>{isRTL ? 'التكلفة' : 'Cost'}</TableHead>
                  <TableHead>{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {order.items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.device?.model || item.accessory?.name || '-'}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{Number(item.unit_cost).toLocaleString()}</TableCell>
                      <TableCell className="font-semibold">{(item.quantity * Number(item.unit_cost)).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {order.notes && <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</p><p className="text-sm">{order.notes}</p></div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إغلاق' : 'Close'}</Button>
          <Button onClick={handlePrint} className="gap-2 bg-gradient-primary hover:opacity-90">
            <Printer className="w-4 h-4" />
            {isRTL ? 'طباعة الفاتورة' : 'Print Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
