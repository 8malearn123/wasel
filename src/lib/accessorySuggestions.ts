import type { Accessory } from "@/types/database";

// Brand words that tie an accessory to one device family. An accessory naming
// one of these fits that family only — a Galaxy cover is no use to an iPhone.
const BRAND_ALIASES: Record<string, string[]> = {
  apple: ["apple", "iphone", "ipad", "macbook", "airpod", "ايفون", "ابل", "ايباد", "ماك"],
  samsung: ["samsung", "galaxy", "سامسونج", "جالكسي", "قالكسي"],
  xiaomi: ["xiaomi", "redmi", "poco", "شاومي", "ريدمي"],
  huawei: ["huawei", "honor", "هواوي", "هونر"],
  oppo: ["oppo", "realme", "اوبو", "ريلمي"],
  google: ["google", "pixel", "جوجل", "بكسل"],
  sony: ["sony", "سوني"],
  nokia: ["nokia", "نوكيا"],
  hp: ["hp", "اتش بي"],
  dell: ["dell", "ديل"],
  lenovo: ["lenovo", "لينوفو"],
};

// What a phone buyer usually walks out with alongside the device
const COMPANION_KEYWORDS = [
  "كفر", "جراب", "حافظ", "case", "cover",
  "شاشه", "حمايه", "لاصق", "زجاج", "screen", "protector", "glass",
  "شاحن", "charger", "كابل", "cable", "وصله", "adapter", "محول",
  "باور", "بانك", "power", "bank", "بطاريه", "battery",
  "سماعه", "سماعات", "earbud", "headphone", "airpod",
  "ذاكره", "memory", "حامل", "stand", "ستاند",
];

// Arabic is written many ways for the same word, so fold the forms that differ
// only by spelling before matching
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");

const brandKeysIn = (text: string): string[] => {
  const normalized = normalize(text);
  return Object.entries(BRAND_ALIASES)
    .filter(([, aliases]) => aliases.some(alias => normalized.includes(alias)))
    .map(([key]) => key);
};

// The add-ons a phone buyer is offered by name, whatever else is in stock.
// Order matters: an accessory is claimed by the first kind it matches, so a
// "كابل شاحن" lands under the cable rather than the charger.
export const ACCESSORY_KINDS = [
  {
    key: "screen",
    labelAr: "حماية شاشة",
    labelEn: "Screen protector",
    keywords: ["شاشه", "screen", "protector", "زجاج", "glass", "لاصق", "tempered"],
  },
  {
    key: "cable",
    labelAr: "كابل شاحن",
    labelEn: "Charging cable",
    keywords: ["كابل", "كيبل", "cable", "سلك", "وصله", "type-c", "typec", "lightning", "usb"],
  },
  {
    key: "charger",
    labelAr: "شاحن",
    labelEn: "Charger",
    keywords: ["شاحن", "charger", "محول", "adapter", "شحن", "wireless"],
  },
] as const;

export type AccessoryKind = (typeof ACCESSORY_KINDS)[number];

interface SuggestOptions {
  /** Accessory ids already in the cart */
  exclude?: string[];
  limit?: number;
}

interface ScoredAccessory {
  accessory: Accessory;
  score: number;
  text: string;
}

// Every accessory that could go with this device, best fit first
function scoreAccessories(
  deviceLabel: string,
  accessories: Accessory[],
  exclude: string[]
): ScoredAccessory[] {
  const deviceBrands = brandKeysIn(deviceLabel);
  const modelTokens = normalize(deviceLabel)
    .split(/\s+/)
    .filter(token => token.length >= 2);
  const excluded = new Set(exclude);

  return accessories
    .flatMap(accessory => {
      if (accessory.quantity <= 0 || excluded.has(accessory.id)) return [];

      const text = normalize(
        `${accessory.name} ${accessory.brand || ""} ${accessory.category || ""}`
      );
      const accessoryBrands = brandKeysIn(text);

      // Made for another device family — never a fit
      if (
        accessoryBrands.length > 0 &&
        !accessoryBrands.some(brand => deviceBrands.includes(brand))
      ) {
        return [];
      }

      let score = 0;
      if (accessoryBrands.length > 0) {
        score += 50;
        // Same family and the exact model named — the closest match there is
        if (modelTokens.some(token => text.includes(token))) score += 100;
      }
      if (COMPANION_KEYWORDS.some(keyword => text.includes(keyword))) score += 25;

      return score > 0 ? [{ accessory, score, text }] : [];
    })
    .sort(
      (a, b) =>
        b.score - a.score || Number(a.accessory.price) - Number(b.accessory.price)
    );
}

/**
 * The named add-ons — screen protector, charging cable, charger — each paired
 * with the best accessory in stock that fits the device, or null when the
 * branch carries nothing for it.
 */
export function pickAccessoryKinds(
  deviceLabel: string,
  accessories: Accessory[],
  { exclude = [] }: Pick<SuggestOptions, "exclude"> = {}
): { kind: AccessoryKind; accessory: Accessory | null }[] {
  const scored = scoreAccessories(deviceLabel, accessories, exclude);
  const taken = new Set<string>();

  return ACCESSORY_KINDS.map(kind => {
    const match = scored.find(
      entry =>
        !taken.has(entry.accessory.id) &&
        kind.keywords.some(keyword => entry.text.includes(keyword))
    );
    if (match) taken.add(match.accessory.id);
    return { kind, accessory: match?.accessory ?? null };
  });
}

/**
 * Accessories worth offering next to a device — a cover, a screen protector, a
 * charger — ordered by how well they fit it.
 *
 * @param deviceLabel how the device reads on screen, e.g. "Apple iPhone 13"
 */
export function suggestAccessories(
  deviceLabel: string,
  accessories: Accessory[],
  { exclude = [], limit = 4 }: SuggestOptions = {}
): Accessory[] {
  return scoreAccessories(deviceLabel, accessories, exclude)
    .slice(0, limit)
    .map(entry => entry.accessory);
}
