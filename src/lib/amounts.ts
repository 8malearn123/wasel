/**
 * The same rule the database applies (migration 20261029090600 and the
 * product checks in 20261004100000): no negative price, cost or quantity.
 * Checked before saving so the person gets one clear Arabic sentence instead
 * of a constraint name, and so a database that does not have the checks yet
 * is not the only thing standing between a typo and the books.
 */

export interface AmountRule {
  label: string;
  value: unknown;
  /** smallest allowed value (default 0) */
  min?: number;
  /** largest allowed value, e.g. 100 for a percentage */
  max?: number;
  /** whole numbers only (quantities) */
  integer?: boolean;
}

/** The first rule broken, as a sentence to show — or null when all hold. Absent values are not checked. */
export function amountProblem(rules: AmountRule[]): string | null {
  for (const r of rules) {
    if (r.value === undefined || r.value === null || r.value === '') continue;
    const n = Number(r.value);
    const min = r.min ?? 0;
    if (!Number.isFinite(n)) return `قيمة «${r.label}» غير صحيحة.`;
    if (n < min) return min === 0 ? `«${r.label}» لا يمكن أن يكون سالبًا.` : `«${r.label}» يجب ألا يقل عن ${min}.`;
    if (r.max !== undefined && n > r.max) return `«${r.label}» يجب ألا يزيد عن ${r.max}.`;
    if (r.integer && !Number.isInteger(n)) return `«${r.label}» يجب أن يكون عددًا صحيحًا.`;
  }
  return null;
}

/** Price, cost and quantity of a product row, whichever are present */
export function productAmountProblem(row: { price?: unknown; cost?: unknown; quantity?: unknown }): string | null {
  return amountProblem([
    { label: 'السعر', value: row.price },
    { label: 'التكلفة', value: row.cost },
    { label: 'الكمية', value: row.quantity, integer: true },
  ]);
}
