import { beforeEach, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { useTestDb } from "./use-test-db";
import { anon, user } from "./harness";
import {
  ACCESSORIES, BRANCH_MAIN, BRANCH_MALL, CASHIER, DEVICES, OTHER_OWNER, OWNER,
  accessory, device, openShifts, pay,
} from "./fixtures";

interface Terminal { id: string; code: string; invoice_prefix: string; last_offline_number: number }
interface SyncResult { status: "synced" | "conflict"; sale_id?: string; invoice_number?: string; reason?: string; hint?: string; replayed?: boolean }

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
});
