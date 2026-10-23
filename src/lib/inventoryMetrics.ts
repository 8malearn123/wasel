/**
 * One definition of each stock figure, for every screen that shows one.
 *
 * The dashboard counted only devices for sale (5), the products page every
 * device row including the sold ones (24), and the reports something else
 * again; the products page valued every unsold device, the reports only the
 * ones for sale, so the same stock read 77.2M on one page and 68.5M on
 * another. These functions are the only place the figures are worked out.
 *
 *   in stock  = not sold (for sale, reserved, in repair, in transfer)
 *   for sale  = status 'available'
 *   value     = in-stock devices + every accessory piece, at selling price,
 *               and the same at cost
 */

export interface DeviceLike { status: string; price: number | string | null; cost?: number | string | null }
export interface AccessoryLike { quantity: number | string | null; price: number | string | null; cost?: number | string | null; min_quantity?: number | string | null }
export interface SaleItemLike { quantity?: number | string | null }
export interface SaleLike { items?: SaleItemLike[] | null }

const n = (v: number | string | null | undefined) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const isInStock = (d: DeviceLike) => d.status !== 'sold';

export function deviceCounts(devices: DeviceLike[]) {
  const c = { total: devices.length, inStock: 0, available: 0, reserved: 0, sold: 0, other: 0 };
  for (const d of devices) {
    if (d.status === 'sold') c.sold++;
    else {
      c.inStock++;
      if (d.status === 'available') c.available++;
      else if (d.status === 'reserved') c.reserved++;
      else c.other++;
    }
  }
  return c;
}

export function accessoryCounts(accessories: AccessoryLike[]) {
  return {
    lines: accessories.length,
    pieces: accessories.reduce((s, a) => s + n(a.quantity), 0),
    lowStock: accessories.filter(a => n(a.quantity) <= n(a.min_quantity)).length,
  };
}

export function stockValue(devices: DeviceLike[], accessories: AccessoryLike[]) {
  const stocked = devices.filter(isInStock);
  const deviceRetail = stocked.reduce((s, d) => s + n(d.price), 0);
  const deviceCost = stocked.reduce((s, d) => s + n(d.cost), 0);
  const accessoryRetail = accessories.reduce((s, a) => s + n(a.price) * n(a.quantity), 0);
  const accessoryCost = accessories.reduce((s, a) => s + n(a.cost) * n(a.quantity), 0);
  return {
    deviceRetail, deviceCost, accessoryRetail, accessoryCost,
    retail: deviceRetail + accessoryRetail,
    cost: deviceCost + accessoryCost,
  };
}

/** Pieces sold on invoices — a sale of three chargers is three units */
export const unitsSold = (sales: SaleLike[]) =>
  sales.reduce((s, sale) => s + (sale.items ?? []).reduce((t, i) => t + (n(i.quantity) || 1), 0), 0);
