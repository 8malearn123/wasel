/**
 * The app's types carry the rows a query joined in (a device's `branch` and
 * `supplier`, an order's `items`…). Those are not columns: sent back in an
 * insert or update, the server refuses the whole write. Every write goes
 * through this, which drops the joined fields and keeps the columns.
 */
const JOINED = ['branch', 'supplier', 'items', 'from_branch', 'to_branch'] as const;
type Joined = typeof JOINED[number];

export function columnsOnly<T extends object>(row: T): Omit<T, Joined> {
  const out = { ...row } as Record<string, unknown>;
  for (const k of JOINED) delete out[k];
  return out as Omit<T, Joined>;
}
