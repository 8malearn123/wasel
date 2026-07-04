import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, Search, Loader2, Eye, Truck, CreditCard, CheckCircle2,
  XCircle, Clock, Package, MoreHorizontal, Hash, MapPin, Phone, User,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useOnlineOrders, OnlineOrder, OnlineOrderItem } from "@/hooks/useOnlineStore";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "قيد الانتظار", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock },
  confirmed: { label: "مؤكد", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: CheckCircle2 },
  processing: { label: "قيد التجهيز", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20", icon: Package },
  shipped: { label: "تم الشحن", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: Truck },
  delivered: { label: "تم التسليم", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  cancelled: { label: "ملغي", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
  refunded: { label: "مسترجع", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const paymentConfig: Record<string, { label: string; color: string }> = {
  paid: { label: "مدفوع", color: "bg-green-500/10 text-green-600" },
  unpaid: { label: "غير مدفوع", color: "bg-red-500/10 text-red-600" },
  partial: { label: "جزئي", color: "bg-amber-500/10 text-amber-600" },
};

export default function OnlineOrdersPage() {
  const { orders, loading, updateOrderStatus, updateTracking, updatePaymentStatus, getOrderItems } = useOnlineOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OnlineOrderItem[]>([]);
  const [showShipping, setShowShipping] = useState(false);
  const [trackingNum, setTrackingNum] = useState("");
  const [shippingProvider, setShippingProvider] = useState("aramex");
  const [shippingOrderId, setShippingOrderId] = useState("");

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.order_number.includes(search) || o.customer_name.includes(search) || o.customer_phone.includes(search);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => ['confirmed', 'processing'].includes(o.status)).length,
    revenue: orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total_amount, 0),
  };

  const openOrder = async (order: OnlineOrder) => {
    setSelectedOrder(order);
    const items = await getOrderItems(order.id);
    setOrderItems(items);
  };

  const handleShipping = async () => {
    if (!trackingNum.trim()) return;
    await updateTracking(shippingOrderId, shippingProvider, trackingNum.trim());
    setShowShipping(false);
    setTrackingNum("");
  };

  return (
    <AppLayout title="طلبات المتجر" subtitle="إدارة الطلبات الإلكترونية">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        {[
          { label: "إجمالي الطلبات", value: stats.total, icon: ShoppingBag, color: "bg-primary/10 text-primary" },
          { label: "قيد الانتظار", value: stats.pending, icon: Clock, color: "bg-amber-500/10 text-amber-600" },
          { label: "قيد التجهيز", value: stats.processing, icon: Package, color: "bg-cyan-500/10 text-cyan-600" },
          { label: "الإيرادات", value: `${stats.revenue.toFixed(0)} ر.س`, icon: CreditCard, color: "bg-green-500/10 text-green-600" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", s.color)}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="ابحث بالرقم أو الاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="جميع الحالات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      <div className="bg-card rounded-xl border border-border shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد طلبات</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((order, i) => {
              const st = statusConfig[order.status] || statusConfig.pending;
              const pay = paymentConfig[order.payment_status] || paymentConfig.unpaid;
              return (
                <motion.div key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <Hash className="w-3 h-3 text-primary mb-0.5" />
                        <span className="text-[10px] font-bold text-primary">{order.order_number.slice(-4)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{order.order_number}</span>
                          <Badge variant="outline" className={st.color}>{st.label}</Badge>
                          <Badge variant="outline" className={pay.color}>{pay.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{order.customer_name}</span>
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{order.customer_phone}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{order.shipping_city}</span>
                        </div>
                        {order.tracking_number && (
                          <p className="text-xs text-primary mt-1 flex items-center gap-1">
                            <Truck className="w-3 h-3" /> {order.shipping_provider?.toUpperCase()} - {order.tracking_number}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-left hidden sm:block">
                        <p className="font-bold text-foreground">{order.total_amount.toFixed(0)} ر.س</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM yyyy', { locale: ar })}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openOrder(order)}><Eye className="w-4 h-4 mr-2" /> عرض التفاصيل</DropdownMenuItem>
                          {order.status === 'pending' && (
                            <DropdownMenuItem onClick={() => updateOrderStatus(order.id, 'confirmed')}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> تأكيد الطلب
                            </DropdownMenuItem>
                          )}
                          {order.status === 'confirmed' && (
                            <DropdownMenuItem onClick={() => updateOrderStatus(order.id, 'processing')}>
                              <Package className="w-4 h-4 mr-2" /> بدء التجهيز
                            </DropdownMenuItem>
                          )}
                          {['confirmed', 'processing'].includes(order.status) && (
                            <DropdownMenuItem onClick={() => { setShippingOrderId(order.id); setShowShipping(true); }}>
                              <Truck className="w-4 h-4 mr-2" /> إضافة تتبع الشحن
                            </DropdownMenuItem>
                          )}
                          {order.status === 'shipped' && (
                            <DropdownMenuItem onClick={() => updateOrderStatus(order.id, 'delivered')}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> تم التسليم
                            </DropdownMenuItem>
                          )}
                          {order.payment_status === 'unpaid' && (
                            <DropdownMenuItem onClick={() => updatePaymentStatus(order.id, 'paid')}>
                              <CreditCard className="w-4 h-4 mr-2" /> تأكيد الدفع
                            </DropdownMenuItem>
                          )}
                          {!['cancelled', 'delivered', 'refunded'].includes(order.status) && (
                            <DropdownMenuItem className="text-destructive" onClick={() => updateOrderStatus(order.id, 'cancelled')}>
                              <XCircle className="w-4 h-4 mr-2" /> إلغاء الطلب
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={(o) => !o && setSelectedOrder(null)}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>تفاصيل الطلب {selectedOrder.order_number}</DialogTitle>
              <DialogDescription>
                {format(new Date(selectedOrder.created_at), 'dd MMMM yyyy - HH:mm', { locale: ar })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">العميل</p>
                  <p className="font-medium text-foreground">{selectedOrder.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.customer_phone}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">العنوان</p>
                  <p className="font-medium text-foreground">{selectedOrder.shipping_city}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.shipping_address}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">المنتجات</p>
                <div className="space-y-2">
                  {orderItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">الكمية: {item.quantity}</p>
                      </div>
                      <span className="font-bold text-foreground">{(item.unit_price * item.quantity).toFixed(0)} ر.س</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                <div className="flex justify-between text-sm"><span>المجموع</span><span>{selectedOrder.subtotal.toFixed(2)} ر.س</span></div>
                <div className="flex justify-between text-sm"><span>الضريبة</span><span>{selectedOrder.tax_amount.toFixed(2)} ر.س</span></div>
                <div className="flex justify-between text-sm"><span>الشحن</span><span>{selectedOrder.shipping_cost.toFixed(2)} ر.س</span></div>
                <div className="flex justify-between font-bold text-lg border-t border-border pt-1">
                  <span>الإجمالي</span><span className="text-primary">{selectedOrder.total_amount.toFixed(2)} ر.س</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Shipping Dialog */}
      <Dialog open={showShipping} onOpenChange={setShowShipping}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة تتبع الشحن</DialogTitle>
            <DialogDescription>أدخل معلومات الشحن وسيتم تحديث حالة الطلب تلقائياً</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>شركة الشحن</Label>
              <Select value={shippingProvider} onValueChange={setShippingProvider}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aramex">🚚 أرامكس Aramex</SelectItem>
                  <SelectItem value="smsa">📦 SMSA Express</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>رقم التتبع</Label>
              <Input value={trackingNum} onChange={e => setTrackingNum(e.target.value)} className="mt-1 font-mono" dir="ltr" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShipping(false)}>إلغاء</Button>
            <Button onClick={handleShipping} disabled={!trackingNum.trim()}>
              <Truck className="w-4 h-4 mr-2" /> حفظ وشحن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
