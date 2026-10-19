import { describe, it, expect } from "vitest";
import { buildShiftReportHTML, shiftReportTitle } from "@/services/shiftReportPrint";
import type { ShiftReport } from "@/hooks/useShift";

function report(overrides: Partial<ShiftReport["shift"]> = {}, cash: Partial<ShiftReport["cash"]> = {}): ShiftReport {
  return {
    shift: {
      id: "s1", shift_no: 3, branch_id: "b1", branch_name: "فرع العليا", status: "pending_approval",
      opening_cash: 500, opening_notes: null, opened_by_name: "سارة", opened_at: "2026-10-18T06:00:00Z",
      counted_cash: 1590, closing_notes: null, closed_by_name: "سارة", closed_at: "2026-10-18T14:00:00Z",
      expected_cash: 1600, difference: -10, approved_by_name: null, approved_at: null, approval_notes: null,
      late_sales_count: 0, late_synced_at: null, unsynced_tills: null,
      ...overrides,
    },
    sales: { count: 2, total: 1380, by_method: [{ method: "cash", amount: 1250 }, { method: "mada", amount: 130 }] },
    cash: { opening: 500, sales: 1250, cash_in: 200, cash_out: 300, expenses: 50, expected: 1600, ...cash },
    movements: [
      { id: "m1", type: "expense", amount: 50, reason: "ضيافة <b>", created_by_name: "سارة", created_at: "2026-10-18T09:00:00Z" },
    ],
    can_approve: true,
  };
}

const text = (html: string) => new DOMParser().parseFromString(html, "text/html").body.textContent || "";

describe("shift report print", () => {
  it("is an X report while the shift is open and a Z report once closed", () => {
    expect(shiftReportTitle(report({ status: "open" }))).toContain("(X)");
    expect(shiftReportTitle(report({ status: "pending_approval" }))).toContain("(Z)");
    expect(shiftReportTitle(report({ status: "closed" }))).toContain("(Z)");
  });

  it("prints the drawer reconciliation, sales by method and movements", () => {
    const t = text(buildShiftReportHTML(report(), { merchantName: "متجر وصل" }));
    for (const s of ["متجر وصل", "فرع العليا", "وردية رقم 3", "500.00 ر.س", "1250.00 ر.س", "المتوقع في الدرج", "1600.00 ر.س", "1590.00 ر.س", "مدى", "130.00 ر.س", "بانتظار اعتماد المدير", "توقيع المدير"]) {
      expect(t).toContain(s);
    }
    expect(t).toMatch(/عجز\s*10\.00 ر\.س/);
  });

  it("keeps the count blind when the server withheld expected / difference", () => {
    const t = text(buildShiftReportHTML(report({ expected_cash: null, difference: null }, { expected: null }), { merchantName: "م" }));
    expect(t).not.toContain("المتوقع في الدرج");
    expect(t).not.toContain("عجز");
    expect(t).toContain("المبلغ المعدود");
  });

  it("labels a surplus and an exact match", () => {
    expect(text(buildShiftReportHTML(report({ difference: 5 }), { merchantName: "م" }))).toMatch(/زيادة\s*5\.00/);
    expect(text(buildShiftReportHTML(report({ difference: 0 }), { merchantName: "م" }))).toContain("مطابق");
  });

  it("flags a shift closed before every till synced, and sales added after the close", () => {
    expect(text(buildShiftReportHTML(report(), { merchantName: "م" }))).not.toContain("تنبيهات");
    const t = text(buildShiftReportHTML(report({
      late_sales_count: 2, late_synced_at: "2026-10-18T15:00:00Z",
      unsynced_tills: [{ id: "t2", code: "T2", name: null, last_seen_at: "2026-10-18T13:00:00Z", pending_count: 0 }],
    }), { merchantName: "م" }));
    expect(t).toContain("أُغلقت قبل مزامنة الصناديق: T2");
    expect(t).toContain("أُضيفت 2 فاتورة بدون إنترنت بعد الإغلاق");
  });

  it("escapes text typed by users", () => {
    const html = buildShiftReportHTML(report({ closing_notes: '<img src=x onerror="alert(1)">' }), { merchantName: "A & B" });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>");
    expect(html).toContain("A &amp; B");
  });

  it("sizes the page to the configured paper width", () => {
    expect(buildShiftReportHTML(report(), { merchantName: "م", paperWidth: "58mm" })).toContain("size: 58mm auto");
    expect(buildShiftReportHTML(report(), { merchantName: "م" })).toContain("size: 80mm auto");
  });
});
