import { describe, it, expect } from "vitest";
import { useTestDb } from "./use-test-db";
import { user } from "./harness";
import { DEVICES, LEGACY_SALES, MERCHANT, BRANCH_MAIN, OWNER, SARA } from "./fixtures";

// State right after all migrations ran on top of the legacy fixture.
describe("Phase 0/1 migrations on legacy data", () => {
  const db = useTestDb();

  describe("D1 VAT data fix", () => {
    it("corrects sales inflated by the VAT-exclusive formula", async () => {
      const cash = await db().one("SELECT subtotal, tax_amount, discount_amount, total_amount FROM sales WHERE id = $1", [LEGACY_SALES.inflatedCash]);
      expect(cash).toEqual({ subtotal: 1000, tax_amount: 150, discount_amount: 0, total_amount: 1150 });

      const mixed = await db().one("SELECT subtotal, tax_amount, discount_amount, total_amount FROM sales WHERE id = $1", [LEGACY_SALES.inflatedMixed]);
      expect(mixed).toEqual({ subtotal: 173.91, tax_amount: 26.09, discount_amount: 30, total_amount: 200 });
    });

    it("leaves correct VAT-inclusive sales untouched", async () => {
      const card = await db().one("SELECT subtotal, tax_amount, total_amount FROM sales WHERE id = $1", [LEGACY_SALES.correctCard]);
      expect(card).toEqual({ subtotal: 1000, tax_amount: 150, total_amount: 1150 });
    });

    it("keeps the old values in the backup table", async () => {
      const rows = await db().sql("SELECT sale_id, old_total, new_total, closing_adjusted FROM _vat_fix_sales_backup ORDER BY sale_id");
      expect(rows).toEqual([
        { sale_id: LEGACY_SALES.inflatedCash, old_total: 1322.5, new_total: 1150, closing_adjusted: true },
        { sale_id: LEGACY_SALES.inflatedMixed, old_total: 234.5, new_total: 200, closing_adjusted: true },
      ]);
    });

    it("shifts the affected daily closing by the same amounts", async () => {
      const closing = await db().one(
        "SELECT cash_sales, card_sales, total_sales, total_tax, cash_counted, cash_difference FROM daily_closings WHERE branch_id = $1",
        [BRANCH_MAIN],
      );
      // before: cash 1439.75, card 1267.25, total 2707, tax 357, difference -89.75
      expect(closing).toEqual({ cash_sales: 1250, card_sales: 1250, total_sales: 2500, total_tax: 326.09, cash_counted: 1350, cash_difference: 100 });
    });

    it("hides the backup table from API roles", async () => {
      expect(await db().as(user(OWNER)).query("SELECT * FROM _vat_fix_sales_backup")).toEqual([]);
    });
  });

  describe("D7 document numbers", () => {
    it("suffixes duplicate invoice and order numbers, keeping the earliest", async () => {
      const sales = await db().sql("SELECT id, invoice_number FROM sales ORDER BY created_at");
      expect(sales.map((s) => s.invoice_number)).toEqual(["INV-20260301-0001", "INV-20260301-0001-D2", "INV-20260301-0002"]);

      const orders = await db().sql("SELECT order_number FROM online_orders ORDER BY created_at");
      expect(orders.map((o) => o.order_number)).toEqual(["ORD-20260301-0001", "ORD-20260301-0001-D2"]);
    });

    it("enforces unique invoice numbers per merchant", async () => {
      await expect(
        db().sql("INSERT INTO sales (merchant_id, branch_id, invoice_number) VALUES ($1, $2, 'INV-20260301-0002')", [MERCHANT, BRANCH_MAIN]),
      ).rejects.toMatchObject({ code: "23505" });
    });
  });

  describe("backfills", () => {
    it("links legacy sales and repairs to customers by phone (any format)", async () => {
      const card = await db().one("SELECT customer_id FROM sales WHERE id = $1", [LEGACY_SALES.correctCard]);
      expect(card.customer_id).toBe(SARA); // stored as '+966 55 123 4567', customer has '0551234567'

      const noPhone = await db().one("SELECT customer_id FROM sales WHERE id = $1", [LEGACY_SALES.inflatedCash]);
      expect(noPhone.customer_id).toBeNull();

      const repair = await db().one("SELECT customer_id FROM repair_orders WHERE repair_number = 'REP-1'");
      expect(repair.customer_id).toBe(SARA);
    });

    it("creates one tender line per single-method legacy sale", async () => {
      const rows = await db().sql("SELECT sale_id, method::text, amount FROM sale_payments ORDER BY sale_id");
      expect(rows).toEqual([
        { sale_id: LEGACY_SALES.inflatedCash, method: "cash", amount: 1150 },
        { sale_id: LEGACY_SALES.correctCard, method: "card", amount: 1150 },
      ]); // the legacy 'mixed' sale has no recorded split
    });

    it("snapshots item names, IMEIs and SKUs on legacy sale lines", async () => {
      const line = await db().one("SELECT item_name, imei_snapshot, line_total FROM sale_items WHERE device_id = $1", [DEVICES.soldIphone12.id]);
      expect(line).toEqual({ item_name: "Apple iPhone 12 64GB Red", imei_snapshot: DEVICES.soldIphone12.imei, line_total: 1150 });
    });

    it("seeds the IMEI ledger with a receipt per device and the legacy sale", async () => {
      const events = await db().sql("SELECT event, ref_table, ref_id FROM device_events WHERE device_id = $1 ORDER BY id", [DEVICES.soldIphone12.id]);
      expect(events).toEqual([
        { event: "received", ref_table: null, ref_id: null },
        { event: "sold", ref_table: "sales", ref_id: LEGACY_SALES.inflatedCash },
      ]);
      const { count } = await db().one("SELECT count(DISTINCT device_id) AS count FROM device_events WHERE event = 'received'");
      expect(count).toBe(5);
    });
  });

  describe("schema", () => {
    it("adds the new payment methods and repair statuses (D8)", async () => {
      const { methods } = await db().one("SELECT enum_range(NULL::payment_method)::text[] AS methods");
      expect(methods).toEqual(expect.arrayContaining(["mada", "apple_pay", "stc_pay", "store_credit", "trade_in"]));

      const { statuses } = await db().one("SELECT enum_range(NULL::repair_status)::text[] AS statuses");
      expect(statuses).toEqual(expect.arrayContaining(["ready", "warranty_expired"]));
    });

    it("lets the app store 'warranty_expired' on a repair, which used to fail", async () => {
      const rows = await db()
        .as(user(OWNER))
        .query("UPDATE repair_orders SET status = 'warranty_expired' WHERE repair_number = 'REP-1' RETURNING status::text");
      expect(rows).toEqual([{ status: "warranty_expired" }]);
    });

    it("removes the policies that let anyone insert orders and order items directly (D6)", async () => {
      const rows = await db().sql(
        "SELECT policyname FROM pg_policies WHERE tablename IN ('online_orders', 'online_order_items') AND cmd = 'INSERT'",
      );
      expect(rows).toEqual([]);
    });

    it("keeps device_events read-only for API roles", async () => {
      await expect(
        db().as(user(OWNER)).query("DELETE FROM device_events WHERE device_id = $1 RETURNING id", [DEVICES.soldIphone12.id]),
      ).resolves.toEqual([]);
      await expect(
        db().as(user(OWNER)).query("INSERT INTO device_events (device_id, merchant_id, event) VALUES ($1, $2, 'fake')", [DEVICES.iphone13.id, MERCHANT]),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
});
