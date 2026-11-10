/**
 * Settings the app keeps in the browser, kept per shop.
 *
 * They used to be stored under one key for everyone using the browser, so a
 * second shop signing in on the same device saw the first shop's receipt
 * settings and stocktake schedule. Each shop now has its own key. A value
 * saved before this change (under the bare key) is taken over by the first
 * shop that reads it — on almost every device that is the shop that saved
 * it — and then removed, so no other shop picks it up.
 */
const scoped = (base: string, shopId: string) => `${base}:${shopId}`;

export function readShop<T>(base: string, shopId: string | null | undefined, fallback: T): T {
  if (!shopId) return fallback;
  try {
    const own = localStorage.getItem(scoped(base, shopId));
    if (own !== null) return JSON.parse(own) as T;
    const legacy = localStorage.getItem(base);
    if (legacy !== null) {
      localStorage.setItem(scoped(base, shopId), legacy);
      localStorage.removeItem(base);
      return JSON.parse(legacy) as T;
    }
  } catch { /* storage blocked or bad JSON */ }
  return fallback;
}

export function writeShop(base: string, shopId: string | null | undefined, value: unknown): void {
  if (!shopId) return;
  try { localStorage.setItem(scoped(base, shopId), JSON.stringify(value)); } catch { /* storage blocked */ }
}
