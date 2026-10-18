import { describe, it, expect } from "vitest";
import { useTestDb } from "./use-test-db";
import { anon, user } from "./harness";
import { ACCESSORIES, BRANCH_MAIN, DEVICES, MERCHANT, OWNER, STORE_SLUG, device, pay } from "./fixtures";

interface PlacedOrder {
  order_number: string;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  total_amount: number;
  reservation_expires_at: string;
  items: { item_name: string; quantity: number; unit_price: number; device_id: string | null; accessory_id: string | null }[];
}

const shopper = {
  _slug: STORE_SLUG,
  _customer_name: "Ali",
  _customer_phone: "0501112233",
  _shipping_address: "King Fahd Rd",
  _shipping_city: "Riyadh",
  _payment_method: "cod",
};

describe("online orders", () => {
  const db = useTestDb();

  const placeOrder = (items: unknown[], overrides: Record<string, unknown> = {}) =>
    db().as(anon).rpc<PlacedOrder>("place_online_order", { ...shopper, ...overrides, _items: items });

  const setStatus = (orderNumber: string, status: string) =>
    db().as(user(OWNER)).query("UPDATE online_orders SET status = $2 WHERE order_number = $1 RETURNING status::text, stock_state", [orderNumber, status]);

  const deviceState = (id: string) =>
    db().one("SELECT status::text, reserved_until IS NOT NULL AS held_until, online_order_id IS NOT NULL AS has_order FROM devices WHERE id = $1", [id]);

  const qty = async (id: string) => (await db().one("SELECT quantity FROM accessories WHERE id = $1", [id])).quantity;

  describe("place_online_order", () => {
    it("prices the order on the server and holds the device", async () => {
      const order = await placeOrder([
        { device_id: DEVICES.pixel.id, unit_price: 1 },
        { accessory_id: ACCESSORIES.charger.id, quantity: 1, unit_price: 0 },
      ]);

      expect(order).toMatchObject({
        order_number: "ORD-000001",
        subtotal: 2415,
        shipping_cost: 0, // above the 500 free-shipping threshold
        total_amount: 2415,
        tax_amount: 315, // VAT contained in 2415
      });
      expect(order.items).toEqual([
        { item_name: "Google Pixel 8 128GB White", quantity: 1, unit_price: 2300, device_id: DEVICES.pixel.id, accessory_id: null },
        { item_name: "USB-C Charger", quantity: 1, unit_price: 115, device_id: null, accessory_id: ACCESSORIES.charger.id },
      ]);

      expect(await deviceState(DEVICES.pixel.id)).toEqual({ status: "reserved", held_until: true, has_order: true });
      expect(await qty(ACCESSORIES.charger.id)).toBe(4);

      const stored = await db().one("SELECT status::text, stock_state, payment_status::text FROM online_orders WHERE order_number = 'ORD-000001'");
      expect(stored).toEqual({ status: "pending", stock_state: "reserved", payment_status: "unpaid" });

      const minutes = (Date.parse(order.reservation_expires_at) - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(29);
      expect(minutes).toBeLessThanOrEqual(30);
    });

    it("charges shipping below the free-shipping threshold, VAT included", async () => {
      const order = await placeOrder([{ accessory_id: ACCESSORIES.charger.id, quantity: 1 }]);
      expect(order).toMatchObject({ subtotal: 115, shipping_cost: 25, total_amount: 140, tax_amount: 18.26 });
    });

    it("uses the store's reservation_ttl_minutes", async () => {
      await db().sql("UPDATE store_settings SET reservation_ttl_minutes = 1440 WHERE slug = $1", [STORE_SLUG]);
      const order = await placeOrder([{ device_id: DEVICES.pixel.id }]);
      const hours = (Date.parse(order.reservation_expires_at) - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(23.9);
    });

    it("keeps a held device away from the POS and from other shoppers", async () => {
      await placeOrder([{ device_id: DEVICES.pixel.id }]);

      await expect(
        db().as(user(OWNER)).rpc("pos_checkout", { _branch_id: BRANCH_MAIN, _items: [device(DEVICES.pixel.id)], _payments: [pay("cash", 2300)] }),
      ).rejects.toMatchObject({ hint: "DEVICE_UNAVAILABLE" });

      await expect(
        placeOrder([{ device_id: DEVICES.pixel.id }], { _customer_name: "Omar", _customer_phone: "0504445566" }),
      ).rejects.toMatchObject({ hint: "DEVICE_UNAVAILABLE" });
    });

    it("hides held devices from the public catalogue", async () => {
      await placeOrder([{ device_id: DEVICES.pixel.id }]);
      const rows = await db().as(anon).query("SELECT id FROM public_store_devices WHERE id = $1", [DEVICES.pixel.id]);
      expect(rows).toEqual([]);
    });

    const refusals: [string, unknown[], Record<string, unknown>, string][] = [
      ["an unpublished store", [{ device_id: DEVICES.pixel.id }], { _slug: "nope" }, "STORE_NOT_FOUND"],
      ["a missing name", [{ device_id: DEVICES.pixel.id }], { _customer_name: " " }, "CUSTOMER_REQUIRED"],
      ["a missing phone", [{ device_id: DEVICES.pixel.id }], { _customer_phone: "12" }, "CUSTOMER_REQUIRED"],
      ["a missing address", [{ device_id: DEVICES.pixel.id }], { _shipping_city: "" }, "ADDRESS_REQUIRED"],
      ["an unknown payment method", [{ device_id: DEVICES.pixel.id }], { _payment_method: "crypto" }, "INVALID_PAYMENT_METHOD"],
      ["an empty cart", [], {}, "EMPTY_CART"],
      ["an item with both ids", [{ device_id: DEVICES.pixel.id, accessory_id: ACCESSORIES.charger.id }], {}, "INVALID_ITEM"],
      ["a sold device", [{ device_id: DEVICES.soldIphone12.id }], {}, "DEVICE_UNAVAILABLE"],
      ["more than the stock", [{ accessory_id: ACCESSORIES.guard.id, quantity: 2 }], {}, "INSUFFICIENT_STOCK"],
      ["an absurd quantity", [{ accessory_id: ACCESSORIES.charger.id, quantity: 500 }], {}, "INVALID_QUANTITY"],
      ["over-long input", [{ device_id: DEVICES.pixel.id }], { _shipping_address: "x".repeat(1001) }, "INPUT_TOO_LONG"],
    ];

    it.each(refusals)("refuses %s without touching stock", async (_label, items, overrides, hint) => {
      await expect(placeOrder(items, overrides)).rejects.toMatchObject({ hint });
      expect(await deviceState(DEVICES.pixel.id)).toMatchObject({ status: "available" });
      expect(await qty(ACCESSORIES.charger.id)).toBe(ACCESSORIES.charger.quantity);
      expect(await qty(ACCESSORIES.guard.id)).toBe(ACCESSORIES.guard.quantity);
    });

    it("caps how many pending orders one phone can hold", async () => {
      for (let i = 0; i < 3; i++) await placeOrder([{ accessory_id: ACCESSORIES.charger.id }], { _customer_phone: "+966 50 000 0000" });
      await expect(
        placeOrder([{ accessory_id: ACCESSORIES.charger.id }], { _customer_phone: "0500000000" }),
      ).rejects.toMatchObject({ hint: "TOO_MANY_PENDING_ORDERS" });
    });
  });

  describe("direct table access (D6, D9)", () => {
    it("lets shoppers neither read nor insert orders directly", async () => {
      await placeOrder([{ device_id: DEVICES.pixel.id }]);
      expect(await db().as(anon).query("SELECT id FROM online_orders")).toEqual([]);

      await expect(
        db().as(anon).query(
          "INSERT INTO online_orders (merchant_id, order_number, customer_name, customer_phone, shipping_address, shipping_city) VALUES ($1, 'X', 'a', 'b', 'c', 'd')",
          [MERCHANT],
        ),
      ).rejects.toMatchObject({ code: "42501" });

      const [{ id }] = await db().sql("SELECT id FROM online_orders WHERE order_number = 'ORD-000001'");
      await expect(
        db().as(anon).query("INSERT INTO online_order_items (order_id, item_name, unit_price) VALUES ($1, 'free iPhone', 0)", [id]),
      ).rejects.toMatchObject({ code: "42501" });
    });

    it("still lets the merchant see their orders", async () => {
      await placeOrder([{ device_id: DEVICES.pixel.id }]);
      const rows = await db().as(user(OWNER)).query("SELECT order_number FROM online_orders WHERE order_number = 'ORD-000001'");
      expect(rows).toHaveLength(1);
    });
  });

  describe("track_public_order", () => {
    const track = (phone: string, orderNumber = "ORD-000001", slug = STORE_SLUG) =>
      db().as(anon).rpc<{ order: Record<string, unknown>; items: unknown[] } | null>("track_public_order", {
        _slug: slug,
        _order_number: orderNumber,
        _phone: phone,
      });

    it("returns the order for the last 4 digits, without address or contact details", async () => {
      await placeOrder([{ device_id: DEVICES.pixel.id }]);
      const res = await track("2233");
      expect(res?.order).toMatchObject({ order_number: "ORD-000001", status: "pending", total_amount: 2300 });
      expect(res?.order).not.toHaveProperty("shipping_address");
      expect(res?.order).not.toHaveProperty("customer_phone");
      expect(res?.order).not.toHaveProperty("customer_email");
      expect(res?.items).toHaveLength(1);
    });

    it("accepts the full number in any format", async () => {
      await placeOrder([{ device_id: DEVICES.pixel.id }]);
      for (const phone of ["0501112233", "+966 50 111 2233", "966501112233", "٠٥٠١١١٢٢٣٣"]) {
        expect((await track(phone))?.order.order_number).toBe("ORD-000001");
      }
    });

    it("returns nothing for a wrong phone, short input, unknown order or another store", async () => {
      await placeOrder([{ device_id: DEVICES.pixel.id }]);
      expect(await track("9999")).toBeNull();
      expect(await track("233")).toBeNull();
      expect(await track("0509999999")).toBeNull();
      expect(await track("2233", "ORD-999999")).toBeNull();
      expect(await track("2233", "ORD-000001", "other")).toBeNull();
    });
  });

  describe("order status drives stock", () => {
    it("sells on confirmation, restocks on cancellation, holds again on re-opening", async () => {
      const { order_number } = await placeOrder([{ device_id: DEVICES.pixel.id }, { accessory_id: ACCESSORIES.charger.id, quantity: 2 }]);
      expect(await qty(ACCESSORIES.charger.id)).toBe(3);

      expect(await setStatus(order_number, "confirmed")).toEqual([{ status: "confirmed", stock_state: "committed" }]);
      expect(await deviceState(DEVICES.pixel.id)).toEqual({ status: "sold", held_until: false, has_order: true });

      expect(await setStatus(order_number, "shipped")).toEqual([{ status: "shipped", stock_state: "committed" }]);
      expect(await deviceState(DEVICES.pixel.id)).toMatchObject({ status: "sold" });

      expect(await setStatus(order_number, "cancelled")).toEqual([{ status: "cancelled", stock_state: "released" }]);
      expect(await deviceState(DEVICES.pixel.id)).toEqual({ status: "available", held_until: false, has_order: false });
      expect(await qty(ACCESSORIES.charger.id)).toBe(5);

      expect(await setStatus(order_number, "pending")).toEqual([{ status: "pending", stock_state: "reserved" }]);
      expect(await deviceState(DEVICES.pixel.id)).toEqual({ status: "reserved", held_until: true, has_order: true });
      expect(await qty(ACCESSORIES.charger.id)).toBe(3);

      const events = await db().sql("SELECT event, ref_table FROM device_events WHERE device_id = $1 ORDER BY id", [DEVICES.pixel.id]);
      expect(events.map((e) => e.event)).toEqual(["received", "reserved", "sold", "returned", "reserved"]);
      expect(events.slice(1).every((e) => e.ref_table === "online_orders")).toBe(true);
    });

    it("refuses to re-open an order whose device was sold in the meantime", async () => {
      const { order_number } = await placeOrder([{ device_id: DEVICES.pixel.id }]);
      await setStatus(order_number, "cancelled");
      await db().as(user(OWNER)).rpc("pos_checkout", { _branch_id: BRANCH_MAIN, _items: [device(DEVICES.pixel.id)], _payments: [pay("mada", 2300)] });

      await expect(setStatus(order_number, "confirmed")).rejects.toMatchObject({ hint: "DEVICE_UNAVAILABLE" });
      expect(await db().one("SELECT status::text, stock_state FROM online_orders WHERE order_number = $1", [order_number])).toEqual({
        status: "cancelled",
        stock_state: "released",
      });
    });

    it("refunds return a confirmed order's stock", async () => {
      const { order_number } = await placeOrder([{ device_id: DEVICES.pixel.id }]);
      await setStatus(order_number, "delivered");
      await setStatus(order_number, "refunded");
      expect(await deviceState(DEVICES.pixel.id)).toMatchObject({ status: "available" });
    });

    it("leaves legacy orders (which never held stock) alone", async () => {
      const before = await db().sql("SELECT id, status::text FROM devices ORDER BY id");
      expect(await setStatus("ORD-20260301-0001", "cancelled")).toEqual([{ status: "cancelled", stock_state: "none" }]);
      expect(await db().sql("SELECT id, status::text FROM devices ORDER BY id")).toEqual(before);
    });
  });

  describe("reservation expiry", () => {
    /** Moves the hold into the past, as if its TTL had run out. */
    const expire = async (orderNumber: string) => {
      await db().sql("UPDATE online_orders SET reservation_expires_at = now() - interval '1 minute' WHERE order_number = $1", [orderNumber]);
      await db().sql("UPDATE devices SET reserved_until = now() - interval '1 minute' WHERE status = 'reserved'");
    };

    it("release_expired_reservations cancels the order and returns the stock", async () => {
      const { order_number } = await placeOrder([{ device_id: DEVICES.pixel.id }, { accessory_id: ACCESSORIES.charger.id }]);
      await expire(order_number);

      expect(await db().one("SELECT release_expired_reservations() AS n")).toEqual({ n: 1 });
      const order = await db().one("SELECT status::text, stock_state, notes FROM online_orders WHERE order_number = $1", [order_number]);
      expect(order).toMatchObject({ status: "cancelled", stock_state: "released" });
      expect(order.notes).toContain("انتهت مهلة حجز المخزون");
      expect(await deviceState(DEVICES.pixel.id)).toMatchObject({ status: "available" });
      expect(await qty(ACCESSORIES.charger.id)).toBe(5);
    });

    it("leaves holds that have not expired", async () => {
      await placeOrder([{ device_id: DEVICES.pixel.id }]);
      expect(await db().one("SELECT release_expired_reservations() AS n")).toEqual({ n: 0 });
      expect(await deviceState(DEVICES.pixel.id)).toMatchObject({ status: "reserved" });
    });

    it("is released lazily by the next POS sale, even without pg_cron", async () => {
      const { order_number } = await placeOrder([{ device_id: DEVICES.pixel.id }]);
      await expire(order_number);

      const sale = await db().as(user(OWNER)).rpc<{ total_amount: number }>("pos_checkout", {
        _branch_id: BRANCH_MAIN,
        _items: [device(DEVICES.pixel.id)],
        _payments: [pay("cash", 2300)],
      });
      expect(sale.total_amount).toBe(2300);
      expect(await db().one("SELECT status::text FROM online_orders WHERE order_number = $1", [order_number])).toEqual({ status: "cancelled" });
    });

    it("is not callable through the API", async () => {
      await expect(db().as(anon).rpc("release_expired_reservations")).rejects.toMatchObject({ code: "42501" });
      await expect(db().as(user(OWNER)).rpc("release_expired_reservations")).rejects.toMatchObject({ code: "42501" });
    });
  });
});
