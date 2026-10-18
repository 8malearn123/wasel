import { describe, it, expect } from "vitest";
import { splitVatInclusive, orderVatLabel } from "@/lib/vat";
import { tenderBreakdown, tenderBucket, paymentMethodLabel } from "@/lib/payments";

describe("splitVatInclusive", () => {
  it("extracts the 15% VAT contained in a gross price (same rounding as pos_checkout)", () => {
    expect(splitVatInclusive(1150)).toEqual({ total: 1150, tax: 150, net: 1000 });
    expect(splitVatInclusive(7.5)).toEqual({ total: 7.5, tax: 0.98, net: 6.52 });
    expect(splitVatInclusive(200)).toEqual({ total: 200, tax: 26.09, net: 173.91 });
  });

  it("returns no VAT when the merchant is not VAT-registered", () => {
    expect(splitVatInclusive(1150, false)).toEqual({ total: 1150, tax: 0, net: 1150 });
  });
});

describe("orderVatLabel", () => {
  it("labels new VAT-inclusive orders as 'including VAT'", () => {
    expect(orderVatLabel({ subtotal: 2415, tax_amount: 315, shipping_cost: 0, total_amount: 2415 })).toContain("شامل");
  });

  it("keeps the old label for legacy orders where VAT was added on top", () => {
    expect(orderVatLabel({ subtotal: 1000, tax_amount: 150, shipping_cost: 25, total_amount: 1175 })).not.toContain("شامل");
  });
});

describe("tenderBreakdown", () => {
  it("uses tender lines when present (cash + mada + apple pay)", () => {
    const sale = {
      total_amount: 1380,
      payment_method: "mixed",
      payments: [
        { method: "cash", amount: 500 },
        { method: "mada", amount: 680 },
        { method: "apple_pay", amount: 200 },
      ],
    };
    expect(tenderBreakdown(sale)).toEqual({ cash: 500, card: 880, bank_transfer: 0 });
  });

  it("falls back to the header method for legacy sales", () => {
    expect(tenderBreakdown({ total_amount: 100, payment_method: "bank_transfer" })).toEqual({ cash: 0, card: 0, bank_transfer: 100 });
    expect(tenderBreakdown({ total_amount: 100, payment_method: "mixed", payments: [] })).toEqual({ cash: 50, card: 50, bank_transfer: 0 });
  });

  it("keeps non-drawer methods out of the close-out buckets", () => {
    expect(tenderBucket("store_credit")).toBeNull();
    expect(tenderBucket("stc_pay")).toBe("card");
  });
});

describe("paymentMethodLabel", () => {
  it("labels new methods and passes unknown values through", () => {
    expect(paymentMethodLabel("mada", true)).toBe("مدى");
    expect(paymentMethodLabel("mada", false)).toBe("Mada");
    expect(paymentMethodLabel("crypto")).toBe("crypto");
  });
});
