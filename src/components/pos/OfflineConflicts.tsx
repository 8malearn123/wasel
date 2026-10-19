import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface Conflict {
  id: string;
  invoice_number: string;
  sold_at: string;
  reason: string;
  hint: string | null;
  payload: { offline_total?: number; customer_name?: string; customer_phone?: string };
}

const HINT_TEXT: Record<string, string> = {
  DEVICE_UNAVAILABLE: "الجهاز بيع من مكان آخر أثناء الانقطاع",
  PAYMENT_MISMATCH: "تغيّر السعر أثناء الانقطاع",
  INSUFFICIENT_STOCK: "نفدت الكمية أثناء الانقطاع",
  NO_OPEN_SHIFT: "لم تكن هناك وردية مفتوحة عند المزامنة",
  DUPLICATE_INVOICE_NUMBER: "رقم الفاتورة مستخدم مسبقاً",
  DAY_CLOSED: "وصلت بعد إغلاق يوم العمل الذي تمت فيه",
};

/**
 * Offline sales the server refused at sync time. The customer already has the goods and
 * an OFF- receipt, so a manager settles each one (refund, manual sale, write-off...) and
 * records how.
 */
export function OfflineConflictsCard() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [active, setActive] = useState<Conflict | null>(null);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("offline_sale_conflicts")
      .select("id, invoice_number, sold_at, reason, hint, payload")
      .is("resolved_at", null)
      .order("sold_at");
    setConflicts((data as unknown as Conflict[]) || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async () => {
    if (!active || !resolution.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("resolve_offline_conflict", { _conflict_id: active.id, _resolution: resolution.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تسجيل المعالجة");
    setActive(null);
    setResolution("");
    load();
  };

  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        مبيعات بدون إنترنت تحتاج مراجعة ({conflicts.length})
      </div>
      <p className="text-xs text-muted-foreground">
        رفضها النظام عند المزامنة، والعميل استلم البضاعة وفاتورة بهذا الرقم. عالج كل حالة ثم سجّل ما تم.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الفاتورة</TableHead>
              <TableHead>وقت البيع</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>السبب</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {conflicts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.invoice_number}</TableCell>
                <TableCell className="text-xs">{new Date(c.sold_at).toLocaleString("ar-SA-u-nu-latn")}</TableCell>
                <TableCell>{c.payload.offline_total != null ? `${Number(c.payload.offline_total).toFixed(2)} ر.س` : "—"}</TableCell>
                <TableCell className="text-xs">{c.payload.customer_name || c.payload.customer_phone || "—"}</TableCell>
                <TableCell className="text-xs">{(c.hint && HINT_TEXT[c.hint]) || c.reason}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setActive(c)}>
                    <CheckCircle2 className="w-4 h-4 ml-1" />
                    تمت المعالجة
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>معالجة الفاتورة {active?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>كيف تمت المعالجة؟</Label>
            <Textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              placeholder="مثال: أُرجع المبلغ للعميل / سُجّلت كبيع يدوي بالسعر الجديد"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActive(null)}>إلغاء</Button>
            <Button disabled={busy || !resolution.trim()} onClick={resolve}>تسجيل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
