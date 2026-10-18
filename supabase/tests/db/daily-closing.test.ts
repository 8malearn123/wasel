import { describe, it, expect } from "vitest";
import { useTestDb } from "./use-test-db";
import { user } from "./harness";
import {
  ACCESSORIES, BRANCH_MAIN, BRANCH_MALL, CASHIER, DEVICES, MERCHANT, OWNER,
  accessory, device, pay,
} from "./fixtures";

interface Summary {
  date: string;
  shift_counts: { total: number; open: number; pending: number; closed: number };
  shifts: { id: string; shift_no: number; status: string; expected_cash: number | null; difference: number | null }[];
  cash: { opening: number; sales: number; cash_in: number; cash_out: number; expenses: number; expected: number | null; counted: number | null; difference: number | null };
  sales: { count: number; total: number; tax: number; discount: number; outside_shifts: number };
  tenders: { cash: number; card: number; bank_transfer: number };
  devices_sold: number;
  accessories_sold: number;
  items: { name: string; type: string; total: number }[];
  closing: { status: string; source: string } | null;
  blockers: string[];
  can_close: boolean;
}

describe("daily closing from shifts", () => {
  const db = useTestDb();

  const as = (who: string) => db().as(user(who));
  const today = async () => (await db().one("SELECT public.shop_date(now())::text AS d")).d as string;
  const summary = async (who = OWNER, branch = BRANCH_MAIN, date?: string) =>
    as(who).rpc<Summary>("daily_summary", { _branch_id: branch, _date: date ?? (await today()) });
  const closeDay = async (who = OWNER, branch = BRANCH_MAIN, date?: string) =>
    as(who).rpc<Summary>("close_day", { _branch_id: branch, _date: date ?? (await today()), _notes: "إغلاق" });

  const openShift = (cash: number, branch = BRANCH_MAIN, who = branch === BRANCH_MAIN ? CASHIER : OWNER) =>
    as(who).rpc<{ shift: { id: string } }>("open_shift", { _branch_id: branch, _opening_cash: cash }).then((r) => r.shift.id);
  const sell = (items: unknown[], payments: unknown[], branch = BRANCH_MAIN) =>
    as(OWNER).rpc("pos_checkout", { _branch_id: branch, _items: items, _payments: payments });
  const closeShift = (id: string, counted: number) => as(CASHIER).rpc("close_shift", { _shift_id: id, _counted_cash: counted });
  const approve = (id: string) => as(OWNER).rpc("approve_shift", { _shift_id: id });

  /** Two approved shifts at the main branch:
   *  #1 opening 500, iPhone cash 1150, guard mada 57.5, counted 1640 (10 short)
   *  #2 opening 300, cash out 100, charger card 115, counted 200 (exact) */
  async function twoApprovedShifts() {
    const s1 = await openShift(500);
    await sell([device(DEVICES.iphone13.id)], [pay("cash", 1150)]);
    await sell([accessory(ACCESSORIES.guard.id)], [pay("mada", 57.5)]);
    await closeShift(s1, 1640);
    await approve(s1);

    const s2 = await openShift(300);
    await as(CASHIER).rpc("record_cash_movement", { _shift_id: s2, _type: "cash_out", _amount: 100, _reason: "إيداع بنكي" });
    await sell([accessory(ACCESSORIES.charger.id)], [pay("card", 115)]);
    await closeShift(s2, 200);
    await approve(s2);
    return [s1, s2];
  }

  it("adds up the day's shifts", async () => {
    await twoApprovedShifts();
    const s = await summary();

    expect(s.shift_counts).toEqual({ total: 2, open: 0, pending: 0, closed: 2 });
    expect(s.cash).toEqual({ opening: 800, sales: 1150, cash_in: 0, cash_out: 100, expenses: 0, expected: 1850, counted: 1840, difference: -10 });
    expect(s.sales).toEqual({ count: 3, total: 1322.5, tax: 172.5, discount: 0, outside_shifts: 0 });
    expect(s.tenders).toEqual({ cash: 1150, card: 172.5, bank_transfer: 0 });
    expect(s.devices_sold).toBe(1);
    expect(s.accessories_sold).toBe(2);
    expect(s.items.map((i) => i.name)).toEqual(["Apple iPhone 13 128GB Blue", "Screen Guard", "USB-C Charger"]);
    expect(s.shifts.map((x) => x.difference)).toEqual([-10, 0]);
    expect(s).toMatchObject({ blockers: [], can_close: true, closing: null });
  });

  it("writes the closing from the shifts and then locks the day", async () => {
    await twoApprovedShifts();
    const after = await closeDay();
    expect(after).toMatchObject({ blockers: ["ALREADY_CLOSED"], can_close: false, closing: { status: "closed", source: "shifts" } });

    const row = await db().one(
      `SELECT source, status, shifts_count, opening_cash, cash_in, cash_out, expenses, expected_cash,
              cash_counted, cash_difference, cash_sales, card_sales, bank_transfer_sales,
              total_sales, total_tax, transactions_count, devices_sold, accessories_sold, closed_by
       FROM daily_closings WHERE branch_id = $1 AND closing_date = public.shop_date(now())`,
      [BRANCH_MAIN],
    );
    expect(row).toEqual({
      source: "shifts", status: "closed", shifts_count: 2,
      opening_cash: 800, cash_in: 0, cash_out: 100, expenses: 0, expected_cash: 1850,
      cash_counted: 1840, cash_difference: -10,
      cash_sales: 1150, card_sales: 172.5, bank_transfer_sales: 0,
      total_sales: 1322.5, total_tax: 172.5, transactions_count: 3, devices_sold: 1, accessories_sold: 2,
      closed_by: OWNER,
    });

    await expect(closeDay()).rejects.toMatchObject({ hint: "DAY_ALREADY_CLOSED" });
    await expect(openShift(100)).rejects.toMatchObject({ hint: "DAY_CLOSED" });
  });

  describe("closing is refused until every shift is approved", () => {
    it("with no shifts", async () => {
      expect((await summary()).blockers).toEqual(["NO_SHIFTS"]);
      await expect(closeDay()).rejects.toMatchObject({ hint: "NO_SHIFTS" });
    });

    it("with an open shift", async () => {
      await openShift(500);
      expect((await summary()).blockers).toEqual(["OPEN_SHIFTS"]);
      await expect(closeDay()).rejects.toMatchObject({ hint: "OPEN_SHIFTS" });
    });

    it("with a shift awaiting approval", async () => {
      const id = await openShift(500);
      await closeShift(id, 500);
      expect((await summary()).blockers).toEqual(["PENDING_SHIFTS"]);
      await expect(closeDay()).rejects.toMatchObject({ hint: "PENDING_SHIFTS" });
    });

    it("for a cashier", async () => {
      await twoApprovedShifts();
      const s = await summary(CASHIER);
      expect(s).toMatchObject({ blockers: ["MANAGER_REQUIRED"], can_close: false });
      await expect(closeDay(CASHIER)).rejects.toMatchObject({ hint: "MANAGER_REQUIRED" });
    });

    it("for a future date", async () => {
      await expect(closeDay(OWNER, BRANCH_MAIN, "2999-01-01")).rejects.toMatchObject({ hint: "INVALID_DATE" });
    });

    it("for a day already closed the old way", async () => {
      await expect(closeDay(OWNER, BRANCH_MAIN, "2026-03-01")).rejects.toMatchObject({ hint: "DAY_ALREADY_CLOSED" });
      expect((await summary(OWNER, BRANCH_MAIN, "2026-03-01")).closing).toMatchObject({ status: "closed", source: "manual" });
    });
  });

  it("keeps the count blind for cashiers until shifts are approved", async () => {
    const id = await openShift(500);
    await sell([device(DEVICES.iphone13.id)], [pay("cash", 1150)]);
    await closeShift(id, 1600);

    const forCashier = await summary(CASHIER);
    expect(forCashier.shifts[0]).toMatchObject({ expected_cash: null, difference: null });
    expect(forCashier.cash).toMatchObject({ expected: null, difference: null, counted: 1600 });

    const forOwner = await summary(OWNER);
    expect(forOwner.shifts[0]).toMatchObject({ expected_cash: 1650, difference: -50 });

    await approve(id);
    expect((await summary(CASHIER)).cash).toMatchObject({ expected: 1650, difference: -50 });
  });

  describe("what belongs to the day", () => {
    it("only this branch's shifts", async () => {
      await openShift(500);
      await openShift(700, BRANCH_MALL);
      await sell([device(DEVICES.galaxyMall.id)], [pay("cash", 3000)], BRANCH_MALL);
      const s = await summary();
      expect(s.shift_counts.total).toBe(1);
      expect(s.cash.opening).toBe(500);
      expect(s.sales.count).toBe(0);
    });

    it("a shift counts on the day it was opened", async () => {
      const id = await openShift(500);
      await sell([device(DEVICES.iphone13.id)], [pay("cash", 1150)]);
      await db().sql("UPDATE cash_shifts SET business_date = business_date - 1 WHERE id = $1", [id]);

      expect((await summary()).shift_counts.total).toBe(0);
      const yesterday = (await db().one("SELECT (public.shop_date(now()) - 1)::text AS d")).d as string;
      const s = await summary(OWNER, BRANCH_MAIN, yesterday);
      expect(s.shift_counts.total).toBe(1);
      expect(s.sales.total).toBe(1150);
    });

    it("uses the Riyadh calendar day, not UTC", async () => {
      const rows = await db().sql(
        "SELECT public.shop_date('2026-10-18 20:59Z')::text AS before_midnight, public.shop_date('2026-10-18 21:00Z')::text AS after_midnight",
      );
      expect(rows[0]).toEqual({ before_midnight: "2026-10-18", after_midnight: "2026-10-19" });
    });

    it("includes sales of the day that belong to no shift, outside the cash count", async () => {
      await openShift(500);
      await db().sql(
        "INSERT INTO sales (merchant_id, branch_id, invoice_number, total_amount, tax_amount, payment_method) VALUES ($1, $2, 'IMPORT-1', 100, 13.04, 'bank_transfer')",
        [MERCHANT, BRANCH_MAIN],
      );
      const s = await summary();
      expect(s.sales).toMatchObject({ count: 1, total: 100, outside_shifts: 1 });
      expect(s.tenders.bank_transfer).toBe(100);
      expect(s.cash.expected).toBe(500);
    });
  });

  it("closings can no longer be written from the client", async () => {
    await expect(
      as(OWNER).query(
        "INSERT INTO daily_closings (merchant_id, branch_id, closing_date, total_sales, status) VALUES ($1, $2, '2026-01-01', 999, 'closed')",
        [MERCHANT, BRANCH_MAIN],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await as(OWNER).query("UPDATE daily_closings SET total_sales = 0 RETURNING id")).toEqual([]);
  });
});
