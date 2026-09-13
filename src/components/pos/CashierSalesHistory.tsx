import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Edit2, Printer, Lock, Search, Trash2, ChevronDown, LogIn, LogOut, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import type { POSActivity } from "@/hooks/usePOSActivity";
import type { PaymentMethod, Sale, SaleItem } from "@/types/database";

interface CashierSalesHistoryProps {
  sales: Sale[];
  activity: POSActivity[];
  loading: boolean;
  isCashier: boolean;
  onUpdateSale: (id: string, updates: {
    customer_name?: string;
    customer_phone?: string;
    discount_amount?: number;
    payment_method?: PaymentMethod;
    notes?: string;
  }) => Promise<{ error: any }>;
  onDeleteSale: (id: string) => Promise<{ error: any }>;
  onRefresh: () => void;
  merchantName: string;
  branchName: string;
}

type Period = "today" | "week" | "month" | "all";
type View = "all" | "sales" | "activity";

const PERIOD_DAYS: Record<Exclude<Period, "all" | "today">, number> = { week: 7, month: 30 };

export function CashierSalesHistory({
  sales,
  activity,
  loading,
  isCashier,
  onUpdateSale,
  onDeleteSale,
  onRefresh,
}: CashierSalesHistoryProps) {
  const { isRTL } = useLanguage();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [payment, setPayment] = useState<PaymentMethod | "all">("all");
  const [view, setView] = useState<View>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: "",
    customer_phone: "",
    notes: "",
    discount_amount: "0",
    payment_method: "cash" as PaymentMethod,
  });

  // Only a manager may erase an invoice and put its stock back
  const canDelete = !isCashier;

  const paymentLabels: Record<string, string> = {
    cash: isRTL ? "نقداً" : "Cash",
    card: isRTL ? "بطاقة" : "Card",
    bank_transfer: isRTL ? "تحويل" : "Transfer",
    mixed: isRTL ? "مختلط" : "Mixed",
  };

  const periodStart = (value: Period) => {
    if (value === "all") return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (value !== "today") start.setDate(start.getDate() - PERIOD_DAYS[value]);
    return start;
  };

  const filteredSales = useMemo(() => {
    const start = periodStart(period);
    const query = search.trim().toLowerCase();

    return sales.filter(sale => {
      if (start && new Date(sale.sale_date) < start) return false;
      if (payment !== "all" && sale.payment_method !== payment) return false;
      if (!query) return true;
      return (
        sale.invoice_number.toLowerCase().includes(query) ||
        (sale.customer_name || "").toLowerCase().includes(query) ||
        (sale.customer_phone || "").includes(query)
      );
    });
  }, [sales, period, payment, search]);

  const filteredActivity = useMemo(() => {
    const start = periodStart(period);
    const query = search.trim().toLowerCase();

    return activity.filter(entry => {
      if (start && new Date(entry.created_at) < start) return false;
      if (!query) return true;
      return (entry.invoice_number || "").toLowerCase().includes(query);
    });
  }, [activity, period, search]);

  // Invoices and bare POS actions read as one stream, newest first
  const timeline = useMemo(() => {
    const entries: ({ kind: "sale"; at: string; sale: Sale } | { kind: "activity"; at: string; entry: POSActivity })[] = [];
    if (view !== "activity") {
      for (const sale of filteredSales) entries.push({ kind: "sale", at: sale.sale_date, sale });
    }
    if (view !== "sales") {
      for (const entry of filteredActivity) entries.push({ kind: "activity", at: entry.created_at, entry });
    }
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [view, filteredSales, filteredActivity]);

  const openEdit = (sale: Sale) => {
    if ((sale as any).is_printed && isCashier) return; // a printed invoice is locked for cashiers
    setEditSale(sale);
    setEditForm({
      customer_name: sale.customer_name || "",
      customer_phone: sale.customer_phone || "",
      notes: sale.notes || "",
      discount_amount: String(Number(sale.discount_amount) || 0),
      payment_method: sale.payment_method,
    });
  };

  const handleSave = async () => {
    if (!editSale) return;
    const result = await onUpdateSale(editSale.id, {
      customer_name: editForm.customer_name || undefined,
      customer_phone: editForm.customer_phone || undefined,
      notes: editForm.notes || undefined,
      discount_amount: Number(editForm.discount_amount) || 0,
      payment_method: editForm.payment_method,
    });
    if (!result.error) {
      setEditSale(null);
      onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await onDeleteSale(deleteTarget.id);
    setIsDeleting(false);
    if (!result.error) {
      setDeleteTarget(null);
      onRefresh();
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    return (
      date.toLocaleDateString("ar-SA", { month: "short", day: "numeric" }) +
      " " +
      date.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const itemName = (item: SaleItem) => {
    if (item.device) return `${item.device.brand || ""} ${item.device.model}`.trim();
    if (item.accessory) return item.accessory.name;
    // Neither table: a warranty sold on top of a device
    return isRTL ? "ضمان" : "Warranty";
  };

  const activityLabel = (entry: POSActivity) => {
    const invoice = entry.invoice_number ? ` ${entry.invoice_number}` : "";
    switch (entry.action) {
      case "pos_check_in":
        return isRTL ? "بدء وردية على نقطة البيع" : "Shift started at the POS";
      case "pos_check_out":
        return isRTL ? "إنهاء الوردية" : "Shift ended";
      case "pos_sale_edited":
        return (isRTL ? "تعديل الفاتورة" : "Invoice edited") + invoice;
      case "pos_sale_deleted":
        return (isRTL ? "حذف الفاتورة" : "Invoice deleted") + invoice;
      case "pos_sale_printed":
        return (isRTL ? "طباعة الفاتورة" : "Invoice printed") + invoice;
      default:
        return entry.action;
    }
  };

  const activityIcon = (action: string) => {
    if (action === "pos_check_in") return LogIn;
    if (action === "pos_check_out") return LogOut;
    if (action === "pos_sale_deleted") return Trash2;
    if (action === "pos_sale_printed") return Printer;
    if (action === "pos_sale_edited") return Edit2;
    return Activity;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
          <Input
            placeholder={isRTL ? "ابحث برقم الفاتورة أو اسم العميل..." : "Search by invoice # or customer..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={isRTL ? "pr-9" : "pl-9"}
          />
        </div>

        <Select value={period} onValueChange={value => setPeriod(value as Period)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{isRTL ? "اليوم" : "Today"}</SelectItem>
            <SelectItem value="week">{isRTL ? "آخر ٧ أيام" : "Last 7 days"}</SelectItem>
            <SelectItem value="month">{isRTL ? "آخر ٣٠ يوم" : "Last 30 days"}</SelectItem>
            <SelectItem value="all">{isRTL ? "كل الفترات" : "All time"}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={payment} onValueChange={value => setPayment(value as PaymentMethod | "all")}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? "كل طرق الدفع" : "All payments"}</SelectItem>
            <SelectItem value="cash">{paymentLabels.cash}</SelectItem>
            <SelectItem value="card">{paymentLabels.card}</SelectItem>
            <SelectItem value="bank_transfer">{paymentLabels.bank_transfer}</SelectItem>
            <SelectItem value="mixed">{paymentLabels.mixed}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={view} onValueChange={value => setView(value as View)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? "الفواتير والعمليات" : "Invoices & activity"}</SelectItem>
            <SelectItem value="sales">{isRTL ? "الفواتير فقط" : "Invoices only"}</SelectItem>
            <SelectItem value="activity">{isRTL ? "عمليات نقطة البيع" : "POS activity"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : timeline.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{isRTL ? "لا توجد نتائج" : "Nothing to show"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {timeline.map((row, index) => {
            if (row.kind === "activity") {
              const Icon = activityIcon(row.entry.action);
              return (
                <motion.div
                  key={`act-${row.entry.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 12) * 0.03 }}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-dashed border-border bg-muted/20"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{activityLabel(row.entry)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(row.entry.created_at)}</p>
                  </div>
                  {row.entry.total_amount !== undefined && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {Number(row.entry.total_amount).toLocaleString()} ر.س
                    </span>
                  )}
                </motion.div>
              );
            }

            const sale = row.sale;
            const isPrinted = (sale as any).is_printed;
            const canEdit = !isPrinted || !isCashier;
            const items = sale.items || [];
            const isOpen = expanded === sale.id;

            return (
              <motion.div
                key={sale.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 12) * 0.03 }}
              >
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        isPrinted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                      )}>
                        {isPrinted ? <Lock className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground font-mono text-sm">{sale.invoice_number}</span>
                          {isPrinted && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Printer className="w-3 h-3" />
                              {isRTL ? "مطبوعة" : "Printed"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{formatDate(sale.sale_date)}</span>
                          {sale.customer_name && <span>• {sale.customer_name}</span>}
                          <span>• {paymentLabels[sale.payment_method] || sale.payment_method}</span>
                          {items.length > 0 && (
                            <span>• {items.length} {isRTL ? "صنف" : "items"}</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-foreground">{Number(sale.total_amount).toLocaleString()} ر.س</p>
                        {Number(sale.discount_amount) > 0 && (
                          <p className="text-[11px] text-primary">
                            {isRTL ? "خصم" : "Discount"} {Number(sale.discount_amount).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setExpanded(isOpen ? null : sale.id)}
                        >
                          <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
                          {isRTL ? "الأصناف" : "Items"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canEdit}
                          onClick={() => openEdit(sale)}
                          className="gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          {isRTL ? "تعديل" : "Edit"}
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(sale)}
                            className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                            {isRTL ? "حذف" : "Delete"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                        {items.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {isRTL ? "لا توجد أصناف مسجلة لهذه الفاتورة" : "No items recorded for this invoice"}
                          </p>
                        ) : (
                          items.map(item => (
                            <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-foreground truncate">{itemName(item)}</span>
                              <span className="text-muted-foreground shrink-0">
                                {item.quantity} × {Number(item.unit_price).toLocaleString()} ={" "}
                                <span className="text-foreground font-medium">
                                  {(item.quantity * Number(item.unit_price)).toLocaleString()} ر.س
                                </span>
                              </span>
                            </div>
                          ))
                        )}
                        {sale.notes && (
                          <p className="text-xs text-muted-foreground pt-1">
                            {isRTL ? "ملاحظات:" : "Notes:"} {sale.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editSale} onOpenChange={() => setEditSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "تعديل الفاتورة" : "Edit Invoice"} - {editSale?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? "اسم العميل" : "Customer Name"}</Label>
              <Input
                value={editForm.customer_name}
                onChange={e => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{isRTL ? "هاتف العميل" : "Customer Phone"}</Label>
              <Input
                value={editForm.customer_phone}
                onChange={e => setEditForm(prev => ({ ...prev, customer_phone: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "طريقة الدفع" : "Payment method"}</Label>
                <Select
                  value={editForm.payment_method}
                  onValueChange={value => setEditForm(prev => ({ ...prev, payment_method: value as PaymentMethod }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{paymentLabels.cash}</SelectItem>
                    <SelectItem value="card">{paymentLabels.card}</SelectItem>
                    <SelectItem value="bank_transfer">{paymentLabels.bank_transfer}</SelectItem>
                    <SelectItem value="mixed">{paymentLabels.mixed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isRTL ? "الخصم (ر.س)" : "Discount (SAR)"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.discount_amount}
                  onChange={e => setEditForm(prev => ({ ...prev, discount_amount: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
              <Input
                value={editForm.notes}
                onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isRTL
                ? "تغيير الخصم يعيد احتساب إجمالي الفاتورة."
                : "Changing the discount recalculates the invoice total."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSale(null)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>{isRTL ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? "حذف الفاتورة" : "Delete invoice"} {deleteTarget?.invoice_number}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? "سيتم حذف الفاتورة وأصنافها نهائياً، وإرجاع الأجهزة والإكسسوارات إلى المخزون. لا يمكن التراجع عن هذا الإجراء."
                : "The invoice and its items are deleted for good, and the devices and accessories go back into stock. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (isRTL ? "جارٍ الحذف..." : "Deleting...") : (isRTL ? "حذف" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
