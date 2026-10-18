import { describe, it, expect } from "vitest";
import { setTimeout as sleep } from "node:timers/promises";
import { useTestDb } from "./use-test-db";
import { anon, user } from "./harness";
import {
  ACCESSORIES, BRANCH_MAIN, BRANCH_MALL, CASHIER, DEVICES, MERCHANT, OTHER_OWNER, OWNER,
  accessory, device, pay,
} from "./fixtures";

interface Report {
  shift: {
    id: string;
    shift_no: number;
    status: string;
    opening_cash: number;
    counted_cash: number | null;
    expected_cash: number | null;
    difference: number | null;
    approved_by: string | null;
  };
  sales: { count: number; total: number; by_method: { method: string; amount: number }[] };
  cash: { opening: number; sales: number; cash_in: number; cash_out: number; expenses: number; expected: number | null };
  movements: { type: string; amount: number; reason: string }[];
  can_approve: boolean;
}

describe("cash shifts", () => {
  const db = useTestDb();

  const as = (who: string) => db().as(user(who));
  const open = (who = CASHIER, branch = BRANCH_MAIN, cash = 500) =>
    as(who).rpc<Report>("open_shift", { _branch_id: branch, _opening_cash: cash });
  const sell = (items: unknown[], payments: unknown[], who = CASHIER, branch = BRANCH_MAIN) =>
    as(who).rpc<{ sale_id: string }>("pos_checkout", { _branch_id: branch, _items: items, _payments: payments });
  const move = (shiftId: string, type: string, amount: number, reason: string, who = CASHIER) =>
    as(who).rpc<Report>("record_cash_movement", { _shift_id: shiftId, _type: type, _amount: amount, _reason: reason });
  const close = (shiftId: string, counted: number, who = CASHIER) =>
    as(who).rpc<Report>("close_shift", { _shift_id: shiftId, _counted_cash: counted });
  const approve = (shiftId: string, who = OWNER, notes?: string) =>
    as(who).rpc<Report>("approve_shift", { _shift_id: shiftId, _notes: notes });
  const report = (shiftId: string, who = OWNER) => as(who).rpc<Report>("shift_report", { _shift_id: shiftId });

  describe("opening", () => {
    it("opens a numbered shift with the opening cash", async () => {
      const r = await open();
      expect(r.shift).toMatchObject({ shift_no: 1, status: "open", opening_cash: 500 });
      expect(await as(CASHIER).rpc("current_shift", { _branch_id: BRANCH_MAIN })).toMatchObject({ shift: { id: r.shift.id } });
      expect(await as(OWNER).rpc("current_shift", { _branch_id: BRANCH_MALL })).toBeNull();
    });

    it("allows one open shift per branch", async () => {
      await open();
      await expect(open(OWNER)).rejects.toMatchObject({ hint: "SHIFT_ALREADY_OPEN" });
      await expect(open(OWNER, BRANCH_MALL)).resolves.toMatchObject({ shift: { shift_no: 1 } });
    });

    it("refuses a negative opening cash", async () => {
      await expect(open(CASHIER, BRANCH_MAIN, -1)).rejects.toMatchObject({ hint: "INVALID_AMOUNT" });
    });

    it("keeps a cashier on their own branch", async () => {
      await expect(open(CASHIER, BRANCH_MALL)).rejects.toMatchObject({ hint: "WRONG_BRANCH" });
    });

    it("lets only one of two simultaneous openings succeed", async () => {
      const results = await Promise.allSettled([open(CASHIER), open(OWNER)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(failed?.reason).toMatchObject({ hint: "SHIFT_ALREADY_OPEN" });
    });
  });

  describe("selling needs an open shift", () => {
    it("refuses a sale with no open shift and leaves stock untouched", async () => {
      await expect(sell([device(DEVICES.iphone13.id)], [pay("cash", 1150)])).rejects.toMatchObject({ hint: "NO_OPEN_SHIFT" });
      expect(await db().one("SELECT status::text FROM devices WHERE id = $1", [DEVICES.iphone13.id])).toEqual({ status: "available" });
    });

    it("attaches each sale to the branch's open shift", async () => {
      const r = await open();
      const sale = await sell([device(DEVICES.iphone13.id)], [pay("cash", 1150)]);
      expect(await db().one("SELECT shift_id FROM sales WHERE id = $1", [sale.sale_id])).toEqual({ shift_id: r.shift.id });
    });

    it("does not need a shift for back-office inserts without a signed-in user", async () => {
      const [row] = await db().sql(
        "INSERT INTO sales (merchant_id, branch_id, invoice_number, total_amount) VALUES ($1, $2, 'IMPORT-1', 10) RETURNING shift_id",
        [MERCHANT, BRANCH_MAIN],
      );
      expect(row.shift_id).toBeNull();
    });
  });

  describe("full shift: sales, movements, blind close, approval", () => {
    it("computes the expected cash and keeps it hidden from the cashier until approved", async () => {
      const { shift } = await open(); // opening 500

      await sell([device(DEVICES.iphone13.id)], [pay("cash", 1150)]);
      await sell([accessory(ACCESSORIES.charger.id, 2)], [pay("cash", 100), pay("mada", 130)]);
      await move(shift.id, "cash_in", 200, "فكة من البنك");
      await move(shift.id, "cash_out", 300, "إيداع في البنك");
      await move(shift.id, "expense", 50, "ضيافة");

      // expected = 500 + (1150 + 100) + 200 - 300 - 50 = 1600
      const live = await report(shift.id, OWNER);
      expect(live.cash).toEqual({ opening: 500, sales: 1250, cash_in: 200, cash_out: 300, expenses: 50, expected: 1600 });
      expect(live.sales.count).toBe(2);
      expect(live.sales.total).toBe(1380);
      expect(live.sales.by_method).toEqual([
        { method: "cash", amount: 1250 },
        { method: "mada", amount: 130 },
      ]);
      expect(live.movements.map((m) => m.type)).toEqual(["cash_in", "cash_out", "expense"]);

      // Blind count: while open, the cashier doesn't see the expected amount.
      expect((await report(shift.id, CASHIER)).cash.expected).toBeNull();

      const closed = await close(shift.id, 1590); // 10 short
      expect(closed.shift).toMatchObject({ status: "pending_approval", counted_cash: 1590, expected_cash: null, difference: null });
      expect(closed.can_approve).toBe(false);

      const forManager = await report(shift.id, OWNER);
      expect(forManager.shift).toMatchObject({ expected_cash: 1600, difference: -10 });
      expect(forManager.can_approve).toBe(true);

      // No more sales or movements on a closed shift.
      await expect(sell([accessory(ACCESSORIES.guard.id)], [pay("cash", 57.5)])).rejects.toMatchObject({ hint: "NO_OPEN_SHIFT" });
      await expect(move(shift.id, "cash_in", 1, "x")).rejects.toMatchObject({ hint: "SHIFT_NOT_OPEN" });
      await expect(close(shift.id, 1600)).rejects.toMatchObject({ hint: "SHIFT_NOT_OPEN" });

      // Every close needs a manager, even when nothing is missing.
      await expect(approve(shift.id, CASHIER)).rejects.toMatchObject({ hint: "MANAGER_REQUIRED" });
      const approved = await approve(shift.id, OWNER, "عجز 10 ريال، تم التنبيه");
      expect(approved.shift).toMatchObject({ status: "closed", approved_by: OWNER });
      await expect(approve(shift.id, OWNER)).rejects.toMatchObject({ hint: "SHIFT_NOT_PENDING" });

      // Once approved, the cashier sees the outcome.
      expect((await report(shift.id, CASHIER)).shift).toMatchObject({ expected_cash: 1600, difference: -10 });

      // The next shift can open and is numbered 2.
      expect((await open()).shift.shift_no).toBe(2);
    });

    it("needs approval even when the drawer matches exactly", async () => {
      const { shift } = await open(CASHIER, BRANCH_MAIN, 300);
      const closed = await close(shift.id, 300);
      expect(closed.shift.status).toBe("pending_approval");
      expect((await report(shift.id, OWNER)).shift.difference).toBe(0);
    });

    it("lets a new shift open while the previous one waits for approval", async () => {
      const { shift } = await open();
      await close(shift.id, 500);
      await expect(open()).resolves.toMatchObject({ shift: { shift_no: 2, status: "open" } });
    });
  });

  describe("cash movements", () => {
    const refusals: [string, string, number, string, string][] = [
      ["an unknown type", "refund", 10, "x", "INVALID_MOVEMENT_TYPE"],
      ["a zero amount", "cash_out", 0, "x", "INVALID_AMOUNT"],
      ["a missing reason", "expense", 10, "  ", "REASON_REQUIRED"],
    ];
    it.each(refusals)("refuses %s", async (_label, type, amount, reason, hint) => {
      const { shift } = await open();
      await expect(move(shift.id, type, amount, reason)).rejects.toMatchObject({ hint });
    });

    it("cannot be written or read straight from the tables", async () => {
      const { shift } = await open();
      await move(shift.id, "expense", 20, "قهوة");
      expect(await as(OWNER).query("SELECT * FROM cash_shifts")).toEqual([]);
      expect(await as(OWNER).query("SELECT * FROM cash_movements")).toEqual([]);
      await expect(
        as(OWNER).query("INSERT INTO cash_movements (shift_id, merchant_id, type, amount, reason, created_by) VALUES ($1, $2, 'cash_in', 1000, 'x', $3)", [
          shift.id, MERCHANT, OWNER,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });

  describe("access", () => {
    it("hides shifts from other merchants and from anonymous callers", async () => {
      const { shift } = await open();
      await expect(report(shift.id, OTHER_OWNER)).rejects.toMatchObject({ hint: "INVALID_BRANCH" });
      await expect(approve(shift.id, OTHER_OWNER)).rejects.toMatchObject({ hint: "INVALID_BRANCH" });
      await expect(db().as(anon).rpc("shift_report", { _shift_id: shift.id })).rejects.toMatchObject({ code: "42501" });
      await expect(db().as(anon).rpc("open_shift", { _branch_id: BRANCH_MAIN, _opening_cash: 0 })).rejects.toMatchObject({ code: "42501" });
    });

    it("lists shifts per role, with the blind-count rule", async () => {
      const main = await open();
      await open(OWNER, BRANCH_MALL);
      await close(main.shift.id, 450);

      const forOwner = await as(OWNER).rpc<{ branch_id: string; status: string; difference: number | null }[]>("list_shifts", {});
      expect(forOwner).toHaveLength(2);
      expect(forOwner.find((s) => s.branch_id === BRANCH_MAIN)).toMatchObject({ status: "pending_approval", difference: -50 });

      const forCashier = await as(CASHIER).rpc<{ branch_id: string; difference: number | null }[]>("list_shifts", {});
      expect(forCashier).toHaveLength(1); // bound to the main branch
      expect(forCashier[0]).toMatchObject({ branch_id: BRANCH_MAIN, difference: null });

      const pending = await as(OWNER).rpc<unknown[]>("list_shifts", { _status: "pending_approval" });
      expect(pending).toHaveLength(1);
    });
  });

  describe("concurrency", () => {
    it("closing waits for a sale in progress and includes it", async () => {
      const { shift } = await open();
      const sale = await as(OWNER).begin();
      await sale.rpc("pos_checkout", { _branch_id: BRANCH_MAIN, _items: [device(DEVICES.iphone13.id)], _payments: [pay("cash", 1150)] });

      let settled = false;
      const closing = close(shift.id, 1650).finally(() => (settled = true));
      await sleep(300);
      expect(settled).toBe(false);

      await sale.commit();
      await closing;
      expect((await report(shift.id, OWNER)).shift).toMatchObject({ expected_cash: 1650, difference: 0 });
    });

    it("a sale arriving while the shift closes is refused", async () => {
      const { shift } = await open();
      const closing = await as(OWNER).begin();
      await closing.rpc("close_shift", { _shift_id: shift.id, _counted_cash: 500 });

      let settled = false;
      const sale = sell([device(DEVICES.iphone13.id)], [pay("cash", 1150)]).finally(() => (settled = true));
      await sleep(300);
      expect(settled).toBe(false);

      await closing.commit();
      await expect(sale).rejects.toMatchObject({ hint: "NO_OPEN_SHIFT" });
      expect(await db().one("SELECT status::text FROM devices WHERE id = $1", [DEVICES.iphone13.id])).toEqual({ status: "available" });
    });
  });
});
