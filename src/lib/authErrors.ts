import { isNetworkError } from './errors';

/**
 * What to tell a person whose sign-in failed. Supabase Auth answers in
 * English ("Invalid login credentials", "Email not confirmed", rate limits),
 * and a dropped connection arrives as «TypeError: Failed to fetch». The
 * check itself stays on the server; this only words its answer.
 */
export function authErrorMessage(err: unknown): string {
  const e = err as { message?: string; status?: number; code?: string } | null;
  const m = String(e?.message ?? err ?? '');
  if (isNetworkError(err)) return 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.';
  if (/invalid login|invalid_credentials|invalid grant/i.test(m) || e?.code === 'invalid_credentials') return 'البريد أو كلمة المرور غير صحيحة';
  if (/email not confirmed/i.test(m)) return 'لم يُفعَّل البريد بعد. افتح رسالة التفعيل في بريدك ثم سجّل الدخول.';
  if (/already registered|user already exists/i.test(m)) return 'هذا البريد مسجل مسبقاً';
  if (e?.status === 429 || /rate limit|too many/i.test(m)) return 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.';
  if (/password should be|weak password/i.test(m)) return 'كلمة المرور ضعيفة: 6 أحرف على الأقل.';
  if (/[؀-ۿ]/.test(m)) return m; // the server already answered in Arabic
  if ((e?.status ?? 0) >= 500) return 'حدث خطأ في الخادم أثناء تسجيل الدخول. أعد المحاولة بعد قليل.';
  return 'تعذّر تسجيل الدخول. أعد المحاولة، وإن تكرر الخطأ فتواصل مع الدعم.';
}

/**
 * The answer of the login-by-code endpoint. The code is checked there, never
 * here; a body that is not JSON (an HTML error page, a gateway timeout) is a
 * server failure, not a wrong code.
 */
export async function codeLoginFailure(response: Response): Promise<string> {
  let body: { error?: string } | null = null;
  try { body = await response.json(); } catch { /* not JSON */ }
  if (response.status === 429) return body?.error || 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.';
  if (response.status === 401 || response.status === 400) return body?.error || 'كود الدخول غير صحيح';
  if (response.status >= 500 || !body) return 'حدث خطأ في الخادم أثناء تسجيل الدخول بالكود. أعد المحاولة بعد قليل.';
  return body.error || 'كود الدخول غير صحيح';
}

const EXPIRED_KEY = 'wasel.sessionEnded';

/** The session ended without the person signing out (expired, revoked). Shown once on the sign-in page. */
export const markSessionEnded = () => { try { sessionStorage.setItem(EXPIRED_KEY, '1'); } catch { /* storage blocked */ } };
export const takeSessionEnded = (): boolean => {
  try {
    const v = sessionStorage.getItem(EXPIRED_KEY) === '1';
    sessionStorage.removeItem(EXPIRED_KEY);
    return v;
  } catch { return false; }
};

// A sign-out this tab asked for is not an expired session
let signOutRequested = false;
export const expectSignOut = () => { signOutRequested = true; };
/** Called on SIGNED_OUT: was it asked for here? Resets the flag. */
export const consumeSignOutRequest = (): boolean => { const v = signOutRequested; signOutRequested = false; return v; };
