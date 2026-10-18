import { useState } from "react";
import { Lock, Unlock, ArrowDownToLine, ArrowUpFromLine, Receipt, Wallet, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { paymentMethodLabel } from "@/lib/payments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CASH_MOVEMENT_LABELS, SHIFT_STATUS_LABELS,
  type CashMovementType, type ShiftReport,
} from "@/hooks/useShift";

const sar = (n: number | null | undefined) => `${Number(n ?? 0).toFixed(2)} ر.س`;
const parseAmount = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ar-SA") : "-");

/** Shown instead of the POS while the branch has no open shift. */
export function OpenShiftPanel({ onOpen }: { onOpen: (openingCash: number, notes?: string) => Promise<unknown> }) {
  const [openingCash, setOpeningCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = parseAmount(openingCash);
  const valid = openingCash !== "" && amount >= 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const ok = await onOpen(amount, notes.trim() || undefined);
    setBusy(false);
    if (ok) toast.success("تم فتح الوردية");
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 space-y-5 shadow-sm">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold">لا توجد وردية مفتوحة</h2>
          <p className="text-sm text-muted-foreground">افتح وردية الفرع لبدء البيع. أدخل المبلغ الموجود في درج الكاش الآن.</p>
        </div>
        <div className="space-y-2">
          <Label>رصيد الدرج الافتتاحي (ر.س)</Label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            placeholder="0.00"
            className="text-lg font-bold text-center"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label>ملاحظات (اختياري)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <Button className="w-full h-11" disabled={!valid || busy} onClick={submit}>
          <Unlock className="w-4 h-4 ml-2" />
          {busy ? "جاري الفتح..." : "فتح الوردية"}
        </Button>
      </div>
    </div>
  );
}

/** Cash summary of a shift; expected / difference only appear when the server returns them. */
export function ShiftReportView({ report }: { report: ShiftReport }) {
  const { shift, cash, sales, movements } = report;
  const diff = shift.difference;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>الفرع: <span className="text-foreground font-medium">{shift.branch_name}</span></div>
        <div>رقم الوردية: <span className="text-foreground font-medium">#{shift.shift_no}</span></div>
        <div>فتحها: <span className="text-foreground">{shift.opened_by_name || "-"}</span></div>
        <div>الفتح: <span className="text-foreground">{formatTime(shift.opened_at)}</span></div>
        {shift.closed_at && <div>أغلقها: <span className="text-foreground">{shift.closed_by_name || "-"}</span></div>}
        {shift.closed_at && <div>الإغلاق: <span className="text-foreground">{formatTime(shift.closed_at)}</span></div>}
      </div>

      <div className="rounded-lg border border-border p-3 space-y-1.5">
        <p className="font-semibold mb-1">الدرج النقدي</p>
        <Row label="الرصيد الافتتاحي" value={sar(cash.opening)} />
        <Row label="مبيعات نقدية" value={`+ ${sar(cash.sales)}`} />
        <Row label="إيداعات" value={`+ ${sar(cash.cash_in)}`} />
        <Row label="سحوبات" value={`− ${sar(cash.cash_out)}`} />
        <Row label="مصروفات" value={`− ${sar(cash.expenses)}`} />
        {cash.expected !== null && <Row label="المتوقع في الدرج" value={sar(cash.expected)} bold />}
        {shift.counted_cash !== null && <Row label="المبلغ المعدود" value={sar(shift.counted_cash)} bold />}
        {diff !== null && shift.counted_cash !== null && (
          <div
            className={cn(
              "flex justify-between rounded-md px-2 py-1.5 font-bold",
              diff === 0 ? "bg-success/10 text-success" : diff < 0 ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600",
            )}
          >
            <span>{diff === 0 ? "مطابق" : diff < 0 ? "عجز" : "زيادة"}</span>
            <span>{sar(Math.abs(diff))}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-3 space-y-1.5">
        <p className="font-semibold mb-1">
          المبيعات ({sales.count} فاتورة · {sar(sales.total)})
        </p>
        {sales.by_method.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا توجد مبيعات</p>
        ) : (
          sales.by_method.map((m) => <Row key={m.method} label={paymentMethodLabel(m.method)} value={sar(m.amount)} />)
        )}
      </div>

      {movements.length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-1.5">
          <p className="font-semibold mb-1">حركات الدرج</p>
          {movements.map((m) => (
            <div key={m.id} className="flex justify-between text-xs">
              <span>
                {CASH_MOVEMENT_LABELS[m.type].ar} · {m.reason}
                {m.created_by_name ? ` · ${m.created_by_name}` : ""}
              </span>
              <span className="font-medium">{m.type === "cash_in" ? "+" : "−"} {sar(m.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {(shift.closing_notes || shift.approval_notes) && (
        <div className="text-xs space-y-1">
          {shift.closing_notes && <p><span className="text-muted-foreground">ملاحظات الإغلاق:</span> {shift.closing_notes}</p>}
          {shift.approval_notes && <p><span className="text-muted-foreground">ملاحظات المدير:</span> {shift.approval_notes}</p>}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold && "font-bold border-t border-border pt-1.5 mt-1")}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

interface ShiftBarProps {
  report: ShiftReport;
  onMovement: (type: CashMovementType, amount: number, reason: string) => Promise<unknown>;
  onClose: (countedCash: number, notes?: string) => Promise<ShiftReport | null>;
  /** Called once the close result has been dismissed (the POS then asks for a new shift). */
  onClosed: () => void;
}

/** Strip above the POS: shift info, cash movements, closing. */
export function ShiftBar({ report, onMovement, onClose, onClosed }: ShiftBarProps) {
  const { shift } = report;
  const [showMovement, setShowMovement] = useState(false);
  const [showClose, setShowClose] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
      <div className="flex items-center gap-3 text-sm">
        <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">
          {SHIFT_STATUS_LABELS.open.ar}
        </Badge>
        <span className="font-semibold">وردية #{shift.shift_no}</span>
        <span className="text-muted-foreground text-xs flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatTime(shift.opened_at)}
          {shift.opened_by_name ? ` · ${shift.opened_by_name}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowMovement(true)}>
          <Wallet className="w-4 h-4 ml-1.5" />
          حركة نقدية
        </Button>
        <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowClose(true)}>
          <Lock className="w-4 h-4 ml-1.5" />
          إغلاق الوردية
        </Button>
      </div>

      <MovementDialog open={showMovement} onOpenChange={setShowMovement} onSubmit={onMovement} />
      <CloseShiftDialog open={showClose} onOpenChange={setShowClose} report={report} onClose={onClose} onClosed={onClosed} />
    </div>
  );
}

function MovementDialog({
  open, onOpenChange, onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (type: CashMovementType, amount: number, reason: string) => Promise<unknown>;
}) {
  const [type, setType] = useState<CashMovementType>("cash_out");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const value = parseAmount(amount);
  const valid = value > 0 && reason.trim().length > 0;

  const types: { id: CashMovementType; icon: typeof Receipt }[] = [
    { id: "cash_in", icon: ArrowDownToLine },
    { id: "cash_out", icon: ArrowUpFromLine },
    { id: "expense", icon: Receipt },
  ];

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const ok = await onSubmit(type, value, reason.trim());
    setBusy(false);
    if (ok) {
      toast.success("تم تسجيل الحركة");
      setAmount("");
      setReason("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>حركة نقدية على الدرج</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-2">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={cn(
                  "py-2.5 rounded-lg border flex flex-col items-center gap-1 text-xs font-medium transition-all",
                  type === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                <t.icon className="w-4 h-4" />
                {CASH_MOVEMENT_LABELS[t.id].ar}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>المبلغ (ر.س)</Label>
            <Input type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-center font-bold" />
          </div>
          <div className="space-y-2">
            <Label>السبب</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: إيداع في البنك، شراء ضيافة..." />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button disabled={!valid || busy} onClick={submit}>{busy ? "جاري الحفظ..." : "تسجيل"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseShiftDialog({
  open, onOpenChange, report, onClose, onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ShiftReport;
  onClose: (countedCash: number, notes?: string) => Promise<ShiftReport | null>;
  onClosed: () => void;
}) {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ShiftReport | null>(null);
  const value = parseAmount(counted);
  const valid = counted !== "" && value >= 0;

  const reset = (next: boolean) => {
    if (!next) {
      const wasClosed = !!result;
      setCounted("");
      setNotes("");
      setResult(null);
      if (wasClosed) onClosed();
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const closed = await onClose(value, notes.trim() || undefined);
    setBusy(false);
    if (closed) {
      setResult(closed);
      onOpenChange(false);
    }
  };

  const approveNow = async () => {
    if (!result) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("approve_shift", { _shift_id: result.shift.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم اعتماد الوردية");
    setResult(data as unknown as ShiftReport);
  };

  return (
    <Dialog open={open || !!result} onOpenChange={reset}>
      <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{result ? "تم إغلاق الوردية" : `إغلاق الوردية #${report.shift.shift_no}`}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            {result.shift.status === "pending_approval" ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm flex gap-2">
                <Clock className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                <span>تم إرسال الإغلاق. الوردية بانتظار اعتماد المدير، ويمكن فتح وردية جديدة للبيع.</span>
              </div>
            ) : (
              <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-sm flex gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-success shrink-0" />
                <span>تم اعتماد الوردية.</span>
              </div>
            )}
            <ShiftReportView report={result} />
            <DialogFooter className="gap-2">
              {result.can_approve && (
                <Button disabled={busy} onClick={approveNow}>
                  <CheckCircle2 className="w-4 h-4 ml-1.5" />
                  اعتماد الآن
                </Button>
              )}
              <Button variant="outline" onClick={() => reset(false)}>تم</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              عُدّ النقد الموجود في الدرج وأدخل المبلغ الإجمالي. يُرسل الإغلاق للمدير لاعتماده.
            </p>
            <div className="space-y-2">
              <Label>المبلغ الإجمالي الموجود في الدرج (ر.س)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0.00"
                className="text-lg font-bold text-center"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => reset(false)}>إلغاء</Button>
              <Button variant="destructive" disabled={!valid || busy} onClick={submit}>
                <Lock className="w-4 h-4 ml-1.5" />
                {busy ? "جاري الإغلاق..." : "إغلاق الوردية"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
