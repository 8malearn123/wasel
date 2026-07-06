# منصة وصل — Wasel Platform

نظام متكامل لإدارة محلات الجوالات: نقطة بيع، مخزون، صيانة، فروع، متجر إلكتروني، وتقارير.

## التقنيات

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (قاعدة بيانات، مصادقة، Edge Functions)

## التشغيل محلياً

```sh
npm install
npm run dev   # http://localhost:8080
```

## الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | خادم التطوير |
| `npm run build` | بناء نسخة الإنتاج في `dist/` |
| `npm test` | تشغيل الاختبارات |
| `npm run lint` | فحص الكود |

## النشر على Vercel

المشروع جاهز للنشر مباشرة — ملف `vercel.json` يعيد توجيه كل المسارات إلى
`index.html` حتى يعمل توجيه React Router عند فتح الروابط الداخلية مباشرة.

## بنية المشروع

- `src/pages/` — صفحات التطبيق (لوحة التحكم، نقطة البيع، المخزون، ...)
- `src/pages/admin/` — لوحة إدارة المنصة (`/admin`)
- `src/pages/store/` — المتجر الإلكتروني العام (`/store/:slug`)
- `src/components/` — المكونات المشتركة
- `supabase/migrations/` — مخطط قاعدة البيانات
- `supabase/functions/` — دوال الخادم (Edge Functions)
