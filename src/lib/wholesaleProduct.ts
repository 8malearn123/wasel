/**
 * What a wholesale buyer is told about a listed product.
 *
 * A buyer cannot read the supplier's devices or accessories (RLS keeps every
 * shop's stock private), so the market showed «—» where the product belongs.
 * When a supplier lists a product, its description is saved with the listing
 * — in wholesale_listings.notes, which nothing else uses — so every buyer who
 * sees the listing sees what is on offer. Only what a buyer needs: no IMEI, no
 * cost.
 */

export interface ListingProduct {
  kind: 'device' | 'accessory';
  name: string;
  brand?: string | null;
  model?: string | null;
  storage?: string | null;
  color?: string | null;
  condition?: string | null;
  category?: string | null;
  sku?: string | null;
}

const KEY = 'wasel_product';

type DeviceLike = { model?: string | null; brand?: string | null; storage?: string | null; color?: string | null; condition?: string | null; category?: string | null };
type AccessoryLike = { name?: string | null; brand?: string | null; sku?: string | null; category?: string | null };

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as T;

export function productFromDevice(d: DeviceLike): ListingProduct {
  const name = [d.brand, d.model].filter(Boolean).join(' ').trim() || 'جهاز';
  return clean({ kind: 'device' as const, name, brand: d.brand, model: d.model, storage: d.storage, color: d.color, condition: d.condition, category: d.category });
}

export function productFromAccessory(a: AccessoryLike): ListingProduct {
  return clean({ kind: 'accessory' as const, name: a.name?.trim() || 'إكسسوار', brand: a.brand, sku: a.sku, category: a.category });
}

/** The listing's notes with the product written into them */
export const productNotes = (p: ListingProduct) => JSON.stringify({ [KEY]: p });

/** The product a listing's notes carry, if they carry one */
export function productFromNotes(notes: string | null | undefined): ListingProduct | null {
  if (!notes || !notes.includes(KEY)) return null;
  try {
    const p = JSON.parse(notes)?.[KEY];
    return p && typeof p.name === 'string' && (p.kind === 'device' || p.kind === 'accessory') ? p as ListingProduct : null;
  } catch {
    return null;
  }
}

const CONDITION_AR: Record<string, string> = { new: 'جديد', used: 'مستعمل', refurbished: 'مجدد', 'like_new': 'شبه جديد' };

/** «256GB · أسود · جديد» — the details after the name */
export function productDetails(p: ListingProduct): string {
  const parts = p.kind === 'device'
    ? [p.storage, p.color, p.condition ? CONDITION_AR[p.condition] ?? p.condition : null]
    : [p.brand, p.sku];
  return parts.filter(Boolean).join(' · ');
}
