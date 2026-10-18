import { beforeEach, describe, it, expect } from "vitest";
import { useTestDb } from "./use-test-db";
import { anon, user } from "./harness";
import {
  ACCESSORIES, BRANCH_MAIN, BRANCH_MALL, CASHIER, DEVICES, MERCHANT, OTHER_OWNER, OWNER, SARA,
  accessory, device, pay, openShifts,
} from "./fixtures";

interface Checkout {
  sale_id: string;
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  customer_id: string | null;
}

describe("pos_checkout", () => {
  const db = useTestDb();
  beforeEach(() => openShifts(db()));

  const checkout = (args: Record<string, unknown>, who = OWNER) =>
    db().as(user(who)).rpc<Checkout>("pos_checkout", { _branch_id: BRANCH_MAIN, _discount: 0, ...args });

  const stock = async () => {
    const d = await db().sql("SELECT id, status::text FROM devices ORDER BY id");
    const a = await db().sql("SELECT id, quantity FROM accessories ORDER BY id");
    const { count } = await db().one("SELECT count(*) AS count FROM sales");
    return { d, a, sales: count };
  };

  it("sells a device and accessories with split tender in one transaction", async () => {
    const sale = await checkout({
      _items: [{ ...device(DEVICES.iphone13.id), price: 1 }, accessory(ACCESSORIES.charger.id, 2)], // client price is ignored
      _payments: [pay("cash", 500), pay("mada", 880, "778899")],
      _customer_name: "Sara",
      _customer_phone: "+966551234567",
    });

    expect(sale).toMatchObject({
      invoice_number: "INV-B1-000001",
      subtotal: 1200,
      tax_amount: 180, // 1380 × 15/115
      discount_amount: 0,
      total_amount: 1380,
      payment_method: "mixed",
      customer_id: SARA,
    });

    expect(await db().one("SELECT status::text, online_order_id FROM devices WHERE id = $1", [DEVICES.iphone13.id])).toEqual({ status: "sold", online_order_id: null });
    expect(await db().one("SELECT quantity FROM accessories WHERE id = $1", [ACCESSORIES.charger.id])).toEqual({ quantity: 3 });

    const payments = await db().sql("SELECT method::text, amount, reference FROM sale_payments WHERE sale_id = $1 ORDER BY amount", [sale.sale_id]);
    expect(payments).toEqual([
      { method: "cash", amount: 500, reference: null },
      { method: "mada", amount: 880, reference: "778899" },
    ]);

    const lines = await db().sql(
      "SELECT item_name, imei_snapshot, sku_snapshot, quantity, unit_price, cost_at_sale, vat_amount, line_total FROM sale_items WHERE sale_id = $1 ORDER BY unit_price DESC",
      [sale.sale_id],
    );
    expect(lines).toEqual([
      { item_name: "Apple iPhone 13 128GB Blue", imei_snapshot: DEVICES.iphone13.imei, sku_snapshot: null, quantity: 1, unit_price: 1150, cost_at_sale: 900, vat_amount: 150, line_total: 1150 },
      { item_name: "USB-C Charger", imei_snapshot: null, sku_snapshot: "ACC-1", quantity: 2, unit_price: 115, cost_at_sale: 50, vat_amount: 30, line_total: 230 },
    ]);

    const event = await db().one("SELECT event, ref_table, ref_id, actor FROM device_events WHERE device_id = $1 ORDER BY id DESC LIMIT 1", [DEVICES.iphone13.id]);
    expect(event).toEqual({ event: "sold", ref_table: "sales", ref_id: sale.sale_id, actor: OWNER });

    expect(await db().one("SELECT total_spent, total_purchases FROM customers WHERE id = $1", [SARA])).toEqual({ total_spent: 1380, total_purchases: 1 });
  });

  it("numbers invoices sequentially per branch", async () => {
    const a = await checkout({ _items: [accessory(ACCESSORIES.charger.id)], _payments: [pay("cash", 115)] });
    const b = await checkout({ _items: [accessory(ACCESSORIES.charger.id)], _payments: [pay("stc_pay", 115)] });
    const mall = await checkout({ _branch_id: BRANCH_MALL, _items: [device(DEVICES.galaxyMall.id)], _payments: [pay("apple_pay", 3000)] });

    expect([a.invoice_number, b.invoice_number, mall.invoice_number]).toEqual(["INV-B1-000001", "INV-B1-000002", "INV-B2-000001"]);
    expect(b.payment_method).toBe("stc_pay");
  });

  it("computes VAT on the discounted, VAT-inclusive total", async () => {
    const sale = await checkout({ _items: [accessory(ACCESSORIES.guard.id)], _payments: [pay("apple_pay", 7.5)], _discount: 50 });
    expect(sale).toMatchObject({ total_amount: 7.5, tax_amount: 0.98, subtotal: 6.52, discount_amount: 50 });

    const line = await db().one("SELECT line_discount, vat_amount, line_total FROM sale_items WHERE sale_id = $1", [sale.sale_id]);
    expect(line).toEqual({ line_discount: 50, vat_amount: 0.98, line_total: 7.5 });
  });

  it("charges no VAT for merchants that are not VAT-registered", async () => {
    await db().sql("UPDATE merchants SET vat_enabled = false WHERE id = $1", [MERCHANT]);
    const sale = await checkout({ _items: [device(DEVICES.iphone13.id)], _payments: [pay("cash", 1150)] });
    expect(sale).toMatchObject({ total_amount: 1150, tax_amount: 0, subtotal: 1150 });
  });

  it("accepts a fully discounted sale without tender lines", async () => {
    const sale = await checkout({ _items: [accessory(ACCESSORIES.guard.id)], _payments: [], _discount: 57.5 });
    expect(sale).toMatchObject({ total_amount: 0, payment_method: "cash" });
  });

  describe("customers", () => {
    it("creates a customer for a new phone number", async () => {
      const sale = await checkout({ _items: [accessory(ACCESSORIES.charger.id)], _payments: [pay("cash", 115)], _customer_phone: "0599999999" });
      const customer = await db().one("SELECT id, name, phone, total_spent FROM customers WHERE phone = '0599999999'");
      expect(customer).toMatchObject({ id: sale.customer_id, name: "0599999999", total_spent: 115 });
    });

    it("rejects a customer id from another merchant", async () => {
      const [{ id }] = await db().sql("INSERT INTO customers (merchant_id, name) VALUES ('22222222-2222-2222-2222-222222222222', 'X') RETURNING id");
      await expect(
        checkout({ _items: [accessory(ACCESSORIES.charger.id)], _payments: [pay("cash", 115)], _customer_id: id }),
      ).rejects.toMatchObject({ hint: "CUSTOMER_NOT_FOUND" });
    });
  });

  describe("refusals roll everything back", () => {
    const cases: [string, Record<string, unknown>, string][] = [
      ["a device that is already sold", { _items: [device(DEVICES.soldIphone12.id)], _payments: [pay("cash", 1150)] }, "DEVICE_UNAVAILABLE"],
      ["tenders that don't add up", { _items: [device(DEVICES.iphone15.id), accessory(ACCESSORIES.charger.id)], _payments: [pay("cash", 100)] }, "PAYMENT_MISMATCH"],
      ["more accessories than in stock", { _items: [device(DEVICES.iphone13.id), accessory(ACCESSORIES.guard.id, 2)], _payments: [pay("cash", 1265)] }, "INSUFFICIENT_STOCK"],
      ["a device kept at another branch", { _items: [device(DEVICES.galaxyMall.id)], _payments: [pay("cash", 3000)] }, "DEVICE_OTHER_BRANCH"],
      ["the same device twice", { _items: [device(DEVICES.iphone13.id), device(DEVICES.iphone13.id)], _payments: [pay("cash", 2300)] }, "DUPLICATE_DEVICE"],
      ["an unknown device", { _items: [device("d0000000-0000-0000-0000-0000000000ff")], _payments: [pay("cash", 1)] }, "DEVICE_NOT_FOUND"],
      ["an empty cart", { _items: [], _payments: [pay("cash", 1)] }, "EMPTY_CART"],
      ["a malformed item", { _items: [{ type: "gift", id: DEVICES.iphone13.id }], _payments: [pay("cash", 1)] }, "INVALID_ITEM"],
      ["a zero quantity", { _items: [accessory(ACCESSORIES.charger.id, 0)], _payments: [pay("cash", 1)] }, "INVALID_QUANTITY"],
      ["a discount above the cart value", { _items: [accessory(ACCESSORIES.guard.id)], _payments: [pay("cash", 1)], _discount: 100 }, "INVALID_DISCOUNT"],
      ["a negative discount", { _items: [accessory(ACCESSORIES.guard.id)], _payments: [pay("cash", 67.5)], _discount: -10 }, "INVALID_DISCOUNT"],
      ["no tender for a non-zero total", { _items: [accessory(ACCESSORIES.guard.id)], _payments: [] }, "PAYMENT_REQUIRED"],
      ["store credit (not enabled yet)", { _items: [accessory(ACCESSORIES.guard.id)], _payments: [pay("store_credit", 57.5)] }, "PAYMENT_METHOD_NOT_ENABLED"],
      ["'mixed' as a tender line", { _items: [accessory(ACCESSORIES.guard.id)], _payments: [pay("mixed", 57.5)] }, "INVALID_PAYMENT_METHOD"],
      ["a zero tender amount", { _items: [accessory(ACCESSORIES.guard.id)], _payments: [pay("cash", 57.5), pay("mada", 0)] }, "INVALID_PAYMENT_AMOUNT"],
    ];

    it.each(cases)("refuses %s", async (_label, args, hint) => {
      const before = await stock();
      await expect(checkout(args)).rejects.toMatchObject({ hint });
      expect(await stock()).toEqual(before);
    });

    it("does not consume an invoice number on failure", async () => {
      await expect(checkout({ _items: [device(DEVICES.iphone13.id)], _payments: [pay("cash", 1)] })).rejects.toMatchObject({ hint: "PAYMENT_MISMATCH" });
      const sale = await checkout({ _items: [device(DEVICES.iphone13.id)], _payments: [pay("cash", 1150)] });
      expect(sale.invoice_number).toBe("INV-B1-000001");
    });

    it("refuses an accessory stocked at another branch", async () => {
      const [{ id }] = await db().sql(
        "INSERT INTO accessories (merchant_id, branch_id, sku, name, price, quantity) VALUES ($1, $2, 'ACC-M', 'Mall case', 50, 10) RETURNING id",
        [MERCHANT, BRANCH_MALL],
      );
      await expect(checkout({ _items: [accessory(id)], _payments: [pay("cash", 50)] })).rejects.toMatchObject({ hint: "ACCESSORY_OTHER_BRANCH" });
    });
  });

  describe("authorization", () => {
    it("lets a cashier sell at their own branch", async () => {
      const sale = await checkout({ _items: [device(DEVICES.iphone13.id)], _payments: [pay("cash", 1150)] }, CASHIER);
      expect(await db().one("SELECT sold_by FROM sales WHERE id = $1", [sale.sale_id])).toEqual({ sold_by: CASHIER });
    });

    it("stops a cashier selling at another branch", async () => {
      await expect(
        checkout({ _branch_id: BRANCH_MALL, _items: [device(DEVICES.galaxyMall.id)], _payments: [pay("cash", 3000)] }, CASHIER),
      ).rejects.toMatchObject({ hint: "WRONG_BRANCH", code: "42501" });
    });

    it("stops another merchant using our branch", async () => {
      await expect(
        checkout({ _items: [device(DEVICES.iphone13.id)], _payments: [pay("cash", 1150)] }, OTHER_OWNER),
      ).rejects.toMatchObject({ hint: "INVALID_BRANCH" });
    });

    it("stops a signed-in user who belongs to no merchant", async () => {
      await expect(
        checkout({ _items: [device(DEVICES.iphone13.id)], _payments: [pay("cash", 1150)] }, "a1000000-0000-0000-0000-0000000000ff"),
      ).rejects.toMatchObject({ hint: "NOT_AUTHORIZED" });
    });

    it("is not callable anonymously", async () => {
      await expect(
        db().as(anon).rpc("pos_checkout", { _branch_id: BRANCH_MAIN, _items: [device(DEVICES.iphone13.id)], _payments: [pay("cash", 1150)] }),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });

  describe("legacy generate_invoice_number", () => {
    it("issues numbers from the same lock-safe counter", async () => {
      expect(await db().as(user(OWNER)).rpc("generate_invoice_number", { _merchant_id: MERCHANT })).toBe("INV-B1-000001");
      const sale = await checkout({ _items: [device(DEVICES.iphone13.id)], _payments: [pay("cash", 1150)] });
      expect(sale.invoice_number).toBe("INV-B1-000002");
    });

    it("refuses another merchant's id", async () => {
      await expect(
        db().as(user(OWNER)).rpc("generate_invoice_number", { _merchant_id: "22222222-2222-2222-2222-222222222222" }),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
});
