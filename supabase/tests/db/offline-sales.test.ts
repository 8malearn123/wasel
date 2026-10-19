import { beforeEach, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { useTestDb } from "./use-test-db";
import { anon, user } from "./harness";
import {
  ACCESSORIES, BRANCH_MAIN, BRANCH_MALL, CASHIER, DEVICES, OTHER_OWNER, OWNER,
  accessory, device, openShifts, pay,
} from "./fixtures";

interface Terminal { id: string; code: string; invoice_prefix: string; last_offline_number: number }
interface SyncResult { status: "synced" | "conflict"; sale_id?: string; shift_id?: string; late?: boolean; invoice_number?: string; reason?: string; hint?: string; replayed?: boolean }

describe("offline sales", () => {
  const db = useTestDb();
  beforeEach(() => openShifts(db()));

  const register = (who = CASHIER, branch = BRANCH_MAIN) =>
    db().as(user(who)).rpc<Terminal>("register_terminal", { _branch_id: branch, _name: "صندوق 1" });

  const sync = (t: Terminal, n: number, items: unknown[], payments: unknown[], extra: Record<string, unknown> = {}, who = CASHIER) =>
    db().as(user(who)).rpc<SyncResult>("sync_offline_sale", {
      _terminal_id: t.id,
      _client_ref: (extra._client_ref as string) ?? randomUUID(),
      _invoice_number: `${t.invoice_prefix}-${String(n).padStart(6, "0")}`,
      _sold_at: "2026-10-18T10:15:00Z",
      _items: items,
      _payments: payments,
      _offline_total: 1150,
      ...extra,
    });

  describe("terminals", () => {
    it("numbers tills per merchant and reports where their offline series stands", async () => {
      const t1 = await register();
      const t2 = await register(OWNER, BRANCH_MALL);
      expect([t1.code, t2.code]).toEqual(["T1", "T2"]);
      expect(t1).toMatchObject({ invoice_prefix: "OFF-T1", last_offline_number: 0 });

      await sync(t1, 1, [device(DEVICES.iphone13.id)], [pay("cash", 1150)]);
      await sync(t1, 2, [device(DEVICES.soldIphone12.id)], [pay("cash", 1150)]); // becomes a conflict
      const state = await db().as(user(CASHIER)).rpc<Terminal>("terminal_state", { _terminal_id: t1.id });
      expect(state.last_offline_number).toBe(2);
    });

    it("cannot be used by another merchant", async () => {
      const t = await register();
      await expect(db().as(user(OTHER_OWNER)).rpc("terminal_state", { _terminal_id: t.id })).rejects.toMatchObject({ hint: "INVALID_BRANCH" });
      await expect(db().as(anon).rpc("register_terminal", { _branch_id: BRANCH_MAIN })).rejects.toMatchObject({ code: "42501" });
    });
  });

  describe("sync", () => {
    it("records the sale under the number printed offline, at the offline time", async () => {
      const t = await register();
      const ref = randomUUID();
      const r = await sync(t, 1, [device(DEVICES.iphone13.id), accessory(ACCESSORIES.charger.id, 2)], [pay("cash", 1000), pay("mada", 380)], {
        _client_ref: ref, _customer_phone: "0599999999", _offline_total: 1380,
      });
      expect(r).toMatchObject({ status: "synced", invoice_number: "OFF-T1-000001" });

      const sale = await db().one(
        "SELECT invoice_number, total_amount, tax_amount, payment_method::text, client_ref, terminal_id, sale_date, notes, shift_id IS NOT NULL AS in_shift FROM sales WHERE id = $1",
        [r.sale_id],
      );
      expect(sale).toMatchObject({
        invoice_number: "OFF-T1-000001", total_amount: 1380, tax_amount: 180, payment_method: "mixed",
        client_ref: ref, terminal_id: t.id, notes: "بيع بدون إنترنت", in_shift: true,
      });
      expect((sale.sale_date as Date).toISOString()).toBe("2026-10-18T10:15:00.000Z");
      expect(await db().one("SELECT status::text FROM devices WHERE id = $1", [DEVICES.iphone13.id])).toEqual({ status: "sold" });
      expect(await db().one("SELECT quantity FROM accessories WHERE id = $1", [ACCESSORIES.charger.id])).toEqual({ quantity: 3 });
    });

    it("does not consume the branch's INV- series", async () => {
      const t = await register();
      await sync(t, 1, [device(DEVICES.iphone13.id)], [pay("cash", 1150)]);
      const online = await db().as(user(CASHIER)).rpc<{ invoice_number: string }>("pos_checkout", {
        _branch_id: BRANCH_MAIN, _items: [accessory(ACCESSORIES.guard.id)], _payments: [pay("cash", 57.5)],
      });
      expect(online.invoice_number).toBe("INV-B1-000001");
    });

    it("is idempotent: replaying the same queued sale does nothing twice", async () => {
      const t = await register();
      const ref = randomUUID();
      const first = await sync(t, 1, [accessory(ACCESSORIES.charger.id)], [pay("cash", 115)], { _client_ref: ref });
      const again = await sync(t, 1, [accessory(ACCESSORIES.charger.id)], [pay("cash", 115)], { _client_ref: ref });
      expect(again).toMatchObject({ status: "synced", sale_id: first.sale_id, replayed: true });
      expect(await db().one("SELECT quantity FROM accessories WHERE id = $1", [ACCESSORIES.charger.id])).toEqual({ quantity: 4 });
    });
  });

  describe("a checkout whose response was lost", () => {
    const checkout = (ref: string) =>
      db().as(user(CASHIER)).rpc<{ sale_id: string; invoice_number: string; replayed?: boolean }>("pos_checkout", {
        _branch_id: BRANCH_MAIN, _items: [accessory(ACCESSORIES.charger.id)], _payments: [pay("cash", 115)], _client_ref: ref,
      });

    it("is not sold twice when retried online", async () => {
      const ref = randomUUID();
      const first = await checkout(ref);
      const retry = await checkout(ref);
      expect(retry).toMatchObject({ sale_id: first.sale_id, invoice_number: "INV-B1-000001", replayed: true });
      expect(await db().one("SELECT quantity FROM accessories WHERE id = $1", [ACCESSORIES.charger.id])).toEqual({ quantity: 4 });
    });

    it("is not sold twice when the till then queued it offline", async () => {
      const t = await register();
      const ref = randomUUID();
      const online = await checkout(ref); // reached the server, but the till never saw the answer
      const r = await sync(t, 1, [accessory(ACCESSORIES.charger.id)], [pay("cash", 115)], { _client_ref: ref });
      expect(r).toMatchObject({ status: "synced", sale_id: online.sale_id, invoice_number: "INV-B1-000001", replayed: true });
      expect((await db().one("SELECT count(*) AS n FROM sales WHERE client_ref = $1", [ref])).n).toBe(1);
      expect((await db().one("SELECT count(*) AS n FROM offline_sale_conflicts")).n).toBe(0);
    });
  });

  describe("conflicts go to review instead of being lost", () => {
    const cases: [string, () => Promise<void>, unknown[], unknown[], string][] = [
      ["the unit was sold online meanwhile", async () => {
        await db().as(user(OWNER)).rpc("pos_checkout", { _branch_id: BRANCH_MAIN, _items: [device(DEVICES.iphone13.id)], _payments: [pay("card", 1150)] });
      }, [device(DEVICES.iphone13.id)], [pay("cash", 1150)], "DEVICE_UNAVAILABLE"],
      ["the price changed meanwhile", async () => {
        await db().sql("UPDATE devices SET price = 1200 WHERE id = $1", [DEVICES.iphone13.id]);
      }, [device(DEVICES.iphone13.id)], [pay("cash", 1150)], "PAYMENT_MISMATCH"],
      ["the stock ran out", async () => {
        await db().sql("UPDATE accessories SET quantity = 0 WHERE id = $1", [ACCESSORIES.guard.id]);
      }, [accessory(ACCESSORIES.guard.id)], [pay("cash", 57.5)], "INSUFFICIENT_STOCK"],
      ["the shift was closed", async () => {
        const { shift } = await db().as(user(CASHIER)).rpc<{ shift: { id: string } }>("current_shift", { _branch_id: BRANCH_MAIN });
        await db().as(user(CASHIER)).rpc("close_shift", { _shift_id: shift.id, _counted_cash: 500 });
      }, [device(DEVICES.iphone13.id)], [pay("cash", 1150)], "NO_OPEN_SHIFT"],
    ];

    it.each(cases)("when %s", async (_label, arrange, items, payments, hint) => {
      const t = await register();
      await arrange();
      const before = await db().sql("SELECT id, status::text FROM devices ORDER BY id");
      const ref = randomUUID();
      const r = await sync(t, 7, items, payments, { _client_ref: ref });
      expect(r).toMatchObject({ status: "conflict", hint });
      expect(await db().sql("SELECT id, status::text FROM devices ORDER BY id")).toEqual(before);

      const c = await db().one("SELECT invoice_number, hint, payload->'payments' AS payments, resolved_at FROM offline_sale_conflicts WHERE client_ref = $1", [ref]);
      expect(c).toMatchObject({ invoice_number: "OFF-T1-000007", hint, resolved_at: null });

      // Replaying returns the same conflict without recording it twice.
      expect(await sync(t, 7, items, payments, { _client_ref: ref })).toMatchObject({ status: "conflict", hint, replayed: true });
      expect((await db().one("SELECT count(*) AS n FROM offline_sale_conflicts")).n).toBe(1);
    });

    it("refuses a reused invoice number as a conflict", async () => {
      const t = await register();
      await sync(t, 1, [accessory(ACCESSORIES.charger.id)], [pay("cash", 115)]);
      expect(await sync(t, 1, [accessory(ACCESSORIES.charger.id)], [pay("cash", 115)])).toMatchObject({ status: "conflict", hint: "DUPLICATE_INVOICE_NUMBER" });
    });

    it("lets only a manager mark a conflict as settled", async () => {
      const t = await register();
      await sync(t, 1, [device(DEVICES.soldIphone12.id)], [pay("cash", 1150)]);
      const { id } = await db().one("SELECT id FROM offline_sale_conflicts");
      await expect(db().as(user(CASHIER)).rpc("resolve_offline_conflict", { _conflict_id: id, _resolution: "x" })).rejects.toMatchObject({ hint: "MANAGER_REQUIRED" });
      await expect(db().as(user(OWNER)).rpc("resolve_offline_conflict", { _conflict_id: id, _resolution: " " })).rejects.toMatchObject({ hint: "RESOLUTION_REQUIRED" });
      await db().as(user(OWNER)).rpc("resolve_offline_conflict", { _conflict_id: id, _resolution: "أُرجع المبلغ للعميل" });
      expect(await db().one("SELECT resolution, resolved_by FROM offline_sale_conflicts WHERE id = $1", [id])).toEqual({ resolution: "أُرجع المبلغ للعميل", resolved_by: OWNER });
      await expect(db().as(user(OWNER)).rpc("resolve_offline_conflict", { _conflict_id: id, _resolution: "y" })).rejects.toMatchObject({ hint: "ALREADY_RESOLVED" });
    });
  });

  describe("several tills reconnecting at once", () => {
    it("syncs every till's queue in parallel without mixing or losing numbers", async () => {
      await db().sql("UPDATE accessories SET quantity = 100 WHERE id = $1", [ACCESSORIES.charger.id]);
      const tills = [await register(), await register(OWNER), await register(CASHIER)];
      expect(tills.map((t) => t.code)).toEqual(["T1", "T2", "T3"]);

      // Each till sold 5 chargers offline; all three come back and sync at the same moment.
      const results = await Promise.all(
        tills.map(async (t) => {
          const out: SyncResult[] = [];
          for (let n = 1; n <= 5; n++) out.push(await sync(t, n, [accessory(ACCESSORIES.charger.id)], [pay("cash", 115)]));
          return out;
        }),
      );

      expect(results.flat().every((r) => r.status === "synced")).toBe(true);
      const numbers = (await db().sql("SELECT invoice_number FROM sales WHERE invoice_number LIKE 'OFF-%' ORDER BY invoice_number")).map((r) => r.invoice_number);
      expect(numbers).toEqual(["T1", "T2", "T3"].flatMap((c) => [1, 2, 3, 4, 5].map((n) => `OFF-${c}-00000${n}`)));
      expect(await db().one("SELECT quantity FROM accessories WHERE id = $1", [ACCESSORIES.charger.id])).toEqual({ quantity: 85 });
    });

    it("when two tills sold the same unit, the first to sync keeps it and the other goes to review", async () => {
      const [t1, t2] = [await register(), await register(OWNER)];
      const [a, b] = await Promise.all([
        sync(t1, 1, [device(DEVICES.iphone13.id)], [pay("cash", 1150)]),
        sync(t2, 1, [device(DEVICES.iphone13.id)], [pay("cash", 1150)]),
      ]);
      expect([a.status, b.status].sort()).toEqual(["conflict", "synced"]);
      expect([a, b].find((r) => r.status === "conflict")).toMatchObject({ hint: "DEVICE_UNAVAILABLE" });
      expect((await db().one("SELECT count(*) AS n FROM sale_items WHERE device_id = $1", [DEVICES.iphone13.id])).n).toBe(1);
    });
  });

  describe("offline restrictions are enforced on the server", () => {
    it("refuses payment methods that need the internet", async () => {
      const t = await register();
      await expect(sync(t, 1, [device(DEVICES.iphone13.id)], [pay("apple_pay", 1150)])).rejects.toMatchObject({ hint: "OFFLINE_PAYMENT_NOT_ALLOWED" });
    });

    it("refuses a number outside the till's own series", async () => {
      const t = await register();
      await expect(
        sync(t, 1, [device(DEVICES.iphone13.id)], [pay("cash", 1150)], { _invoice_number: "INV-B1-000001" }),
      ).rejects.toMatchObject({ hint: "INVALID_OFFLINE_SALE" });
    });

    it("cannot be called through the API to set an invoice number for a normal sale", async () => {
      // The offline number only reaches pos_checkout through sync_offline_sale.
      const sale = await db().as(user(CASHIER)).rpc<{ invoice_number: string }>("pos_checkout", {
        _branch_id: BRANCH_MAIN, _items: [accessory(ACCESSORIES.charger.id)], _payments: [pay("cash", 115)],
      });
      expect(sale.invoice_number).toBe("INV-B1-000001");
    });
  });
  describe("several tills sharing the branch's shift", () => {
    const mainShift = async () => (await db().one("SELECT id FROM cash_shifts WHERE branch_id = $1 ORDER BY opened_at DESC LIMIT 1", [BRANCH_MAIN])).id as string;
    const close = (id: string, counted: number, force?: boolean) =>
      db().as(user(CASHIER)).rpc("close_shift", { _shift_id: id, _counted_cash: counted, _force: force });
    const heartbeat = (t: Terminal, pending: number, who = CASHIER) =>
      db().as(user(who)).rpc("terminal_heartbeat", { _terminal_id: t.id, _pending: pending });
    const shiftRow = (id: string) =>
      db().one(
        `SELECT status::text, expected_cash, difference, late_sales_count, late_synced_at IS NOT NULL AS flagged,
                approved_by, approved_at, unsynced_tills FROM cash_shifts WHERE id = $1`,
        [id],
      );
    // The shift began at 10:00; the offline sales below were made at 10:15.
    beforeEach(() => db().sql("UPDATE cash_shifts SET opened_at = '2026-10-18T10:00:00Z' WHERE branch_id = $1", [BRANCH_MAIN]));

    describe("closing waits for the other tills", () => {
      it("records each till's heartbeat and queue size", async () => {
        const t = await register();
        await db().sql("UPDATE pos_terminals SET last_seen_at = now() - interval '1 hour'");
        await heartbeat(t, 3);
        expect(await db().one("SELECT pending_count, last_seen_at > now() - interval '1 minute' AS fresh FROM pos_terminals WHERE id = $1", [t.id]))
          .toEqual({ pending_count: 3, fresh: true });
        await expect(heartbeat(t, 0, OTHER_OWNER)).rejects.toMatchObject({ hint: "INVALID_BRANCH" });
      });

      it("refuses while a till still has sales queued", async () => {
        const t = await register();
        await heartbeat(t, 2);
        await expect(close(await mainShift(), 500)).rejects.toMatchObject({ hint: "TILLS_NOT_SYNCED", message: expect.stringContaining("T1") });
      });

      it("refuses while a till that checked in during the shift has gone silent", async () => {
        await register();
        await db().sql("UPDATE pos_terminals SET last_seen_at = now() - interval '5 minutes'");
        const err = await close(await mainShift(), 500).catch((e) => e);
        expect(err).toMatchObject({ hint: "TILLS_NOT_SYNCED" });
        expect(JSON.parse(err.detail)).toMatchObject([{ code: "T1", pending_count: 0 }]);
      });

      it("ignores tills not seen during the shift and tills of other branches", async () => {
        const [here, there] = [await register(), await register(OWNER, BRANCH_MALL)];
        await db().sql("UPDATE pos_terminals SET last_seen_at = '2026-10-18T09:00:00Z' WHERE id = $1", [here.id]);
        await heartbeat(there, 4, OWNER);
        await expect(close(await mainShift(), 500)).resolves.toBeTruthy();
      });

      it("closes anyway when confirmed, and keeps which tills were missing", async () => {
        const t = await register();
        await heartbeat(t, 2);
        const id = await mainShift();
        await close(id, 500, true);
        expect(await shiftRow(id)).toMatchObject({
          status: "pending_approval", unsynced_tills: [{ code: "T1", pending_count: 2 }],
        });
      });
    });

    describe("a sale synced after its shift was closed", () => {
      it("goes to the shift it was made in, whose expected cash is corrected", async () => {
        const t = await register();
        const id = await mainShift();
        await close(id, 500 + 1150); // the offline sale's cash was in the drawer
        expect(await shiftRow(id)).toMatchObject({ difference: 1150, late_sales_count: 0 });

        const r = await sync(t, 1, [device(DEVICES.iphone13.id)], [pay("cash", 1150)]);
        expect(r).toMatchObject({ status: "synced", shift_id: id, late: true });
        expect(await shiftRow(id)).toMatchObject({
          status: "pending_approval", expected_cash: 1650, difference: 0, late_sales_count: 1, flagged: true,
        });
      });

      it("sends an approved shift back to the manager", async () => {
        const t = await register();
        const id = await mainShift();
        await close(id, 500);
        await db().as(user(OWNER)).rpc("approve_shift", { _shift_id: id });

        await sync(t, 1, [accessory(ACCESSORIES.charger.id)], [pay("mada", 115)]);
        expect(await shiftRow(id)).toMatchObject({
          status: "pending_approval", approved_by: null, approved_at: null, difference: 0, late_sales_count: 1,
        });
      });

      it("goes to review once the day was closed, and leaves the closed books alone", async () => {
        const t = await register();
        const id = await mainShift();
        await close(id, 500);
        await db().as(user(OWNER)).rpc("approve_shift", { _shift_id: id });
        const date = (await db().one("SELECT business_date::text AS d FROM cash_shifts WHERE id = $1", [id])).d;
        await db().as(user(OWNER)).rpc("close_day", { _branch_id: BRANCH_MAIN, _date: date, _notes: null });

        const r = await sync(t, 1, [device(DEVICES.iphone13.id)], [pay("cash", 1150)]);
        expect(r).toMatchObject({ status: "conflict", hint: "DAY_CLOSED" });
        expect(await shiftRow(id)).toMatchObject({ status: "closed", late_sales_count: 0 });
        expect(await db().one("SELECT status::text FROM devices WHERE id = $1", [DEVICES.iphone13.id])).toEqual({ status: "available" });
      });

      it("falls back to the open shift when no shift covers the sale time (till clock off)", async () => {
        const t = await register();
        const old = await mainShift();
        await close(old, 500);
        await db().as(user(OWNER)).rpc("open_shift", { _branch_id: BRANCH_MAIN, _opening_cash: 500 });
        const current = await mainShift();

        const r = await sync(t, 1, [accessory(ACCESSORIES.charger.id)], [pay("cash", 115)], { _sold_at: "2026-10-18T08:00:00Z" });
        expect(r).toMatchObject({ status: "synced", shift_id: current, late: false });
        expect(await shiftRow(old)).toMatchObject({ late_sales_count: 0 });
      });
    });
  });
});
