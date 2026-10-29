/**
 * What to tell a person when a request fails. Network failures reach the app
 * as «TypeError: Failed to fetch» (or NetworkError / Load failed in other
 * browsers); database codes and RLS refusals arrive as raw Postgres text.
 * Messages the database itself raises in Arabic (our triggers) pass through.
 */
export function isNetworkError(err: unknown): boolean {
  const m = String((err as { message?: string })?.message ?? err ?? '');
  return /Failed to fetch|NetworkError|Load failed|network request failed|ERR_INTERNET_DISCONNECTED|fetch failed/i.test(m);
}

export function friendlyError(err: unknown, action = 'تنفيذ العملية'): string {
  const e = err as { message?: string; code?: string } | null;
  const m = String(e?.message ?? err ?? '');
  if (isNetworkError(err)) return `تعذّر الاتصال بالخادم، ولم يتم ${action}. تحقّق من الاتصال بالإنترنت ثم أعد المحاولة.`;
  if (e?.code === '23505') return 'هذه القيمة مستخدمة من قبل (رقم مكرر). لم يُحفظ شيء.';
  if (e?.code === '42501' || /row-level security|permission denied/i.test(m)) return 'ليست لديك صلاحية لهذا الإجراء.';
  if (e?.code === '23514' || /violates check constraint/i.test(m)) return 'قيمة غير صالحة. راجِع المدخلات ثم أعد المحاولة.';
  if (/[؀-ۿ]/.test(m)) return m; // already Arabic (raised by the database for people)
  return `تعذّر ${action}. أعد المحاولة، وإن تكرر الخطأ فتواصل مع الدعم.`;
}
