import type { Accessory, Device } from "@/types/database";
import type { PaymentLine } from "@/lib/payments";
import { splitVatInclusive } from "@/lib/vat";

/** Tenders allowed while offline: cash and a standalone card terminal. */
export const OFFLINE_METHODS = ["cash", "mada", "card"] as const;

/** A sale made while offline, queued on the device until it can be synced. */
export interface OfflineSale {
  /** Idempotency key; also sent with the online attempt that preceded it, if any. */
  client_ref: string;
  terminal_id: string;
  branch_id: string;
  /** Printed for the customer, e.g. OFF-T1-000001. Kept as the official number. */
  invoice_number: string;
  sold_at: string;
  items: ({ type: "device"; id: string } | { type: "accessory"; id: string; quantity: number })[];
  payments: PaymentLine[];
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

export interface OfflineCartLine {
  type: "device" | "accessory";
  price: number;
  quantity: number;
  deviceId?: string;
  accessoryId?: string;
}

export const formatOfflineNumber = (prefix: string, n: number) => `${prefix}-${String(n).padStart(6, "0")}`;

/**
 * Builds a queued sale from the cart. Throws (with an Arabic message for the cashier)
 * when the sale breaks an offline restriction.
 */
export function buildOfflineSale(input: {
  clientRef: string;
  terminalId: string;
  branchId: string;
  invoiceNumber: string;
  cart: OfflineCartLine[];
  payments: PaymentLine[];
  discount: number;
  vatEnabled: boolean;
  customerName?: string;
  customerPhone?: string;
  now?: Date;
}): OfflineSale {
  if (input.cart.length === 0) throw new Error("السلة فارغة");
  if (input.discount > 0) throw new Error("الخصم والكوبونات غير متاحة بدون إنترنت");
  if (input.payments.some((p) => !(OFFLINE_METHODS as readonly string[]).includes(p.method))) {
    throw new Error("بدون إنترنت: الدفع نقداً أو بالشبكة فقط");
  }

  const gross = input.cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const { total, tax, net } = splitVatInclusive(gross, input.vatEnabled);
  const paid = Math.round(input.payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
  if (paid !== total) throw new Error(`مجموع المدفوعات (${paid}) لا يساوي الإجمالي (${total})`);

  return {
    client_ref: input.clientRef,
    terminal_id: input.terminalId,
    branch_id: input.branchId,
    invoice_number: input.invoiceNumber,
    sold_at: (input.now ?? new Date()).toISOString(),
    items: input.cart.map((l) =>
      l.type === "device"
        ? { type: "device" as const, id: l.deviceId! }
        : { type: "accessory" as const, id: l.accessoryId!, quantity: l.quantity },
    ),
    payments: input.payments,
    customer_name: input.customerName || undefined,
    customer_phone: input.customerPhone || undefined,
    subtotal: net,
    tax_amount: tax,
    total_amount: total,
  };
}

/** Removes what a queued sale took from the till's cached stock, so it can't be sold twice here. */
export function applySaleToStock<T extends { devices: Device[]; accessories: Accessory[] }>(stock: T, sale: OfflineSale): T {
  const soldDevices = new Set(sale.items.filter((i) => i.type === "device").map((i) => i.id));
  const taken = new Map<string, number>();
  for (const i of sale.items) if (i.type === "accessory") taken.set(i.id, (taken.get(i.id) ?? 0) + i.quantity);
  return {
    ...stock,
    devices: stock.devices.filter((d) => !soldDevices.has(d.id)),
    accessories: stock.accessories
      .map((a) => (taken.has(a.id) ? { ...a, quantity: a.quantity - (taken.get(a.id) ?? 0) } : a))
      .filter((a) => a.quantity > 0),
  };
}

/** True when an error means "no connection", not "the server said no". */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message : typeof err === "object" && err ? String((err as { message?: unknown }).message ?? "") : String(err ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected|timeout/i.test(msg);
}

export type SyncOutcome =
  | { status: "synced"; invoice_number?: string }
  | { status: "conflict"; reason?: string; hint?: string };

export interface SyncReport {
  synced: number;
  conflicts: { invoice_number: string; reason?: string }[];
  /** Stopped because the connection dropped again; the rest stays queued. */
  interrupted: boolean;
}

/**
 * Replays queued sales oldest first. A sale leaves the queue once the server has an
 * answer for it (synced, or recorded as a conflict for review). A network error stops
 * the run and keeps the rest; any other error keeps that sale and moves on.
 */
export async function syncQueue(
  sales: OfflineSale[],
  send: (sale: OfflineSale) => Promise<SyncOutcome>,
  remove: (clientRef: string) => Promise<void>,
): Promise<SyncReport> {
  const report: SyncReport = { synced: 0, conflicts: [], interrupted: false };
  const ordered = [...sales].sort((a, b) => a.sold_at.localeCompare(b.sold_at) || a.invoice_number.localeCompare(b.invoice_number));
  for (const sale of ordered) {
    let outcome: SyncOutcome;
    try {
      outcome = await send(sale);
    } catch (err) {
      if (isNetworkError(err)) {
        report.interrupted = true;
        break;
      }
      continue;
    }
    await remove(sale.client_ref);
    if (outcome.status === "synced") report.synced++;
    else report.conflicts.push({ invoice_number: sale.invoice_number, reason: outcome.reason });
  }
  return report;
}
