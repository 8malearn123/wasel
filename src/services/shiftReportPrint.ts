/**
 * Shift report (X = shift still open, Z = closing report) for thermal receipt printers.
 *
 * Printed through the browser on the system printer (the thermal printer installed on the
 * till), at the paper width from the printer settings. That path renders Arabic correctly;
 * direct-IP Epson/Star printing from the HTTPS app does not work today (see docs/audit/cash-shifts.md).
 *
 * The report comes from shift_report(), so the blind-count rule is already applied:
 * a cashier's report has no expected amount or difference until a manager approves.
 */
import type { ShiftReport } from "@/hooks/useShift";
import { CASH_MOVEMENT_LABELS, shiftOfflineNotes } from "@/hooks/useShift";
import { paymentMethodLabel } from "@/lib/payments";
import { getPrinterConfig, type PaperWidth } from "@/services/thermalPrinter";

export interface ShiftReportPrintOptions {
  merchantName: string;
  paperWidth?: PaperWidth;
  /** Print timestamp; defaults to now. */
  printedAt?: Date;
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sar = (n: number | null | undefined) => `${Number(n ?? 0).toFixed(2)} ر.س`;
const time = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("ar-SA-u-nu-latn") : "—");

export function shiftReportTitle(report: ShiftReport) {
  return report.shift.status === "open" ? "تقرير وردية (X)" : "تقرير إغلاق وردية (Z)";
}

export function buildShiftReportHTML(report: ShiftReport, opts: ShiftReportPrintOptions): string {
  const { shift, cash, sales, movements } = report;
  const paper = opts.paperWidth ?? "80mm";
  const bodyWidth = paper === "58mm" ? "48mm" : "72mm";
  const row = (label: string, value: string, cls = "") =>
    `<div class="row ${cls}"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;

  const offlineNotes = shiftOfflineNotes(shift);
  const diff = shift.difference;
  const diffRow =
    diff === null || shift.counted_cash === null
      ? ""
      : row(diff === 0 ? "مطابق" : diff < 0 ? "عجز" : "زيادة", sar(Math.abs(diff)), "box");

  const status =
    shift.status === "open"
      ? "الوردية مفتوحة — تقرير مؤقت"
      : shift.status === "pending_approval"
        ? "بانتظار اعتماد المدير"
        : `معتمدة${shift.approved_by_name ? ` — ${shift.approved_by_name}` : ""} — ${time(shift.approved_at)}`;

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${esc(shiftReportTitle(report))} #${shift.shift_no}</title>
<style>
  @page { size: ${paper} auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', Tahoma, system-ui, sans-serif; width: ${bodyWidth}; margin: 0 auto; color: #000; font-size: 12px; line-height: 1.5; }
  .center { text-align: center; }
  h1 { font-size: 16px; margin: 2px 0; }
  h2 { font-size: 13px; margin: 8px 0 3px; border-bottom: 1px dashed #000; padding-bottom: 2px; }
  .meta { font-size: 11px; }
  .row { display: flex; justify-content: space-between; gap: 6px; margin: 1px 0; }
  .b { font-weight: 700; }
  .row.box { border: 2px solid #000; padding: 4px; margin: 6px 0; font-weight: 700; font-size: 14px; }
  .small { font-size: 10px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .sign { margin-top: 14px; font-size: 11px; }
</style></head><body>
  <div class="center">
    <h1>${esc(opts.merchantName)}</h1>
    <div class="meta">${esc(shift.branch_name)}</div>
    <h2 style="border:none;margin:6px 0 2px;">${esc(shiftReportTitle(report))}</h2>
    <div class="meta">وردية رقم ${esc(shift.shift_no)}</div>
  </div>
  <div class="sep"></div>
  ${row("الفتح", time(shift.opened_at))}
  ${row("فتحها", shift.opened_by_name || "—")}
  ${shift.closed_at ? row("الإغلاق", time(shift.closed_at)) : ""}
  ${shift.closed_at ? row("أغلقها", shift.closed_by_name || "—") : ""}

  <h2>الدرج النقدي</h2>
  ${row("الرصيد الافتتاحي", sar(cash.opening))}
  ${row("مبيعات نقدية", "+ " + sar(cash.sales))}
  ${row("إيداعات", "+ " + sar(cash.cash_in))}
  ${row("سحوبات", "− " + sar(cash.cash_out))}
  ${row("مصروفات", "− " + sar(cash.expenses))}
  ${cash.expected !== null ? row("المتوقع في الدرج", sar(cash.expected), "b") : ""}
  ${shift.counted_cash !== null ? row("المبلغ المعدود", sar(shift.counted_cash), "b") : ""}
  ${diffRow}

  <h2>المبيعات</h2>
  ${row("عدد الفواتير", String(sales.count))}
  ${row("إجمالي المبيعات", sar(sales.total), "b")}
  ${sales.by_method.map((m) => row(paymentMethodLabel(m.method), sar(m.amount))).join("")}

  ${
    movements.length > 0
      ? `<h2>حركات الدرج</h2>${movements
          .map(
            (m) =>
              row(`${CASH_MOVEMENT_LABELS[m.type]?.ar ?? m.type}: ${m.reason}`, `${m.type === "cash_in" ? "+" : "−"} ${sar(m.amount)}`) +
              (m.created_by_name ? `<div class="small">${esc(m.created_by_name)} — ${esc(time(m.created_at))}</div>` : ""),
          )
          .join("")}`
      : ""
  }

  ${offlineNotes.length > 0 ? `<h2>تنبيهات</h2>${offlineNotes.map((n) => `<div class="small b">${esc(n)}</div>`).join("")}` : ""}
  ${shift.closing_notes ? `<h2>ملاحظات الإغلاق</h2><div class="small">${esc(shift.closing_notes)}</div>` : ""}
  ${shift.approval_notes ? `<h2>ملاحظات المدير</h2><div class="small">${esc(shift.approval_notes)}</div>` : ""}

  <div class="sep"></div>
  <div class="center b">${esc(status)}</div>
  ${shift.status !== "open" ? `<div class="sign">توقيع الكاشير: ....................</div><div class="sign">توقيع المدير: ....................</div>` : ""}
  <div class="sep"></div>
  <div class="center small">طُبع في ${esc((opts.printedAt ?? new Date()).toLocaleString("ar-SA-u-nu-latn"))}</div>
</body></html>`;
}

/**
 * Prints through a hidden iframe rather than a pop-up window, so it also works when
 * called after an await (e.g. auto-print right after closing), where pop-ups get blocked.
 */
export function printShiftReport(report: ShiftReport, merchantName: string): { ok: boolean; reason?: string } {
  const html = buildShiftReportHTML(report, { merchantName, paperWidth: getPrinterConfig().paperWidth });
  try {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) {
      frame.remove();
      return { ok: false, reason: "تعذر تجهيز الطباعة" };
    }
    doc.open();
    doc.write(html);
    doc.close();
    const win = frame.contentWindow;
    const cleanup = () => setTimeout(() => frame.remove(), 1000);
    win.onafterprint = cleanup;
    setTimeout(() => {
      win.focus();
      win.print();
      // Some browsers don't fire afterprint for iframes; remove it after a while anyway.
      setTimeout(() => frame.remove(), 60_000);
    }, 250);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "تعذرت الطباعة" };
  }
}
