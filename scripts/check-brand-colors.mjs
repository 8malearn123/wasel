#!/usr/bin/env node
/**
 * فاحص هوية وصل — يمنع أي لون خارج لوحة الهوية الرسمية v1.0
 *   أزرق #2F6BFF · حبر #12151B · رمادي #6B7280 · نجاح #16A34A · سطح #F6F7F9 · حدود #E6E8EB
 * يُشغَّل: node scripts/check-brand-colors.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

// ألوان الهوية المسموح بها نصياً (وأبيض/أسود الطباعة)
const ALLOWED_HEX = new Set(['#2f6bff', '#12151b', '#6b7280', '#16a34a', '#f6f7f9', '#e6e8eb', '#ffffff', '#fff', '#000000', '#000']);

// ملفات يسمح فيها بألوان خام لأنها بيانات يختارها التاجر لمتجره لا ألوان واجهة وصل
const DATA_FILES = new Set([
  'pages/OnlineStorePage.tsx',      // منتقي ألوان المتجر — الألوان هنا خيارات معروضة للتاجر
  'components/store/StoreTheme.tsx',// يطبّق لون التاجر المختار
  'components/common/ColorWheel.tsx',
  // القيم هنا محدِّدات CSS تطابق افتراضيات recharts، وليست ألواناً تُرسم
  'components/ui/chart.tsx',
]);
const ALLOW_INLINE = /brand-allow-color/;

const PALETTE = 'amber|orange|yellow|stone|rose|red|emerald|green|blue|indigo|violet|purple|sky|cyan|teal|slate|gray|zinc|neutral|pink|fuchsia|lime';
const CLASS_RE = new RegExp(`\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|divide|outline|decoration|placeholder|caret|accent)-(?:${PALETTE})-\\d{2,3}\\b`, 'g');
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const HSL_RE = /hsl\(\s*\d/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(full)) out.push(full);
  }
  return out;
}

const findings = [];
for (const file of walk(SRC)) {
  const rel = relative(SRC, file);
  if (DATA_FILES.has(rel)) continue;
  const isTokenFile = rel === 'index.css';
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (ALLOW_INLINE.test(line)) return;
    const hits = [
      ...(line.match(CLASS_RE) || []),
      ...(isTokenFile ? [] : (line.match(HEX_RE) || []).filter((h) => !ALLOWED_HEX.has(h.toLowerCase()))),
      ...(isTokenFile ? [] : (line.match(HSL_RE) || [])),
    ];
    if (hits.length) findings.push(`${rel}:${i + 1}  ${[...new Set(hits)].join(', ')}`);
  });
}

if (findings.length) {
  console.error(`\n✕ ${findings.length} موضع خارج لوحة هوية وصل:\n`);
  findings.forEach((f) => console.error('  ' + f));
  console.error('\nاستخدم توكنات الهوية (primary / success / destructive / warning / muted / border) بدل الألوان الخام.\n');
  process.exit(1);
}
console.log('✓ كل الألوان داخل لوحة هوية وصل الرسمية');
