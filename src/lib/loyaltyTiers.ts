export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export interface TierStyle {
  key: LoyaltyTier;
  ar: string;
  en: string;
  /** Points the tier starts at */
  from: number;
  /** Badge colours — each metal reads as itself, in light and in dark */
  badge: string;
  /** The metal itself, for the dot on the badge and the share bars */
  dot: string;
  /** Filter chip while it is the chosen tier */
  active: string;
}

// Ordered from the top tier down, the way the shop talks about them
export const LOYALTY_TIERS: TierStyle[] = [
  {
    key: "platinum",
    ar: "بلاتيني",
    en: "Platinum",
    from: 5000,
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30",
    dot: "bg-gradient-to-br from-sky-200 to-sky-500",
    active: "bg-sky-600 text-white border-sky-600 hover:bg-sky-600/90",
  },
  {
    key: "gold",
    ar: "ذهبي",
    en: "Gold",
    from: 2000,
    badge: "bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-500/40",
    dot: "bg-gradient-to-br from-amber-200 to-amber-500",
    active: "bg-amber-500 text-white border-amber-500 hover:bg-amber-500/90",
  },
  {
    key: "silver",
    ar: "فضي",
    en: "Silver",
    from: 500,
    badge: "bg-slate-400/20 text-slate-600 dark:text-slate-300 border border-slate-400/40",
    dot: "bg-gradient-to-br from-slate-100 to-slate-400",
    active: "bg-slate-500 text-white border-slate-500 hover:bg-slate-500/90",
  },
  {
    key: "bronze",
    ar: "برونزي",
    en: "Bronze",
    from: 0,
    badge: "bg-orange-700/15 text-orange-800 dark:text-orange-300 border border-orange-700/30",
    dot: "bg-gradient-to-br from-orange-300 to-orange-700",
    active: "bg-orange-700 text-white border-orange-700 hover:bg-orange-700/90",
  },
];

const BY_KEY = Object.fromEntries(LOYALTY_TIERS.map(tier => [tier.key, tier])) as Record<
  string,
  TierStyle
>;

export const tierStyle = (tier?: string): TierStyle => BY_KEY[tier || ""] ?? BY_KEY.bronze;

export const tierLabel = (tier: string | undefined, isRTL: boolean) =>
  isRTL ? tierStyle(tier).ar : tierStyle(tier).en;

/** The tier a points balance earns */
export const tierFromPoints = (points: number): LoyaltyTier =>
  (LOYALTY_TIERS.find(tier => points >= tier.from) ?? LOYALTY_TIERS[LOYALTY_TIERS.length - 1]).key;
