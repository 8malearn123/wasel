import { describe, it, expect } from 'vitest';
import { authErrorMessage, codeLoginFailure, markSessionEnded, takeSessionEnded } from './authErrors';

describe('authErrorMessage', () => {
  it('words the server\'s English answers in Arabic', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials', status: 400 })).toBe('البريد أو كلمة المرور غير صحيحة');
    expect(authErrorMessage({ message: 'Email not confirmed' })).toMatch(/لم يُفعَّل البريد/);
    expect(authErrorMessage({ message: 'User already registered' })).toBe('هذا البريد مسجل مسبقاً');
    expect(authErrorMessage({ message: 'Request rate limit reached', status: 429 })).toMatch(/محاولات كثيرة/);
  });
  it('tells a dropped connection and a server failure apart from a wrong password', () => {
    expect(authErrorMessage({ message: 'TypeError: Failed to fetch' })).toMatch(/تعذّر الاتصال/);
    expect(authErrorMessage({ message: 'upstream error', status: 502 })).toMatch(/خطأ في الخادم/);
    expect(authErrorMessage({ message: 'something odd' })).not.toMatch(/something/);
  });
});

describe('codeLoginFailure', () => {
  const res = (status: number, body: string) => new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
  it('keeps the server\'s own message for a wrong code or too many tries', async () => {
    expect(await codeLoginFailure(res(401, '{"error":"كود الدخول غير صحيح"}'))).toBe('كود الدخول غير صحيح');
    expect(await codeLoginFailure(res(429, '{"error":"محاولات كثيرة. حاول بعد 15 دقيقة."}'))).toMatch(/15 دقيقة/);
  });
  it('a page that is not JSON is a server failure, not a wrong code', async () => {
    expect(await codeLoginFailure(res(502, '<html>Bad gateway</html>'))).toMatch(/خطأ في الخادم/);
    expect(await codeLoginFailure(res(404, 'Not found'))).toMatch(/خطأ في الخادم/);
  });
});

describe('session ended notice', () => {
  it('is shown once', () => {
    markSessionEnded();
    expect(takeSessionEnded()).toBe(true);
    expect(takeSessionEnded()).toBe(false);
  });
});
