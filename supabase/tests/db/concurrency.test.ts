import { beforeEach, describe, it, expect } from "vitest";
import { setTimeout as sleep } from "node:timers/promises";
import { useTestDb } from "./use-test-db";
import { anon, user } from "./harness";
import { ACCESSORIES, BRANCH_MAIN, DEVICES, OWNER, STORE_SLUG, accessory, device, pay, openShifts } from "./fixtures";

/** Tracks whether a promise has settled, without awaiting it. */
function track<T>(promise: Promise<T>) {
  const state = { settled: false, promise };
  promise.then(
    () => (state.settled = true),
    () => (state.settled = true),
  );
  return state;
}

const shopper = (phone: string) => ({
  _slug: STORE_SLUG,
  _customer_name: "Shopper",
  _customer_phone: phone,
  _shipping_address: "x",
  _shipping_city: "Riyadh",
  _payment_method: "cod",
});

describe("concurrency", () => {
  const db = useTestDb();
  beforeEach(() => openShifts(db()));
  const sellIphone15 = { _branch_id: BRANCH_MAIN, _items: [device(DEVICES.iphone15.id)], _payments: [pay("cash", 4600)] };

  it("two tills selling the same IMEI: the second waits, then is refused", async () => {
    const tillA = await db().as(user(OWNER)).begin();
    await tillA.rpc("pos_checkout", sellIphone15); // A holds the row lock until it commits

    const tillB = track(db().as(user(OWNER)).rpc("pos_checkout", sellIphone15));
    await sleep(300);
    expect(tillB.settled).toBe(false); // blocked on A's lock, not reading stale data

    await tillA.commit();
    await expect(tillB.promise).rejects.toMatchObject({ hint: "DEVICE_UNAVAILABLE" });

    const { count } = await db().one("SELECT count(*) AS count FROM sale_items WHERE device_id = $1", [DEVICES.iphone15.id]);
    expect(count).toBe(1);
  });

  it("if the first till rolls back, the waiting till gets the device", async () => {
    const tillA = await db().as(user(OWNER)).begin();
    await tillA.rpc("pos_checkout", sellIphone15);

    const tillB = track(db().as(user(OWNER)).rpc<{ invoice_number: string }>("pos_checkout", sellIphone15));
    await sleep(300);
    expect(tillB.settled).toBe(false);

    await tillA.rollback();
    // A's invoice number was rolled back too, so B gets the first one.
    await expect(tillB.promise).resolves.toMatchObject({ invoice_number: "INV-B1-000001" });
  });

  it("a web order and the POS racing for one device: exactly one wins", async () => {
    const web = await db().as(anon).begin();
    await web.rpc("place_online_order", { ...shopper("0501112233"), _items: [{ device_id: DEVICES.pixel.id }] });

    const pos = track(
      db().as(user(OWNER)).rpc("pos_checkout", { _branch_id: BRANCH_MAIN, _items: [device(DEVICES.pixel.id)], _payments: [pay("cash", 2300)] }),
    );
    await sleep(300);
    expect(pos.settled).toBe(false);

    await web.commit();
    await expect(pos.promise).rejects.toMatchObject({ hint: "DEVICE_UNAVAILABLE" });
    expect(await db().one("SELECT status::text FROM devices WHERE id = $1", [DEVICES.pixel.id])).toEqual({ status: "reserved" });
  });

  it("30 parallel sales get unique, gap-free invoice numbers and exact stock", async () => {
    await db().sql("UPDATE accessories SET quantity = 1000 WHERE id = $1", [ACCESSORIES.charger.id]);
    const n = 30;

    const results = await Promise.all(
      Array.from({ length: n }, () =>
        db().as(user(OWNER)).rpc<{ invoice_number: string }>("pos_checkout", {
          _branch_id: BRANCH_MAIN,
          _items: [accessory(ACCESSORIES.charger.id)],
          _payments: [pay("cash", 115)],
        }),
      ),
    );

    const numbers = results.map((r) => r.invoice_number).sort();
    const expected = Array.from({ length: n }, (_, i) => `INV-B1-${String(i + 1).padStart(6, "0")}`);
    expect(numbers).toEqual(expected);
    expect(await db().one("SELECT quantity FROM accessories WHERE id = $1", [ACCESSORIES.charger.id])).toEqual({ quantity: 1000 - n });
  });

  it("parallel web orders for the last unit: one succeeds, the rest are refused", async () => {
    const attempts = await Promise.allSettled(
      ["0501000001", "0501000002", "0501000003", "0501000004", "0501000005"].map((phone) =>
        db().as(anon).rpc("place_online_order", { ...shopper(phone), _items: [{ accessory_id: ACCESSORIES.guard.id, quantity: 1 }] }),
      ),
    );

    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    const refused = attempts.filter((a): a is PromiseRejectedResult => a.status === "rejected");
    expect(refused).toHaveLength(4);
    for (const r of refused) expect(r.reason).toMatchObject({ hint: "INSUFFICIENT_STOCK" });
    expect(await db().one("SELECT quantity FROM accessories WHERE id = $1", [ACCESSORIES.guard.id])).toEqual({ quantity: 0 });
  });
});
