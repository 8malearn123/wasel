## خطة العمل: نظام متاجر العملاء بالكامل

سنبني تجربة متجر إلكتروني احترافية للتاجر (محرر قوالب) وتجربة تسوق كاملة للزائر، على 4 مراحل.

---

### المرحلة 1: قاعدة البيانات والقوالب

**حقول جديدة في `store_settings`:**
- `theme_id` (text) — اختيار قالب جاهز: `modern` / `minimal` / `bold` / `classic`
- `font_family` (text) — `cairo` / `tajawal` / `ibm_plex` / `noto`
- `hero_title`, `hero_subtitle`, `hero_image_url`
- `featured_section_enabled`, `featured_product_ids` (jsonb)
- `seo_title`, `seo_description`, `seo_keywords`, `og_image_url`
- `currency_symbol` (default `ر.س`)
- `announcement_bar_text`, `announcement_bar_enabled`

**جدول جديد `store_pages`** (صفحات مخصصة): about, terms, return_policy, shipping_policy, faq.
- merchant_id, slug, title, content (rich text), is_published

**Storage bucket** `store-assets` لرفع الشعارات والبانرات وصور المنتجات.

---

### المرحلة 2: محرر القوالب للتاجر (`/online-store`)

**تابات جديدة + إعادة هيكلة:**
1. **القالب** — اختيار من 4 ثيمات بمعاينة بصرية (بطاقات مع صور)
2. **الهوية** — رفع شعار، بانر، اختيار ألوان رئيسي/ثانوي مع color picker، خط
3. **الصفحة الرئيسية** — تحرير hero (عنوان/وصف/صورة)، شريط إعلان علوي، تفعيل قسم منتجات مميزة + اختيار المنتجات
4. **التصنيفات** (موجود) — تحسين شكل البطاقات
5. **الصفحات** — جديد: about/terms/return/faq مع محرر نصي بسيط
6. **الشحن** (موجود)
7. **SEO** — جديد: title/description/keywords/OG image + معاينة Google snippet
8. **روابط ومشاركة** (موجود) — مع QR code للمتجر

**معاينة مباشرة (Live Preview):** نافذة جانبية تعرض المتجر بالتعديلات الحالية.

---

### المرحلة 3: واجهة المتجر العام (`/store/:slug`)

**صفحات جديدة:**
- `/store/:slug` — الصفحة الرئيسية بالقالب المختار: announcement bar → header → hero → featured → categories → products grid → footer
- `/store/:slug/product/:id` — تفاصيل منتج: معرض صور، مواصفات (RAM/Storage/Color)، السعر، حالة، أجهزة مشابهة، زر إضافة للسلة، مشاركة
- `/store/:slug/category/:catId` — منتجات تصنيف معين مع فلترة
- `/store/:slug/cart` — السلة كصفحة منفصلة (بدلاً من drawer فقط)
- `/store/:slug/checkout` — متعدد الخطوات: 1) معلومات العميل، 2) الشحن، 3) الدفع، 4) المراجعة
- `/store/:slug/thank-you/:orderNumber` — صفحة شكر بعد الطلب
- `/store/:slug/track/:orderNumber` — تتبع حالة الطلب (بدون تسجيل دخول، بـ phone للتحقق)
- `/store/:slug/page/:pageSlug` — عرض الصفحات المخصصة (about/terms/...)

**ميزات المتجر:**
- بحث بالاسم/المودل في header
- فلترة جانبية: السعر، الماركة، الحالة، التصنيف، الذاكرة
- ترتيب: الأحدث، الأقل سعراً، الأعلى سعراً
- بطاقات منتج بجودة عالية مع shimmer loading
- سلة عائمة مستمرة (localStorage) مع badge
- RTL كامل، responsive (موبايل أولاً للزوار)
- Meta tags ديناميكية لكل صفحة (SEO)
- OG image عند المشاركة

---

### المرحلة 4: التحسينات النهائية

- تحديث `useOnlineStore` hook ليجلب الحقول الجديدة
- نظام theme renderer يطبق ألوان/خط القالب على CSS variables
- إضافة sitemap.xml و robots.txt للمتجر
- breadcrumbs في كل الصفحات الداخلية
- skeleton loaders احترافية
- optimistic updates للسلة
- WhatsApp share button لكل منتج

---

### ملاحظات تقنية

- لن نلمس صفحات لوحة التاجر الأخرى (POS, Inventory, ...).
- لن نلمس RLS الموجودة لـ `store_settings` و `online_orders` — فقط نضيف policies للجداول الجديدة.
- جميع الـ public routes تستخدم `anon` role مع التحقق من `is_published = true`.
- للـ tracking page: تحقق ثنائي (order_number + آخر 4 أرقام من الجوال).
- نلتزم بالقاعدة: 15% VAT inclusive، عملة `ر.س` افتراضية.
- الثيم Deep Teal/Amber كلغة بصرية لمحرر التاجر، لكن المتجر العام يأخذ ألوان التاجر نفسه.

---

### ترتيب التنفيذ المقترح

سأبدأ بالمرحلة 1 (migration للجداول والحقول) أولاً، وبعد موافقتك أكمل المراحل 2 → 3 → 4 على دفعات قابلة للمراجعة.

هل تعتمد الخطة لأبدأ بالمايجريشن؟