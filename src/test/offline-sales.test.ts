import { describe, it, expect, beforeEach } from "vitest";
import {
  applySaleToStock, buildOfflineSale, formatOfflineNumber, isNetworkError, syncQueue,
  type OfflineSale, type SyncOutcome,
} from "@/lib/offline/offlineSales";
import { createMemoryQueue, loadTerminal, saveTerminal, takeOfflineNumber } from "@/lib/offline/storage";
import type { Accessory, Device } from "@/types/database";

const base = {
  clientRef: "ref-1",
  terminalId: "t1",
  branchId: "b1",
  invoiceNumber: "OFF-T1-000001",
  vatEnabled: true,
  discount: 0,
  now: new Date("2026-10-18T10:00:00Z"),
};
const phone = { type: "device" as const, price: 1150, quantity: 1, deviceId: "d1" };
const charger = { type: "accessory" as const, price: 115, quantity: 2, accessoryId: "a1" };

describe("buildOfflineSale", () => {
  it("prices the cart VAT-inclusive like the server", () => {
    const sale = buildOfflineSale({ ...base, cart: [phone, charger], payments: [{ method: "cash", amount: 1000 }, { method: "mada", amount: 380 }] });
    expect(sale).toMatchObject({ total_amount: 1380, tax_amount: 180, subtotal: 1200, invoice_number: "OFF-T1-000001", sold_at: "2026-10-18T10:00:00.000Z" });
    expect(sale.items).toEqual([{ type: "device", id: "d1" }, { type: "accessory", id: "a1", quantity: 2 }]);
  });

  it.each([
    ["Apple Pay", { payments: [{ method: "apple_pay" as const, amount: 1150 }] }, "نقداً أو بالشبكة"],
    ["a coupon / discount", { payments: [{ method: "cash" as const, amount: 1100 }], discount: 50 }, "الخصم"],
    ["tenders that don't add up", { payments: [{ method: "cash" as const, amount: 100 }] }, "لا يساوي"],
    ["an empty cart", { payments: [{ method: "cash" as const, amount: 0 }], cart: [] }, "فارغة"],
  ])("refuses %s", (_label, override, message) => {
    expect(() => buildOfflineSale({ ...base, cart: [phone], payments: [], ...override })).toThrow(message);
  });
});

describe("applySaleToStock", () => {
  it("removes sold units and decrements accessories on the device copy", () => {
    const stock = {
      devices: [{ id: "d1" }, { id: "d2" }] as Device[],
      accessories: [{ id: "a1", quantity: 5 }, { id: "a2", quantity: 1 }] as Accessory[],
    };
    const sale = buildOfflineSale({ ...base, cart: [phone, charger, { type: "accessory", price: 10, quantity: 1, accessoryId: "a2" }], payments: [{ method: "cash", amount: 1390 }] });
    const next = applySaleToStock(stock, sale);
    expect(next.devices.map((d) => d.id)).toEqual(["d2"]);
    expect(next.accessories).toEqual([{ id: "a1", quantity: 3 }]); // a2 sold out
  });
});

describe("till number series", () => {
  beforeEach(() => localStorage.clear());

  it("formats and never reuses a number, even across reloads", () => {
    expect(formatOfflineNumber("OFF-T2", 12)).toBe("OFF-T2-000012");
    saveTerminal({ id: "t1", code: "T1", branch_id: "b1", invoice_prefix: "OFF-T1", next_number: 1 });
    expect(takeOfflineNumber("b1")?.number).toBe("OFF-T1-000001");
    expect(takeOfflineNumber("b1")?.number).toBe("OFF-T1-000002");
    expect(loadTerminal("b1")?.next_number).toBe(3);
  });

  it("has no number for a device that was never registered", () => {
    expect(takeOfflineNumber("b-unknown")).toBeNull();
  });
});

describe("syncQueue", () => {
  const sale = (n: number, soldAt: string): OfflineSale =>
    ({ ...buildOfflineSale({ ...base, cart: [phone], payments: [{ method: "cash", amount: 1150 }] }), client_ref: `r${n}`, invoice_number: `OFF-T1-00000${n}`, sold_at: soldAt });

  it("syncs oldest first and removes each sale the server answered for", async () => {
    const queue = createMemoryQueue();
    await queue.put(sale(2, "2026-10-18T10:05:00Z"));
    await queue.put(sale(1, "2026-10-18T10:00:00Z"));
    const sent: string[] = [];
    const report = await syncQueue(
      await queue.list(),
      async (s): Promise<SyncOutcome> => {
        sent.push(s.invoice_number);
        return s.client_ref === "r2" ? { status: "conflict", reason: "sold elsewhere" } : { status: "synced" };
      },
      queue.remove,
    );
    expect(sent).toEqual(["OFF-T1-000001", "OFF-T1-000002"]);
    expect(report).toEqual({ synced: 1, conflicts: [{ invoice_number: "OFF-T1-000002", reason: "sold elsewhere" }], interrupted: false });
    expect(await queue.list()).toEqual([]);
  });

  it("stops at a network error and keeps the rest queued", async () => {
    const queue = createMemoryQueue();
    await queue.put(sale(1, "2026-10-18T10:00:00Z"));
    await queue.put(sale(2, "2026-10-18T10:05:00Z"));
    const report = await syncQueue(
      await queue.list(),
      async (s) => {
        if (s.client_ref === "r2") throw new TypeError("Failed to fetch");
        return { status: "synced" } as SyncOutcome;
      },
      queue.remove,
    );
    expect(report).toMatchObject({ synced: 1, interrupted: true });
    expect((await queue.list()).map((s) => s.client_ref)).toEqual(["r2"]);
  });

  it("keeps a sale that failed for another reason and moves on", async () => {
    const queue = createMemoryQueue();
    await queue.put(sale(1, "2026-10-18T10:00:00Z"));
    await queue.put(sale(2, "2026-10-18T10:05:00Z"));
    const report = await syncQueue(
      await queue.list(),
      async (s) => {
        if (s.client_ref === "r1") throw { message: "permission denied", code: "42501" };
        return { status: "synced" } as SyncOutcome;
      },
      queue.remove,
    );
    expect(report).toMatchObject({ synced: 1, interrupted: false });
    expect((await queue.list()).map((s) => s.client_ref)).toEqual(["r1"]);
  });
});

describe("isNetworkError", () => {
  it("tells a dropped connection from a server refusal", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError({ message: "TypeError: NetworkError when attempting to fetch resource." })).toBe(true);
    expect(isNetworkError({ message: "الجهاز غير متاح للبيع", hint: "DEVICE_UNAVAILABLE" })).toBe(false);
  });
});
