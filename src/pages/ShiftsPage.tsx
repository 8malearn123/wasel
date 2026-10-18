import { useState } from "react";
import { CheckCircle2, Eye, Printer, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShiftReportView, usePrintShiftReport } from "@/components/pos/ShiftControls";
import { SHIFT_STATUS_LABELS, useShiftsList, type ShiftReport, type ShiftStatus } from "@/hooks/useShift";
import { cn } from "@/lib/utils";

const sar = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Number(n).toFixed(2)} ر.س`);
const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ar-SA") : "—");

const statusClass: Record<ShiftStatus, string> = {
  open: "bg-success/15 text-success border-success/30",
  pending_approval: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export default function ShiftsPage() {
  const [filter, setFilter] = useState<ShiftStatus | undefined>("pending_approval");
  const { shifts, loading, refresh, getReport, approveShift } = useShiftsList(filter);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const print = usePrintShiftReport();

  const openDetails = async (id: string) => {
    const r = await getReport(id);
    if (r) {
      setNotes("");
      setReport(r);
    }
  };

  const approve = async () => {
    if (!report) return;
    setBusy(true);
    const r = await approveShift(report.shift.id, notes.trim() || undefined);
    setBusy(false);
    if (r) setReport(r);
  };

  const filters: { id: ShiftStatus | undefined; label: string }[] = [
    { id: "pending_approval", label: "بانتظار الاعتماد" },
    { id: "open", label: "مفتوحة" },
    { id: "closed", label: "معتمدة" },
    { id: undefined, label: "الكل" },
  ];

  return (
    <AppLayout title="الورديات" subtitle="فتح وإغلاق ورديات الفروع واعتماد الإغلاق">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {filters.map((f) => (
              <Button
                key={f.label}
                size="sm"
                variant={filter === f.id ? "default" : "outline"}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={refresh}>
            <RefreshCw className="w-4 h-4 ml-1.5" />
            تحديث
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الفرع</TableHead>
                <TableHead>#</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الفتح</TableHead>
                <TableHead>الإغلاق</TableHead>
                <TableHead>الافتتاحي</TableHead>
                <TableHead>المبيعات</TableHead>
                <TableHead>المتوقع</TableHead>
                <TableHead>المعدود</TableHead>
                <TableHead>الفرق</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">جاري التحميل...</TableCell></TableRow>
              ) : shifts.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">لا توجد ورديات</TableCell></TableRow>
              ) : (
                shifts.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.branch_name}</TableCell>
                    <TableCell>{s.shift_no}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass[s.status]}>{SHIFT_STATUS_LABELS[s.status].ar}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatTime(s.opened_at)}
                      <div className="text-muted-foreground">{s.opened_by_name || ""}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatTime(s.closed_at)}
                      <div className="text-muted-foreground">{s.closed_by_name || ""}</div>
                    </TableCell>
                    <TableCell>{sar(s.opening_cash)}</TableCell>
                    <TableCell>{sar(s.sales_total)}</TableCell>
                    <TableCell>{sar(s.expected_cash)}</TableCell>
                    <TableCell>{sar(s.counted_cash)}</TableCell>
                    <TableCell
                      className={cn(
                        "font-bold",
                        s.difference === null ? "" : s.difference < 0 ? "text-destructive" : s.difference > 0 ? "text-amber-600" : "text-success",
                      )}
                    >
                      {s.difference === null ? "—" : `${s.difference > 0 ? "+" : ""}${Number(s.difference).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant={s.status === "pending_approval" ? "default" : "ghost"} onClick={() => openDetails(s.id)}>
                        {s.status === "pending_approval" ? <CheckCircle2 className="w-4 h-4 ml-1" /> : <Eye className="w-4 h-4 ml-1" />}
                        {s.status === "pending_approval" ? "مراجعة" : "عرض"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto" dir="rtl">
          {report && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  وردية #{report.shift.shift_no} · {report.shift.branch_name}
                  <Badge variant="outline" className={statusClass[report.shift.status]}>{SHIFT_STATUS_LABELS[report.shift.status].ar}</Badge>
                </DialogTitle>
              </DialogHeader>
              <ShiftReportView report={report} />
              {report.shift.status === "closed" && (
                <p className="text-xs text-muted-foreground">
                  اعتمدها {report.shift.approved_by_name || "—"} في {formatTime(report.shift.approved_at)}
                </p>
              )}
              {report.can_approve && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label>ملاحظات الاعتماد (اختياري)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="مثال: تم التنبيه على العجز" />
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setReport(null)}>إغلاق</Button>
                <Button variant="outline" onClick={() => print(report)}>
                  <Printer className="w-4 h-4 ml-1.5" />
                  طباعة
                </Button>
                {report.can_approve && (
                  <Button disabled={busy} onClick={approve}>
                    <CheckCircle2 className="w-4 h-4 ml-1.5" />
                    {busy ? "جاري الاعتماد..." : "اعتماد الوردية"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
