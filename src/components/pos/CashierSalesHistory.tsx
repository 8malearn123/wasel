import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Edit2, Printer, Lock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n";
import type { Sale } from "@/types/database";

interface CashierSalesHistoryProps {
  sales: Sale[];
  loading: boolean;
  isCashier: boolean;
  onUpdateSale: (id: string, updates: { customer_name?: string; customer_phone?: string; discount_amount?: number; notes?: string }) => Promise<{ error: any }>;
  onRefresh: () => void;
  merchantName: string;
  branchName: string;
}

export function CashierSalesHistory({
  sales,
  loading,
  isCashier,
  onUpdateSale,
  onRefresh,
  merchantName,
  branchName,
}: CashierSalesHistoryProps) {
  const { isRTL } = useLanguage();
  const [search, setSearch] = useState("");
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState({
    customer_name: "",
    customer_phone: "",
    notes: "",
  });

  const filteredSales = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.invoice_number.toLowerCase().includes(q) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
      (s.customer_phone && s.customer_phone.includes(q))
    );
  });

  const openEdit = (sale: Sale) => {
    const isPrinted = (sale as any).is_printed;
    if (isPrinted && isCashier) return; // Can't edit printed sales as cashier
    setEditSale(sale);
    setEditForm({
      customer_name: sale.customer_name || "",
      customer_phone: sale.customer_phone || "",
      notes: sale.notes || "",
    });
  };

  const handleSave = async () => {
    if (!editSale) return;
    const result = await onUpdateSale(editSale.id, {
      customer_name: editForm.customer_name || undefined,
      customer_phone: editForm.customer_phone || undefined,
      notes: editForm.notes || undefined,
    });
    if (!result.error) {
      setEditSale(null);
      onRefresh();
    }
  };

  const paymentLabels: Record<string, string> = {
    cash: isRTL ? "نقداً" : "Cash",
    card: isRTL ? "بطاقة" : "Card",
    bank_transfer: isRTL ? "تحويل" : "Transfer",
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) +
      ' ' + date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
        <Input
          placeholder={isRTL ? "ابحث برقم الفاتورة أو اسم العميل..." : "Search by invoice # or customer..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={isRTL ? "pr-9" : "pl-9"}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{isRTL ? "لا توجد فواتير" : "No invoices found"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSales.map((sale, index) => {
            const isPrinted = (sale as any).is_printed;
            const canEdit = !isPrinted || !isCashier;

            return (
              <motion.div
                key={sale.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Invoice icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPrinted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                        {isPrinted ? <Lock className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>

                      {/* Invoice info */}
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
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right">
                        <p className="font-bold text-foreground">{Number(sale.total_amount).toLocaleString()} ر.س</p>
                      </div>

                      {/* Edit button */}
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
                    </div>
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
                onChange={(e) => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{isRTL ? "هاتف العميل" : "Customer Phone"}</Label>
              <Input
                value={editForm.customer_phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, customer_phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSale(null)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              {isRTL ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
