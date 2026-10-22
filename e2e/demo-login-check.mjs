// One-off: every entry of the login page's demo list, used as a person would —
// click it, press the login button, see where it lands. Writes are blocked
// apart from signing in.
import { chromium } from 'playwright';
const SITE = process.env.SITE;
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ENTRIES = [
  { label: 'كاشير تجريبي', text: 'كاشير تجريبي', submit: 'دخول' },
  { label: 'باقة لايت', text: 'باقة لايت (Lite)', submit: 'تسجيل الدخول' },
  { label: 'باقة برو', text: 'باقة برو (Pro)', submit: 'تسجيل الدخول' },
  { label: 'باقة ماكس', text: 'باقة ماكس (Max)', submit: 'تسجيل الدخول' },
  { label: 'أدمن', text: 'أدمن (Admin)', submit: 'تسجيل الدخول' },
  { label: 'موظف مبيعات', text: 'موظف مبيعات', submit: 'تسجيل الدخول' },
  { label: 'كاشير ماكس', text: 'كاشير (Cashier)', submit: 'تسجيل الدخول' },
];
const browser = await chromium.launch();
const results = [];
async function shot(page, label) {
  const jpg = await page.screenshot({ type: 'jpeg', quality: 40 });
  console.log(`SHOT-BEGIN ${label}`);
  const b64 = jpg.toString('base64');
  for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
  console.log(`SHOT-END ${label}`);
}
async function fresh() {
  const context = await browser.newContext({ locale: 'ar', viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('language', 'ar'));
  await context.route(`${SUPA}/**`, route => {
    const m = route.request().method(), u = route.request().url();
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(m) && !u.includes('/rpc/') && !u.includes('/auth/v1/') && !u.includes('/functions/v1/login-by-code')) {
      return route.fulfill({ status: 403, body: '{}' });
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return { context, page, errors };
}
const settle = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
};

for (const e of ENTRIES) {
  const { context, page, errors } = await fresh();
  let outcome;
  try {
    await page.goto(`${SITE}/auth`); await settle(page);
    await page.getByRole('button', { name: new RegExp(e.text.replace(/[()]/g, '\\$&')) }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: new RegExp(`^\\s*${e.submit}\\s*$`) }).first().click();
    await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 }).catch(() => {});
    await settle(page);
    const path = new URL(page.url()).pathname;
    const alert = await page.locator('.text-destructive').allInnerTexts().catch(() => []);
    const crashed = await page.getByText('صار خطأ في عرض هذه الصفحة').count();
    const expired = await page.getByText(/انتهى|منتهي|expired/i).count();
    outcome = path.startsWith('/auth')
      ? `FAIL stayed on login${alert.length ? ': ' + alert.join(' | ') : ''}`
      : crashed ? `FAIL page error at ${path}` : `OK → ${path}${expired ? ' (subscription notice shown)' : ''}`;
  } catch (err) {
    outcome = `FAIL ${err.message.split('\n')[0]}`;
  }
  if (errors.length) outcome += ` · js: ${errors[0].slice(0, 120)}`;
  console.log(`[${e.label}] ${outcome}`);
  results.push({ label: e.label, outcome });
  await shot(page, e.label);
  await context.close();
}

// the shop visitor: the public store and its products
{
  const { context, page, errors } = await fresh();
  await page.goto(`${SITE}/auth`); await settle(page);
  await page.getByText('عميل (زائر المتجر)').click();
  await settle(page);
  const path = new URL(page.url()).pathname;
  const products = await page.locator('a[href*="/device/"], a[href*="/accessory/"]').count();
  const outcome = path.startsWith('/store/') && products > 0 ? `OK → ${path} (${products} product links)` : `FAIL at ${path}, ${products} products`;
  console.log(`[زائر المتجر] ${outcome}${errors.length ? ' · js: ' + errors[0].slice(0, 120) : ''}`);
  results.push({ label: 'زائر المتجر', outcome });
  await shot(page, 'زائر المتجر');
  await context.close();
}
// the platform admin: its own login page opens (its credentials are not on the list)
{
  const { context, page, errors } = await fresh();
  await page.goto(`${SITE}/auth`); await settle(page);
  await page.getByText('مبارك (مدير المنصة)').click();
  await settle(page);
  const path = new URL(page.url()).pathname;
  const inputs = await page.locator('input').count();
  const outcome = path === '/admin/login' && inputs >= 2 ? 'OK → /admin/login (login form shown)' : `FAIL at ${path}`;
  console.log(`[مدير المنصة] ${outcome}${errors.length ? ' · js: ' + errors[0].slice(0, 120) : ''}`);
  results.push({ label: 'مدير المنصة', outcome });
  await shot(page, 'مدير المنصة');
  await context.close();
}
await browser.close();
console.log('SUMMARY ' + JSON.stringify(results));
