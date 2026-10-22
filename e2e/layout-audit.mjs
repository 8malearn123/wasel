// One-off layout review: every main page, Arabic and English, desktop/tablet/phone.
// Read-only (writes are blocked). Prints findings, and screenshots to review.
import { chromium } from 'playwright';
const SITE = process.env.SITE;
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
});
const session = await r.json();
const PAGES = ['/', '/pos', '/products?tab=inventory', '/products?tab=suppliers', '/sales?tab=orders', '/sales?tab=repairs',
  '/sales?tab=closings', '/sales?tab=store', '/sales?tab=customers', '/sales?tab=marketing', '/shipping', '/reports?tab=sales',
  '/team?tab=employees', '/team?tab=users', '/settings?tab=general', '/organization?tab=branches', '/subscription', '/ai-insights'];
const WIDTHS = [['desktop', 1440, 900], ['tablet', 820, 1100], ['phone', 390, 844]];
const SHOOT = (lang, w) => (w === 'desktop') || (w === 'phone' && lang === 'ar');
const browser = await chromium.launch();
for (const lang of ['ar', 'en']) {
  for (const [wname, width, height] of WIDTHS) {
    const context = await browser.newContext({ locale: lang, viewport: { width, height } });
    await context.addInitScript(([k, v, l]) => { localStorage.setItem(k, v); localStorage.setItem('language', l); },
      ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session), lang]);
    await context.route(`${SUPA}/**`, route => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(route.request().method())
      && !route.request().url().includes('/rpc/') && !route.request().url().includes('/auth/v1/')
      ? route.fulfill({ status: 403, body: '{}' }) : route.continue());
    const page = await context.newPage();
    for (const path of PAGES) {
      const errors = [];
      const onErr = e => errors.push(e.message);
      page.on('pageerror', onErr);
      await page.goto(SITE + path).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const f = await page.evaluate((lang) => {
        const vw = window.innerWidth;
        const visible = el => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0; };
        const overflowX = document.documentElement.scrollWidth - vw;
        // what sticks out past the screen's edges (not inside its own scroll box)
        const out = [];
        for (const el of document.body.querySelectorAll('*')) {
          if (!visible(el) || el.closest('[data-radix-popper-content-wrapper]')) continue;
          const b = el.getBoundingClientRect();
          if (b.right > vw + 2 || b.left < -2) {
            let p = el.parentElement, clipped = false;
            while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; } p = p.parentElement; }
            if (!clipped && getComputedStyle(el).position !== 'fixed') out.push(`${el.tagName.toLowerCase()}.${(el.className?.toString() || '').split(' ').slice(0, 3).join('.')} «${(el.innerText || '').trim().slice(0, 30)}» [${Math.round(b.left)}..${Math.round(b.right)}]`);
          }
        }
        // text in the other language, and text too small to read
        const wrong = new Set(), tiny = new Set();
        const allow = /^(PIXA|IMEI|SKU|SEO|POS|SAR|VAT|AI|API|URL|PDF|CSV|Excel|Apple|Pay|iPhone|iPad|MacBook|Samsung|Galaxy|Xiaomi|Pixel|Google|Anker|Lenovo|Dell|Canon|HP|AirPods|mada|VISA|Mastercard|tabby|tamara|SMSA|Aramex|DHL|Max|Pro|Lite|Plus|Air|USB|GB|TB|mAh|Wi-Fi|WhatsApp|Snapchat|TikTok|Instagram|Camera|ORD|PO|demo|wasil|com|https|http|www|vercel|app|store|alanam|max)$/i;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          const t = n.textContent.trim(); const el = n.parentElement;
          if (!t || !el || !visible(el) || el.closest('script,style,[aria-hidden="true"],input,textarea,code,.font-mono')) continue;
          if (lang === 'en' && /[؀-ۿ]/.test(t) && !/^ر\.س$/.test(t)) wrong.add(t.slice(0, 40));
          if (lang === 'ar') { const words = (t.match(/[A-Za-z][A-Za-z'’-]{2,}/g) || []).filter(w => !allow.test(w)); if (words.length && !/@|\.(com|sa|app)/.test(t)) wrong.add(t.slice(0, 40)); }
          const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11) tiny.add(`${fs}px «${t.slice(0, 25)}»`);
        }
        return { overflowX, out: out.slice(0, 5), wrong: [...wrong].slice(0, 12), wrongCount: wrong.size, tiny: [...tiny].slice(0, 6), tinyCount: tiny.size, dir: document.documentElement.dir };
      }, lang);
      page.off('pageerror', onErr);
      const flags = [];
      if (f.overflowX > 2) flags.push(`SIDEWAYS-SCROLL ${f.overflowX}px`);
      if (f.out.length) flags.push(`OUTSIDE ${f.out.join(' ; ')}`);
      if (f.wrongCount) flags.push(`${lang === 'en' ? 'ARABIC-IN-EN' : 'ENGLISH-IN-AR'}(${f.wrongCount}) ${f.wrong.join(' | ')}`);
      if (f.tinyCount) flags.push(`TINY(${f.tinyCount}) ${f.tiny.join(' | ')}`);
      if (errors.length) flags.push(`JS ${errors[0].slice(0, 100)}`);
      console.log(`[${lang} ${wname} ${path}] dir=${f.dir} ${flags.length ? flags.join(' || ') : 'clean'}`);
      if (SHOOT(lang, wname)) {
        const jpg = await page.screenshot({ type: 'jpeg', quality: 40 });
        console.log(`SHOT-BEGIN ${lang}_${wname}_${path.replace(/[^a-z0-9]+/gi, '_')}`);
        const b64 = jpg.toString('base64');
        for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
        console.log('SHOT-END');
      }
    }
    await context.close();
  }
}
await browser.close();
