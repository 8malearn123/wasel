// How a plan's limits read on screen. The numbers come from the plans table —
// nothing here hard-codes what a plan allows.

/** 9999 is the "no ceiling" value the plans table uses; 0 or less means the same */
export const isUnlimited = (limit?: number | null) =>
  limit === undefined || limit === null || limit <= 0 || limit >= 9999;

interface ArabicForms {
  one: string;
  two: string;
  /** 3–10 */
  few: string;
  /** 11 and up */
  many: string;
}

// Arabic counts a noun four different ways, and "5 فرع" reads as broken as
// "5 branch" would in English
const arabicCount = (count: number, forms: ArabicForms) => {
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  return count <= 10 ? `${count} ${forms.few}` : `${count} ${forms.many}`;
};

export function describeBranchLimit(limit: number | null | undefined, isRTL: boolean): string {
  if (isUnlimited(limit)) return isRTL ? "فروع غير محدودة" : "Unlimited branches";
  const count = Number(limit);
  return isRTL
    ? arabicCount(count, { one: "فرع واحد", two: "فرعان", few: "فروع", many: "فرعاً" })
    : `${count} ${count === 1 ? "branch" : "branches"}`;
}

export function describeUserLimit(limit: number | null | undefined, isRTL: boolean): string {
  if (isUnlimited(limit)) return isRTL ? "عدد مستخدمين غير محدود" : "Unlimited users";
  const count = Number(limit);
  return isRTL
    ? arabicCount(count, { one: "مستخدم واحد", two: "مستخدمان", few: "مستخدمين", many: "مستخدماً" })
    : `${count} ${count === 1 ? "user" : "users"}`;
}

/** The one-line limits shown on a plan card, e.g. "فرعان · عدد مستخدمين غير محدود" */
export function describePlanLimits(
  plan: { branch_limit?: number | null; user_limit?: number | null },
  isRTL: boolean
): string {
  return `${describeBranchLimit(plan.branch_limit, isRTL)} · ${describeUserLimit(plan.user_limit, isRTL)}`;
}
