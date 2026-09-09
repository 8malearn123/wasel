import type { Device } from "@/types/database";

export interface ColorOption {
  nameAr: string;
  nameEn: string;
  /** Swatch shown in the picker */
  hex: string;
}

// The colours phones actually ship in, so the shop picks instead of typing
export const DEVICE_COLORS: ColorOption[] = [
  { nameAr: "أسود", nameEn: "Black", hex: "#1C1C1E" },
  { nameAr: "أبيض", nameEn: "White", hex: "#F5F5F7" },
  { nameAr: "فضي", nameEn: "Silver", hex: "#C7C9CC" },
  { nameAr: "رمادي", nameEn: "Gray", hex: "#6B7280" },
  { nameAr: "ذهبي", nameEn: "Gold", hex: "#D4AF6A" },
  { nameAr: "تيتانيوم طبيعي", nameEn: "Natural Titanium", hex: "#A9A29A" },
  { nameAr: "أزرق", nameEn: "Blue", hex: "#2563EB" },
  { nameAr: "أخضر", nameEn: "Green", hex: "#16A34A" },
  { nameAr: "أحمر", nameEn: "Red", hex: "#DC2626" },
  { nameAr: "بنفسجي", nameEn: "Purple", hex: "#7C3AED" },
  { nameAr: "وردي", nameEn: "Pink", hex: "#EC4899" },
];

export const STORAGE_OPTIONS = ["64GB", "128GB", "256GB", "512GB", "1TB"];

export const COMMON_BRANDS = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Huawei",
  "Google",
  "Oppo",
  "Realme",
  "Honor",
  "Sony",
  "Nokia",
];

// Model words that name their maker, so typing "iPhone 15 Pro" fills in Apple
const BRAND_BY_KEYWORD: Record<string, string> = {
  iphone: "Apple",
  ipad: "Apple",
  macbook: "Apple",
  airpods: "Apple",
  imac: "Apple",
  "ايفون": "Apple",
  "ايباد": "Apple",
  galaxy: "Samsung",
  "جالكسي": "Samsung",
  "سامسونج": "Samsung",
  redmi: "Xiaomi",
  poco: "Xiaomi",
  "شاومي": "Xiaomi",
  "ريدمي": "Xiaomi",
  pixel: "Google",
  nova: "Huawei",
  mate: "Huawei",
  "هواوي": "Huawei",
  honor: "Honor",
  reno: "Oppo",
  oppo: "Oppo",
  realme: "Realme",
  xperia: "Sony",
  sony: "Sony",
  nokia: "Nokia",
  pavilion: "HP",
  elitebook: "HP",
  inspiron: "Dell",
  latitude: "Dell",
  xps: "Dell",
  thinkpad: "Lenovo",
  ideapad: "Lenovo",
};

const normalize = (value: string) => value.toLowerCase().trim();

/** The maker a model name gives away, when it gives one away */
export function brandFromModel(model: string): string | null {
  const text = normalize(model);
  if (!text) return null;

  for (const [keyword, brand] of Object.entries(BRAND_BY_KEYWORD)) {
    if (text.includes(keyword)) return brand;
  }
  return null;
}

const newest = (devices: Device[]): Device | null =>
  devices.length === 0
    ? null
    : devices.reduce((latest, device) =>
        new Date(device.created_at) > new Date(latest.created_at) ? device : latest
      );

/**
 * The device already in stock that a half-typed entry looks like, so the rest
 * of the form can fill itself in.
 *
 * An IMEI is matched on its first 8 digits — the type allocation code, which is
 * the same for every unit of a model — and otherwise the model name is matched.
 * The most recently added match wins, since that is the shop's latest word on
 * the price.
 */
export function findSimilarDevice(
  devices: Device[],
  { imei, model }: { imei?: string; model?: string }
): Device | null {
  const digits = (imei || "").replace(/\D/g, "");

  if (digits.length >= 8) {
    const tac = digits.slice(0, 8);
    const sameModel = devices.filter(
      device => device.imei.replace(/\D/g, "").startsWith(tac) && device.imei !== imei
    );
    const match = newest(sameModel);
    if (match) return match;
  }

  const text = normalize(model || "");
  if (text.length >= 3) {
    const exact = devices.filter(device => normalize(device.model) === text);
    const partial = devices.filter(device => normalize(device.model).includes(text));
    return newest(exact.length > 0 ? exact : partial);
  }

  return null;
}
