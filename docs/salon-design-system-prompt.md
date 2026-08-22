# بروميت: نقل معمارية "استوديو تصميم الواجهة" إلى نظام صوالين التجميل

> **طريقة الاستخدام:** الصق هذا الملف كاملاً كبروميت واحد للوكيل الذي يعمل على نظام الصالونات.
> هو مواصفة تنفيذية مأخوذة من نظام حقيقي شغّال (منصة وصل)، معادة الصياغة لمجال الصالونات.
> نفّذ المراحل بالترتيب — كل مرحلة لها معايير قبول في آخرها، لا تنتقل للتالية قبل استيفائها.

---

## ٠) السياق والهدف

النظام الهدف: **نظام إدارة صوالين تجميل** (حجوزات، خدمات، موظفات، عملاء، فواتير).

المطلوب: بناء **استوديو تصميم واجهة عامة** لكل صالون، بحيث يصمّم صاحب الصالون واجهته
بنفسه من داخل لوحة التحكم ويشوف النتيجة لحظياً، والناتج صفحتان عامتان:

1. **صفحة لاندنج (Landing)** — واجهة تسويقية بأقسام قابلة للترتيب والإخفاء.
2. **صفحة حجز (Booking)** — تدفق حجز موعد تجميل متعدد الخطوات.

**ممنوع** أن يبقى في النظام أي أثر لمفهوم "المتجر الإلكتروني" (سلة، منتجات، شحن، دفع طلبات،
تتبع شحنة). المرحلة الأولى هي حذف كل ذلك بالكامل.

المبدأ المعماري الحاكم — **احفظه**:

> واجهة الصالون العامة **ليست صفحة ثابتة**، بل **مصفوفة أقسام (sections) مرتّبة**،
> تُرسم من JSON محفوظ للصالون، وتُلوَّن عبر **متغيرات CSS** تُحقن في وقت التشغيل.
> والمعاينة في المحرر **ليست محاكاة** — بل الصفحة العامة الحقيقية داخل iframe،
> تستقبل التعديلات غير المحفوظة عبر `postMessage`.

---

## المرحلة ١ — التنظيف: حذف كل ما يخص المتجر الإلكتروني

### ١.١ الجرد قبل الحذف
نفّذ بحثاً شاملاً واكتب تقريراً بكل ما يطابق (بلا حذف بعد):

```
store, storefront, cart, checkout, product, catalog, sku, inventory_item,
shipping, carrier, tracking, order_items, coupon, payment_gateway, wishlist,
"المتجر", "السلة", "الشحن", "الطلب", "المنتج", "الدفع"
```

### ١.٢ الحذف الفعلي (بهذا الترتيب)

| الطبقة | ماذا يُحذف |
|---|---|
| المسارات | `/store/*`, `/online-store`, `/online-orders`, `/cart`, `/checkout`, `/track` وكل ما يتفرع منها |
| الصفحات | كل ملف تحت `pages/store/` أو `pages/shop/` وأي `*StorePage`, `*CartPage`, `*CheckoutPage`, `*ProductPage` |
| المكوّنات | `CartProvider`, `CartPanel`, `ProductCard`, `ProductGrid`, `StoreLayout` القديم, أي `Shipping*` |
| الخطافات (hooks) | `useCart`, `useOrders`, `useProducts`, `useShipping`, `useStoreSettings` القديم |
| المكتبات | `lib/shipping.ts`, `lib/ordersHistory.ts`, أي حاسبة ضريبة/شحن للطلبات |
| القائمة الجانبية | كل عنصر قسم "المتجر الإلكتروني" وأبناؤه |
| قاعدة البيانات | جداول `orders`, `order_items`, `products`, `cart*`, `shipping*`, `coupons` — **بترحيل (migration) صريح**، لا حذف يدوي |
| التخزين | حاوية (bucket) `store-assets` القديمة إن وُجدت |
| الترجمات | كل مفتاح i18n يخص المتجر |
| الاعتماديات | أي حزمة صارت غير مستعملة بعد الحذف |

### ١.٣ قواعد صارمة أثناء الحذف
- **لا تترك كوداً ميتاً معلّقاً بالتعليقات.** احذف كلياً.
- **لا تحذف** جداول العملاء أو الفواتير أو المخزون الداخلي للصالون إن كانت مستخدمة في POS الداخلي — احذف فقط ما يخص البيع الإلكتروني للجمهور.
- كل حذف قاعدة بيانات يكون في ملف migration جديد باسم واضح: `<timestamp>_drop_ecommerce_store.sql`.
- بعد الحذف: `npm run lint && npm run build && npm test` — يجب أن تمر كلها خضراء.

**معيار القبول ١:** البحث عن الكلمات المفتاحية أعلاه لا يُرجع أي نتيجة في `src/`
عدا ما يخص المخزون الداخلي المشروع، والبناء ناجح.

---

## المرحلة ٢ — قاعدة البيانات: مصدرا الحقيقة

التصميم يُخزَّن في **مكانين متكاملين عمداً**، وهذا اختيار معماري مقصود:

### ٢.١ جدول `salon_site_settings` — الحقول المستقرة
كل ما هو ثابت ومستقر ويُستعلم عنه أو يُفهرس، يأخذ **عموداً حقيقياً**:

```sql
CREATE TABLE public.salon_site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES public.salons(id) ON DELETE CASCADE NOT NULL UNIQUE,
  slug TEXT UNIQUE NOT NULL,

  -- الهوية
  salon_name TEXT,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,

  -- التصميم
  primary_color TEXT DEFAULT '#b08a57',
  secondary_color TEXT DEFAULT '#17120f',
  font_family TEXT DEFAULT 'cairo',
  theme_id TEXT DEFAULT 'modern',

  -- اللاندنج
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_image_url TEXT,
  announcement_bar_text TEXT,
  announcement_bar_enabled BOOLEAN DEFAULT false,

  -- الحجز
  booking_enabled BOOLEAN DEFAULT true,
  booking_lead_minutes INT DEFAULT 60,        -- أقل مهلة قبل الموعد
  booking_max_days_ahead INT DEFAULT 30,
  booking_slot_minutes INT DEFAULT 30,        -- طول الفترة الزمنية
  require_deposit BOOLEAN DEFAULT false,
  deposit_amount NUMERIC DEFAULT 0,
  cancellation_policy TEXT,

  -- الاتصال والموقع
  whatsapp_number TEXT,
  phone_number TEXT,
  address TEXT,
  city TEXT,
  maps_url TEXT,
  instagram_url TEXT,
  snapchat_url TEXT,
  tiktok_url TEXT,

  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  og_image_url TEXT,

  -- النشر
  is_published BOOLEAN DEFAULT false,
  currency_symbol TEXT DEFAULT 'ر.س',
  show_cr_number BOOLEAN DEFAULT true,
  show_vat_number BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.salon_site_settings ENABLE ROW LEVEL SECURITY;

-- الصالون يدير إعداداته فقط
CREATE POLICY "Salons manage own site settings"
  ON public.salon_site_settings FOR ALL TO authenticated
  USING (salon_id = get_user_salon_id());

-- الزائر يقرأ المنشور فقط
CREATE POLICY "Public view published salon sites"
  ON public.salon_site_settings FOR SELECT TO anon
  USING (is_published = true);

CREATE POLICY "Authenticated view published salon sites"
  ON public.salon_site_settings FOR SELECT TO authenticated
  USING (is_published = true);
```

### ٢.٢ `DesignExtras` — JSON مرن في صف مخفي
كل ما هو **تجريبي أو سريع التغيّر أو مركّب** (أقسام، آراء، أسئلة، تأثيرات) **لا يأخذ عموداً**،
بل يُخزَّن JSON داخل جدول الصفحات بـ slug محجوز:

```sql
CREATE TABLE public.salon_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES public.salons(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  is_published BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (salon_id, slug)
);
```

الصف المحجوز: `slug = '__design'` ومحتواه `JSON.stringify(DesignExtras)`.

**لماذا هذا الازدواج؟** لأنه يسمح بإضافة عشرات خيارات التصميم دون أي migration جديد.
الحقل الذي يثبت ويُستعلم عنه يُرقّى لاحقاً إلى عمود. **طبّق نفس المبدأ حرفياً.**

**قاعدة إلزامية:** صف `__design` يجب أن **يُفلتر دائماً** من أي قائمة صفحات تُعرض
للزائر أو لصاحب الصالون — في الخطاف نفسه، لا في المكوّن.

### ٢.٣ جداول الحجوزات

```sql
CREATE TABLE public.salon_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES public.salons(id) ON DELETE CASCADE NOT NULL,
  booking_number TEXT UNIQUE NOT NULL,        -- مثل BK-250822-0031
  status TEXT NOT NULL DEFAULT 'pending',      -- pending|confirmed|completed|cancelled|no_show
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  staff_id UUID REFERENCES public.salon_staff(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  deposit_status TEXT DEFAULT 'none',           -- none|pending|paid
  notes TEXT,
  source TEXT DEFAULT 'landing',                -- landing|walk_in|phone
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.salon_booking_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.salon_bookings(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.salon_services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,       -- لقطة الاسم وقت الحجز
  duration_minutes INT NOT NULL,
  price NUMERIC NOT NULL
);

-- منع التعارض على نفس الموظفة
CREATE INDEX idx_bookings_staff_time ON public.salon_bookings (staff_id, starts_at, ends_at)
  WHERE status IN ('pending','confirmed');
```

### ٢.٤ عرض عام آمن للخدمات
**لا تكشف** جدول الخدمات الداخلي مباشرة للزائر. أنشئ view يعرض الحقول العامة فقط:

```sql
CREATE VIEW public.public_salon_services AS
SELECT id, salon_id, name, description, price, duration_minutes,
       image_url, category, sort_order
FROM public.salon_services
WHERE is_active = true AND show_on_landing = true;
```
ونفس الشيء لفريق العمل: `public_salon_staff` (اسم، صورة، تخصص، سنوات خبرة) فقط.

**معيار القبول ٢:** الزائر المجهول (anon) يستطيع قراءة صالون منشور وخدماته العامة فقط،
ولا يستطيع قراءة صالون غير منشور ولا أي حقل داخلي (تكلفة، عمولة، هاتف الموظفة).

---

## المرحلة ٣ — طبقة الثيم: `SalonThemeProvider`

هذا **قلب النظام**. مكوّن واحد يغلّف كل الواجهة العامة ويحوّل إعدادات الصالون
إلى **متغيرات CSS**، فتتلوّن كل المكوّنات تلقائياً دون أن تعرف شيئاً عن الصالون.

```tsx
// src/components/salon/SalonTheme.tsx
import { ReactNode, useEffect } from 'react';
import type { SiteSettings, DesignExtras } from '@/hooks/useSalonSite';

const FONT_LINKS: Record<string, string> = {
  cairo:    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap',
  tajawal:  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap',
  almarai:  'https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=swap',
  elmessiri:'https://fonts.googleapis.com/css2?family=El+Messiri:wght@400;600;700&display=swap',
  amiri:    'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap',
  reemkufi: 'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;600;700&display=swap',
  changa:   'https://fonts.googleapis.com/css2?family=Changa:wght@400;600;700&display=swap',
  noto:     'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700;900&display=swap',
};

const FONT_FAMILY: Record<string, string> = {
  cairo: '"Cairo", system-ui, sans-serif',
  tajawal: '"Tajawal", system-ui, sans-serif',
  almarai: '"Almarai", system-ui, sans-serif',
  elmessiri: '"El Messiri", system-ui, sans-serif',
  amiri: '"Amiri", serif',
  reemkufi: '"Reem Kufi", system-ui, sans-serif',
  changa: '"Changa", system-ui, sans-serif',
  noto: '"Noto Kufi Arabic", system-ui, sans-serif',
};

/** HEX -> "H S% L%" لتتوافق مع صيغة hsl(var(--x)) في Tailwind */
function hexToHsl(hex: string): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return '35 30% 52%';
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function SalonThemeProvider({
  site, children, textColor, extras,
}: { site: SiteSettings; children: ReactNode; textColor?: string | null; extras?: DesignExtras | null }) {
  const fontKey = site.font_family || 'cairo';
  const primary = site.primary_color || '#b08a57';
  const secondary = site.secondary_color || '#17120f';

  // حقن خط جوجل مرة واحدة وتحديث href عند التغيير
  useEffect(() => {
    const id = 'salon-font-link';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = FONT_LINKS[fontKey] || FONT_LINKS.cairo;
  }, [fontKey]);

  // الواجهة العامة فاتحة دائماً حتى لو لوحة التحكم داكنة — مع إرجاع الحالة عند الخروج
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => { if (wasDark) root.classList.add('dark'); };
  }, []);

  const style: Record<string, string> = {
    '--salon-primary': hexToHsl(primary),
    '--salon-secondary': hexToHsl(secondary),
    '--salon-primary-hex': primary,
    '--salon-secondary-hex': secondary,
    fontFamily: FONT_FAMILY[fontKey] || FONT_FAMILY.cairo,
  };
  if (textColor && /^#[0-9a-fA-F]{6}$/.test(textColor)) {
    style['--foreground'] = hexToHsl(textColor);
    style.color = textColor;
  }
  if (typeof extras?.button_radius === 'number') style['--radius'] = `${extras.button_radius}px`;
  const btn = extras?.button_color && /^#[0-9a-fA-F]{6}$/.test(extras.button_color) ? extras.button_color : primary;
  style['--salon-btn'] = hexToHsl(btn);
  style['--salon-btn-hex'] = btn;

  return (
    <div style={style as React.CSSProperties} dir="rtl"
         className={`salon-root min-h-screen bg-background text-foreground ${themeClass(site.theme_id)}`}>
      {children}
    </div>
  );
}

export function themeClass(themeId?: string | null) {
  switch (themeId) {
    case 'minimal': return 'theme-minimal';
    case 'bold':    return 'theme-bold';
    case 'classic': return 'theme-classic';
    default:        return 'theme-modern';
  }
}
```

### قواعد إلزامية لهذه الطبقة
1. **ممنوع منعاً باتاً** كتابة لون ثابت داخل أي مكوّن من مكوّنات الواجهة العامة.
   كل لون يُكتب `hsl(var(--salon-primary))` أو `hsl(var(--salon-primary) / 0.35)`.
2. `themeClass` **يجب أن يُستعمل فعلياً** على جذر الصفحة، ويجب تعريف الأصناف الأربعة
   في ملف CSS العام:

```css
.salon-root.theme-modern  { --radius: 14px; --salon-shadow: 0 8px 24px hsl(var(--salon-primary) / .12); }
.salon-root.theme-minimal { --radius: 4px;  --salon-shadow: none; }
.salon-root.theme-bold    { --radius: 8px;  --salon-shadow: 0 12px 32px hsl(var(--salon-primary) / .28); }
.salon-root.theme-classic { --radius: 0px;  --salon-shadow: 0 2px 0 hsl(var(--salon-secondary) / .35); }
```
> **تحذير من خطأ وقع في النظام الأصلي:** هناك `getThemeClass()` مكتوبة لكن **غير مستوردة**
> في أي مكان، والأصناف غير معرّفة في CSS — فصار اختيار "القالب" بلا أي أثر بصري.
> **لا تكرر هذا الخطأ:** أي خيار تعرضه في المحرر يجب أن يكون له أثر مرئي مثبت باختبار.

**معيار القبول ٣:** تغيير `primary_color` في القاعدة يغيّر لون البنر والأزرار والشارات
والفواصل في الصفحة العامة دون لمس أي مكوّن. وتبديل `theme_id` يغيّر الاستدارة والظل فعلياً.

---

## المرحلة ٤ — هيكل الملفات

```
src/
├─ pages/
│  ├─ SalonSitePage.tsx            # لوحة التاجر: /salon-site  (المحرر)
│  └─ PublicSalonPage.tsx          # الغلاف العام: /s/:slug/*
│
├─ pages/salon/                    # صفحات الواجهة العامة
│  ├─ SalonLandingPage.tsx         # اللاندنج (نظام الأقسام)
│  ├─ SalonServicesPage.tsx        # كل الخدمات + فلترة
│  ├─ SalonServiceDetailPage.tsx   # تفاصيل خدمة
│  ├─ SalonBookingPage.tsx         # تدفق الحجز متعدد الخطوات
│  ├─ SalonBookingDonePage.tsx     # شكراً + رقم الحجز
│  ├─ SalonMyBookingsPage.tsx      # حجوزاتي (localStorage)
│  ├─ SalonTrackBookingPage.tsx    # تتبع حجز برقمه
│  └─ SalonCustomPage.tsx          # صفحة تعريفية حرة
│
├─ components/salon/
│  ├─ SalonTheme.tsx               # مزوّد الثيم (المرحلة ٣)
│  ├─ SalonLayout.tsx              # هيدر + فوتر + شريط إعلان
│  ├─ SalonSEO.tsx                 # مدير الـ head
│  ├─ ServiceCard.tsx
│  ├─ StaffCard.tsx
│  └─ BookingDraft.tsx             # Context مسودة الحجز (بديل السلة)
│
├─ hooks/
│  ├─ useSalonSite.ts              # الأنواع + خطافات التاجر + خطاف الزائر
│  └─ useSalonBookings.ts
│
└─ lib/
   └─ bookingsHistory.ts           # سجل حجوزات الزائر في localStorage
```

**قاعدة:** `PublicSalonPage.tsx` هو **نقطة التركيب الوحيدة** — يجلب البيانات مرة واحدة
ويمرّرها للأبناء بالـ props. لا يجلب أي مكوّن ابن بياناته بنفسه.

ترتيب التغليف إلزامي:
```
SalonThemeProvider → SalonSEO → BookingDraftProvider → SalonLayout → <Routes>
```

---

## المرحلة ٥ — نظام الأقسام (جوهر اللاندنج)

اللاندنج **ليست JSX ثابتاً**. هي:

```
sections: Record<string, ReactNode>   // تعريف كل قسم
        +
sectionOrder: string[]                // الترتيب القادم من DesignExtras
        =
الصفحة
```

### ٥.١ الأقسام الافتراضية للصالون

```ts
export const DEFAULT_LANDING_SECTIONS: Array<{ key: string; visible: boolean }> = [
  { key: 'hero',       visible: true },  // البنر الترحيبي + زر "احجزي الآن"
  { key: 'perks',      visible: true },  // مميزات الصالون (نظافة، خصوصية، مواعيد مرنة)
  { key: 'services',   visible: true },  // شبكة الخدمات مع السعر والمدة
  { key: 'offers',     visible: true },  // باقات وعروض
  { key: 'countdown',  visible: true },  // عد تنازلي لعرض ينتهي
  { key: 'staff',      visible: true },  // فريق العمل / الأخصائيات
  { key: 'gallery',    visible: true },  // معرض أعمال (قبل/بعد)
  { key: 'wide',       visible: true },  // بنرات عريضة / سلايدر
  { key: 'divider',    visible: true },  // فاصل ملوّن بجملة تسويقية
  { key: 'brands',     visible: true },  // ماركات المنتجات المستخدمة
  { key: 'video',      visible: true },  // فيديو تعريفي
  { key: 'reviews',    visible: true },  // آراء العميلات
  { key: 'hours',      visible: true },  // أوقات العمل
  { key: 'location',   visible: true },  // العنوان + خريطة
  { key: 'faq',        visible: true },  // أسئلة شائعة
  { key: 'text',       visible: true },  // نص حر
  { key: 'booking_cta',visible: true },  // دعوة حجز أخيرة
  { key: 'support',    visible: true },  // واتساب واتصال
];
```

### ٥.٢ منطق الدمج والرسم (انسخه كما هو — فيه ثلاث حيل مهمة)

```tsx
const saved = designExtras?.landing_sections;

// (١) الدمج مع الافتراضي: أي قسم جديد يضيفه المطور لاحقاً يظهر تلقائياً
//     للصالونات القديمة بدون أي ترحيل بيانات
const sectionOrder = (saved && saved.length > 0
  ? [...saved, ...DEFAULT_LANDING_SECTIONS.filter(d => !saved.some(s => s.key === d.key))]
  : DEFAULT_LANDING_SECTIONS
).filter(s => s.visible !== false).map(s => s.key);

const sections: Record<string, React.ReactNode> = {
  hero: (<section key="hero" /* ... */ />),
  services: (<section key="services" /* ... */ />),
  // ... بقية الأقسام
};

return (
  <div>
    {sectionOrder.map((key, i) => {
      const node = sections[key];
      if (!node) return null;
      // (٢) المفتاح مركّب من الاسم + الفهرس => يسمح بتكرار نفس القسم مرتين
      return <div key={`${key}-${i}`}>{node}</div>;
    })}
  </div>
);
```

الحيلة الثالثة: **الترقيم التسلسلي للأقسام الكبيرة** حسب ترتيبها الفعلي لا حسب تعريفها:
```tsx
const AR = '٠١٢٣٤٥٦٧٨٩';
const numbered = ['services', 'staff', 'gallery', 'reviews'];
const numMap: Record<string, string> = {};
let c = 0;
sectionOrder.forEach(k => { if (numbered.includes(k) && !numMap[k]) numMap[k] = '٠' + AR[++c]; });
```

### ٥.٣ نوع `DesignExtras` للصالون

```ts
export const DESIGN_EXTRAS_SLUG = '__design';

export interface DesignExtras {
  gallery: Array<{ image_url: string; caption?: string }>;

  // ترتيب وإظهار أقسام اللاندنج
  landing_sections?: Array<{ key: string; visible: boolean }>;

  // الهوية البصرية
  font_color?: string;
  button_radius?: number;
  button_color?: string;
  icon_shape?: 'circle' | 'square';
  hero_effect?: 'none' | 'glow' | 'dark' | 'dots';
  glitter?: boolean;                 // لمعة متلألئة على الأسطح الملونة
  hero_button_text?: string;

  // محتوى الأقسام
  perks?: Array<{ icon: string; title: string; desc?: string }>;
  offers?: Array<{ title: string; desc?: string; price?: string; image_url?: string }>;
  wide_banners?: Array<{ image_url?: string; title?: string; subtitle?: string }>;
  wide_slider?: boolean;
  feature_images?: Array<{ image_url: string; caption?: string }>;
  divider?: { enabled?: boolean; text?: string };
  countdown?: { enabled?: boolean; title?: string; ends_at?: string };
  testimonials?: Array<{ name: string; text: string; rating?: number }>;
  faq?: Array<{ q: string; a: string }>;
  video?: { enabled?: boolean; url?: string; title?: string };
  brands?: Array<{ name: string; image_url?: string }>;
  custom_heading?: string;
  custom_text?: string;

  // خاص بالصالون
  working_hours?: Array<{ day: string; open?: string; close?: string; closed?: boolean }>;
  ladies_only?: boolean;             // شارة "للسيدات فقط"
  home_service?: { enabled?: boolean; note?: string; extra_fee?: number };
  parking_note?: string;

  // الفوتر والتواصل
  footer?: { about?: string; note?: string; copyright?: string };
  socials?: { instagram?: string; snapchat?: string; tiktok?: string;
              youtube?: string; email?: string; phone?: string; maps?: string };
  customer_service?: { enabled?: boolean; whatsapp?: string; phone?: string; hours?: string; note?: string };

  hide_platform_badge?: boolean;
  custom_domain?: { domain?: string; status?: 'pending' | 'active'; added_at?: string };
}

export function parseDesignExtras(pages: SalonPage[]): DesignExtras | null {
  const p = pages.find(pg => pg.slug === DESIGN_EXTRAS_SLUG);
  if (!p?.content) return null;
  try { return { gallery: [], ...JSON.parse(p.content) }; } catch { return null; }
}
```

**معيار القبول ٥:** إخفاء قسم من المحرر يخفيه فوراً من اللاندنج، وسحبه لأعلى يغيّر ترتيبه،
وتكراره يعرضه مرتين بمحتوى مستقل، وإضافة قسم جديد في الكود يظهر للصالونات القديمة تلقائياً.

---

## المرحلة ٦ — المحرر ولوحة التحكم

صفحة واحدة `/salon-site` مقسّمة تبويبات مربوطة بـ `?tab=` في الرابط
(حتى تفتح القائمة الجانبية أي تبويب مباشرة، ويعمل زر الرجوع في المتصفح):

```
general | design | branding | hero | services | booking | hours | media | seo | pages | links
```

### ٦.١ تبويب `design` — ثلاثة مستويات حسب الباقة

| الباقة | ما تحصل عليه |
|---|---|
| **الأعلى (Max)** | استوديو كامل: قوالب جاهزة + ترتيب الأقسام بالسحب + ٢٠ شاشة تحرير فرعية + تراجع |
| **المتوسطة (Pro)** | محرر مبسّط: شعار، ألوان جاهزة، شكل الأيقونة، تأثير البنر، نصوص البنر |
| **الأدنى** | بطاقة دعوة للترقية فقط، **والقائمة الجانبية تخفي التبويب أصلاً** |

نفّذها بـ:
```tsx
const isMax = plan === 'Max' || plan === 'trial';
const isPro = plan === 'Pro';
// ...
{isMax ? <FullStudio/> : isPro ? <SimpleEditor/> : <UpgradeCard/>}
```
وفي القائمة الجانبية: احذف عنصر `design` من الأبناء عندما `planTier < 2`.

### ٦.٢ عناصر الاستوديو الكامل (كلها إلزامية)

1. **شريط علوي ثابت:** اسم الصالون + حالة المسودة + تبديل سطح مكتب/جوال + تراجع + استعادة الافتراضي + زر **نشر التغييرات**.
2. **قوالب جاهزة** — ضغطة واحدة تضبط اللون والخط والقالب والاستدارة معاً:

```ts
const SITE_TEMPLATES = [
  { id: 'gold',    name: 'فخم ذهبي',   desc: 'كلاسيكي راقٍ بلمسة ذهبية',
    settings: { theme_id: 'classic', font_family: 'amiri',     primary_color: '#b08a57', secondary_color: '#17120f' },
    extras:   { button_radius: 0,   glitter: true,  icon_shape: 'square' } },
  { id: 'rose',    name: 'وردي أنثوي', desc: 'ناعم ودافئ',
    settings: { theme_id: 'modern',  font_family: 'elmessiri', primary_color: '#db2777', secondary_color: '#f472b6' },
    extras:   { button_radius: 20,  glitter: true,  icon_shape: 'circle' } },
  { id: 'nude',    name: 'نيود هادئ',  desc: 'ألوان ترابية مريحة',
    settings: { theme_id: 'minimal', font_family: 'almarai',   primary_color: '#a1866f', secondary_color: '#e7d8c9' },
    extras:   { button_radius: 8,   glitter: false, icon_shape: 'circle' } },
  { id: 'noir',    name: 'أسود فاخر',  desc: 'تباين عالٍ وأناقة',
    settings: { theme_id: 'bold',    font_family: 'changa',    primary_color: '#111827', secondary_color: '#d4af37' },
    extras:   { button_radius: 6,   glitter: false, icon_shape: 'square' } },
  { id: 'spa',     name: 'سبا أخضر',   desc: 'استرخاء وطبيعة',
    settings: { theme_id: 'minimal', font_family: 'tajawal',   primary_color: '#0f766e', secondary_color: '#84cc16' },
    extras:   { button_radius: 12,  glitter: false, icon_shape: 'circle' } },
  { id: 'violet',  name: 'بنفسجي عصري',desc: 'جريء وحديث',
    settings: { theme_id: 'modern',  font_family: 'cairo',     primary_color: '#7c3aed', secondary_color: '#ec4899' },
    extras:   { button_radius: 16,  glitter: true,  icon_shape: 'circle' } },
];
```

3. **لوحة أقسام قابلة للسحب** مع لكل قسم: إظهار/إخفاء، تحريك لأعلى/أسفل، تكرار، حذف، ووصف عربي مبسّط.

```ts
const SECTION_META: Record<string, { name: string; desc: string }> = {
  hero:        { name: 'البنر الرئيسي', desc: 'الواجهة الترحيبية وزر الحجز' },
  services:    { name: 'خدماتنا',       desc: 'شبكة الخدمات مع السعر والمدة' },
  staff:       { name: 'فريق العمل',    desc: 'الأخصائيات وتخصصاتهن' },
  gallery:     { name: 'معرض الأعمال',  desc: 'صور قبل وبعد' },
  offers:      { name: 'الباقات والعروض', desc: 'عروض مجمّعة بسعر مميز' },
  hours:       { name: 'أوقات العمل',   desc: 'جدول الدوام الأسبوعي' },
  location:    { name: 'موقعنا',        desc: 'العنوان والخريطة' },
  reviews:     { name: 'آراء العميلات', desc: 'تقييمات وشهادات' },
  booking_cta: { name: 'دعوة الحجز',    desc: 'شريط ختامي يدفع للحجز' },
  // ... أكمل الباقي
};
```

4. **قائمة "أكمل موقعك"** — خطوات مع نسبة إنجاز، كل خطوة زر يفتح لوحتها:
   الشعار ← الاسم والوصف ← الألوان ← البنر ← الخدمات ← أوقات العمل ← فريق العمل ← آراء العميلات ← إعدادات الحجز ← النشر.
5. **شاشات تحرير فرعية**: بدل صفحة عملاقة، `designSection` هي حالة واحدة
   (`'services' | 'staff' | 'gallery' | 'faq' | ...`) وكل قيمة تفتح شاشتها مع زر "رجوع".

**معيار القبول ٦:** كل خيار في المحرر ينعكس في المعاينة خلال أقل من ثانية،
وقالب جاهز واحد يغيّر مظهر الموقع كلياً بضغطة، ولا يوجد خيار بلا أثر مرئي.

---

## المرحلة ٧ — المعاينة الحية (الجزء الأذكى — نفّذه بدقة)

**المبدأ:** المعاينة ليست محاكاة بمكوّنات مصغّرة، بل **الصفحة العامة الحقيقية**
داخل `<iframe>`، تُحقن فيها التعديلات غير المحفوظة عبر `postMessage`.

### ٧.١ في المحرر (المرسِل)

```tsx
const previewFrameRef = useRef<HTMLIFrameElement>(null);

const postPreview = () => {
  try {
    previewFrameRef.current?.contentWindow?.postMessage(
      { type: 'salon-preview', settings: form, extras },
      window.location.origin            // لا تستخدم '*' أبداً
    );
  } catch { /* الإطار لم يجهز بعد */ }
};

// تجميع الضغطات المتتالية بإرسال واحد كل ٢٥٠ مللي ثانية
useEffect(() => {
  if (!(isMax || isPro)) return;
  const t = setTimeout(postPreview, 250);
  return () => clearTimeout(t);
}, [form, extras]);

// إعادة الإرسال فور إعلان الإطار جاهزيته (يحل سباق التحميل)
useEffect(() => {
  const onMsg = (e: MessageEvent) => {
    if (e.origin === window.location.origin && e.data?.type === 'salon-preview-ready') postPreview();
  };
  window.addEventListener('message', onMsg);
  return () => window.removeEventListener('message', onMsg);
});

<iframe ref={previewFrameRef} src={`${siteUrl}?preview=1`} onLoad={postPreview}
        className="w-full h-[75vh] min-h-[560px] block" title="معاينة الموقع" />
```

### ٧.٢ في الصفحة العامة (المستقبِل)

```tsx
const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
const [draft, setDraft] = useState<{ settings?: Partial<SiteSettings>; extras?: DesignExtras } | null>(null);

useEffect(() => {
  if (!isPreview) return;                       // لا يعمل إلا في وضع المعاينة
  const onMsg = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;   // فحص المصدر إلزامي
    if (e.data?.type === 'salon-preview') {
      setDraft({ settings: e.data.settings || {}, extras: e.data.extras });
    }
  };
  window.addEventListener('message', onMsg);
  try { window.parent?.postMessage({ type: 'salon-preview-ready' }, window.location.origin); } catch { /* ignore */ }
  return () => window.removeEventListener('message', onMsg);
}, [isPreview]);

// دمج المسودة فوق بيانات القاعدة — بلا أي حفظ
const site = dbSite ? ({ ...dbSite, ...(draft?.settings || {}) } as SiteSettings) : dbSite;
const designExtras = draft?.extras ?? dbExtras;
```

### ٧.٣ قواعد أمنية إلزامية
- فحص `e.origin` في **الطرفين**، وتمرير `window.location.origin` كهدف — **لا `'*'`**.
- وضع المعاينة يعمل فقط مع `?preview=1` ولا يحفظ شيئاً في القاعدة.
- تبديل الجوال/سطح المكتب = تضييق عرض الإطار إلى `max-w-[390px]` فقط، بلا كود مكرر.
- إن كان الموقع غير منشور: اعرض رسالة "المعاينة تعمل بعد أول نشر" مع زر نشر مباشر.

**معيار القبول ٧:** الكتابة في حقل عنوان البنر تظهر في الإطار خلال ربع ثانية،
ورسالة من نافذة خارجية بمصدر مختلف تُتجاهل، ولا شيء يُحفظ حتى الضغط على "نشر".

---

## المرحلة ٨ — إدارة الحالة والحفظ والتراجع

### ٨.١ حالتان منفصلتان (لأن المخزنين مختلفان)

```tsx
const [form, setForm]   = useState<Record<string, any>>({});   // أعمدة salon_site_settings
const [extras, setExtras] = useState<DesignExtras>({ gallery: [] }); // JSON
const [extrasDirty, setExtrasDirty] = useState(false);
const dirty = Object.keys(form).length > 0;

// القراءة دائماً: المسودة أولاً ثم المحفوظ
const val = (k: string) => form[k] ?? (settings as any)[k] ?? '';
const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
```

### ٨.٢ النشر الموحّد

```tsx
const publishAll = async () => {
  setSaving(true);
  const pending = { ...form };
  if (!settings.is_published) (pending as any).is_published = true;
  if (Object.keys(pending).length > 0) { await updateSettings(pending); setForm({}); }
  if (extrasDirty) { await saveDesignExtras(extras); setExtrasDirty(false); }
  setSaving(false);
  toast.success('تم نشر تصميم موقعك بنجاح');
};
```

### ٨.٣ التراجع (Undo) — مكدّس لقطات بتجميع زمني

```tsx
const histRef  = useRef<Array<{ form: any; extras: DesignExtras }>>([]);
const histSkip = useRef(false);
const histTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const histPrev = useRef<{ form: any; extras: DesignExtras } | null>(null);

useEffect(() => {
  if (histSkip.current) { histSkip.current = false; histPrev.current = { form, extras }; return; }
  if (!histPrev.current) { histPrev.current = { form, extras }; return; }
  // التعديلات المتتالية خلال ٧٠٠ مللي ثانية = لقطة واحدة (سلوك محرر نصوص)
  if (!histTimer.current) {
    histRef.current.push(histPrev.current);
    if (histRef.current.length > 30) histRef.current.shift();
    histTimer.current = setTimeout(() => { histTimer.current = null; }, 700);
  }
  histPrev.current = { form, extras };
}, [form, extras]);

const undo = () => {
  const snap = histRef.current.pop();
  if (!snap) return toast.info('ما فيه تعديلات للتراجع عنها');
  histSkip.current = true;              // يمنع تسجيل التراجع نفسه كلقطة
  setForm(snap.form); setExtras(snap.extras); setExtrasDirty(true);
};
```

### ٨.٤ شريط "تغييرات غير محفوظة"
شريط لاصق (`sticky top-2`) يظهر عند `dirty` فيه عدد التغييرات + "تجاهل" + "حفظ".

**معيار القبول ٨:** ١٠ تعديلات ثم ١٠ ضغطات تراجع تُرجع الحالة الأولى بالضبط،
والكتابة السريعة في حقل نصي تُحسب لقطة واحدة لا حرفاً بحرف.

---

## المرحلة ٩ — الصور: قص وضغط قبل الرفع

**لا ترفع الصورة كما هي أبداً.** لكل نوع مقاس ونسبة، والمعالجة في المتصفح عبر canvas:

```ts
const IMAGE_SPECS: Record<string, { maxW: number; aspect?: number }> = {
  logo:     { maxW: 600 },                 // بلا قص — الشعار يبقى كاملاً
  hero:     { maxW: 1920, aspect: 16 / 7 },
  banner:   { maxW: 1600, aspect: 16 / 6 },
  og:       { maxW: 1200, aspect: 1200 / 630 },
  service:  { maxW: 800,  aspect: 4 / 3 },
  staff:    { maxW: 600,  aspect: 1 },     // بورتريه مربّع
  gallery:  { maxW: 1200, aspect: 4 / 3 }, // أعمال قبل/بعد
};
```

الخوارزمية: تحميل الصورة → قص من **المنتصف** (cover) للنسبة المطلوبة → تصغير لـ `maxW`
→ `canvas.toBlob(…, 'image/jpeg', 0.86)` (أو PNG للشعار الشفاف) → رفع لحاوية `salon-assets`
باسم `${salonId}/${kind}-${Date.now()}.${ext}` → إرجاع الرابط العام.
استثنِ `image/svg+xml` و `image/gif` من المعالجة. وأي فشل → ارفع الملف الأصلي بدل الانهيار.

**معيار القبول ٩:** رفع صورة 6 ميجابكسل ينتج ملفاً أقل من ٣٠٠ كيلوبايت بالنسبة الصحيحة،
ولا تظهر أي صورة مشوّهة في أي قسم.

---

## المرحلة ١٠ — صفحة الحجوزات (بديل السلة والدفع)

### ١٠.١ مسودة الحجز = Context + localStorage
نفس نمط السلة القديم لكن بمعنى مختلف: العميلة تختار خدمات متعددة قبل تثبيت الموعد.

```tsx
export interface DraftService { id: string; name: string; price: number; duration_minutes: number; }

export function BookingDraftProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const storageKey = `salon-booking-draft:${slug}`;
  const [services, setServices] = useState<DraftService[]>(() => {
    try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(services)); } catch { /* ignore */ }
  }, [services, storageKey]);

  const totalDuration = services.reduce((s, x) => s + x.duration_minutes, 0);
  const totalPrice    = services.reduce((s, x) => s + x.price, 0);
  // add / remove / clear ...
}
```
> ملاحظة: الخدمة **لا تتكرر بكمية**. إضافة خدمة موجودة = رسالة "الخدمة مضافة مسبقاً"،
> تماماً كما كان الجهاز الفريد في النظام الأصلي لا يقبل كمية.

### ١٠.٢ تدفق الحجز — أربع خطوات في صفحة واحدة

```
١) اختيار الخدمات   → تُحدّد المدة الإجمالية والسعر
٢) اختيار الأخصائية  → "أي متاحة" أو موظفة بعينها
٣) اختيار التاريخ والوقت → شبكة فترات متاحة
٤) بيانات العميلة والتأكيد → الاسم، الجوال، ملاحظات، سياسة الإلغاء
```
شريط تقدّم علوي، وزر "التالي" معطّل حتى تكتمل الخطوة، وملخص لاصق جانبي
(الخدمات + المدة + الإجمالي + العربون إن وُجد).

### ١٠.٣ توليد الفترات المتاحة — منطق الخادم
**لا تحسب التوفر في المتصفح.** أنشئ دالة قاعدة بيانات (RPC):

```sql
CREATE FUNCTION public.get_available_slots(
  _slug TEXT, _date DATE, _duration_minutes INT, _staff_id UUID DEFAULT NULL
) RETURNS TABLE (slot_start TIMESTAMPTZ, staff_id UUID)
```
تُطبّق بالترتيب:
1. أوقات العمل لليوم من `working_hours` (مع الأيام المغلقة).
2. طرح الحجوزات القائمة (`pending` أو `confirmed`) للموظفة.
3. طرح إجازات/استراحات الموظفة.
4. احترام `booking_lead_minutes` (لا فترات قبل المهلة) و `booking_max_days_ahead`.
5. التقسيم بخطوة `booking_slot_minutes`، وقبول الفترة فقط إذا اتسعت لكامل `_duration_minutes`.

### ١٠.٤ إنشاء الحجز — دالة واحدة ذرّية
`create_public_booking(...)` تعمل داخل معاملة (transaction):
تعيد التحقق من التوفر **مرة أخرى داخل القفل** → تولّد `booking_number` → تُدرج الحجز والبنود →
تعيد رقم الحجز. عند التعارض تُرجع خطأ واضحاً: "الموعد حُجز للتو، اختاري وقتاً آخر".

**السبب:** التحقق في الواجهة وحده يسمح بحجزين متزامنين لنفس الفترة.

### ١٠.٥ سجل حجوزات الزائرة (بلا حساب)

```ts
const key = (slug: string) => `salon_bookings_${slug}`;
export function saveBooking(slug: string, b: SavedBooking) { /* dedupe by booking_number, أحدث ٥٠ */ }
export function getBookings(slug: string): SavedBooking[] { /* ... */ }
export function removeBooking(slug: string, n: string) { /* ... */ }
```
يغذّي صفحة "حجوزاتي" وصفحة "تتبع الحجز" دون تسجيل دخول.

### ١٠.٦ بعد الحجز
- صفحة شكر برقم الحجز + التاريخ والوقت + الخدمات + زر "أضيفيه لتقويمي" (ملف `.ics`) + زر واتساب.
- إشعار لصاحبة الصالون داخل النظام.
- الحجز يظهر فوراً في تقويم الحجوزات الداخلي بمصدر `landing`.

**معيار القبول ١٠:** حجزان متزامنان لنفس الفترة → واحد ينجح والآخر يتلقى رسالة تعارض واضحة.
والفترات المعروضة تحترم أوقات العمل والإجازات والمهلة الدنيا.

---

## المرحلة ١١ — SEO والتوجيه والأمان

### ١١.١ التوجيه
```
/s/:slug            → اللاندنج
/s/:slug/services   → الخدمات
/s/:slug/service/:id→ تفاصيل خدمة
/s/:slug/book       → الحجز
/s/:slug/done/:no   → شكراً
/s/:slug/track      → تتبع حجز
/s/:slug/my-bookings→ حجوزاتي
/s/:slug/page/:p    → صفحة تعريفية
/s/:slug/*          → إعادة توجيه للاندنج
```
مسارات متداخلة داخل `PublicSalonPage`، وملف إعادة كتابة للنشر (مثل `vercel.json`)
يوجّه كل المسارات إلى `index.html`.

### ١١.٢ مدير الـ head
مكوّن `SalonSEO` خفيف يضبط: `title`, `description`, `keywords`, `canonical`,
OpenGraph, Twitter Card, و JSON-LD. علّم كل وسم تنشئه بسمة `data-salon-seo`
لتنظّفها عند التفكيك بلا مساس بوسوم أخرى.

JSON-LD المناسب للصالون:
```jsonc
{ "@context": "https://schema.org", "@type": "BeautySalon",
  "name": "...", "image": "...", "telephone": "...", "priceRange": "...",
  "address": { "@type": "PostalAddress", "streetAddress": "...", "addressLocality": "..." },
  "openingHoursSpecification": [ /* من working_hours */ ],
  "aggregateRating": { /* من التقييمات الحقيقية فقط — لا تختلق تقييمات */ } }
```

### ١١.٣ الأمان
- كل قراءة عامة عبر RLS بشرط `is_published = true`.
- الخدمات وفريق العمل عبر views عامة، لا جداول داخلية.
- بيانات السجل التجاري/الضريبة عبر RPC مقيّدة بـ slug.
- **لا تكشف أبداً**: أسعار التكلفة، عمولات الموظفات، أرقام هواتفهن، ملاحظات العميلات الداخلية.

**معيار القبول ١١:** فتح رابط داخلي مباشرة يعمل، ومعاينة الرابط في واتساب تعرض الصورة والعنوان،
واستدعاء الجداول الداخلية من جلسة anon يُرفض.

---

## المرحلة ١٢ — قائمة القبول النهائية

اعتبر العمل منجزاً فقط عند تحقق كل بند:

**التنظيف**
- [ ] صفر نتائج لبحث كلمات المتجر الإلكتروني في `src/`
- [ ] migration صريح يحذف جداول المتجر
- [ ] `lint` + `build` + `test` خضراء

**التصميم**
- [ ] صفر ألوان ثابتة في مكوّنات الواجهة العامة — كلها `hsl(var(--salon-*))`
- [ ] الأصناف الأربعة للقوالب معرّفة في CSS **ومستعملة فعلياً** على الجذر
- [ ] كل خيار في المحرر له أثر مرئي مثبت (لا خيار وهمي)
- [ ] الخطوط تُحمّل ديناميكياً وتظهر عيّناتها بشكلها الحقيقي في المحرر

**الأقسام**
- [ ] الترتيب والإخفاء والتكرار والحذف تعمل كلها
- [ ] قسم جديد في الكود يظهر للصالونات القديمة بلا ترحيل
- [ ] صف `__design` لا يظهر أبداً كصفحة للزائر

**المعاينة**
- [ ] إطار حقيقي لا محاكاة
- [ ] فحص `origin` في الطرفين، وبلا `'*'`
- [ ] استجابة ≤ ٢٥٠ مللي ثانية، ولا حفظ قبل "نشر"

**الحجز**
- [ ] الفترات المتاحة محسوبة في الخادم
- [ ] إنشاء الحجز ذرّي ويمنع التعارض
- [ ] "حجوزاتي" و"تتبع الحجز" يعملان بلا تسجيل دخول
- [ ] الحجز يصل تقويم الصالون الداخلي فوراً

**الجودة**
- [ ] كل الواجهة العامة RTL وعربية
- [ ] تعمل على الجوال بعرض 360px بلا تمرير أفقي
- [ ] الصور مقصوصة ومضغوطة قبل الرفع
- [ ] لا كود ميت ولا تعليقات لكود محذوف

---

## ملحق: أخطاء ارتُكبت في النظام الأصلي — تجنّبها

1. **خيار بلا أثر:** `theme_id` كان يُحفظ ويُعرض بأربعة قوالب، لكن دالة تطبيقه غير مستوردة
   وأصناف CSS غير معرّفة → المستخدم يختار ولا يتغير شيء. **اربط كل خيار بأثر مثبت.**
2. **ملف عملاق:** صفحة المحرر بلغت ~٣٠٠٠ سطر في ملف واحد.
   **قسّمها من البداية**: مكوّن لكل شاشة تحرير فرعية تحت `components/salon/editor/`.
3. **ازدواج المخزن بلا توثيق:** وجود إعدادات في أعمدة وأخرى في JSON مربك.
   **وثّق القاعدة صراحة**: مستقر ومُستعلَم عنه ← عمود، مرن وتجريبي ← JSON، والترقية لاحقاً بترحيل.
4. **منطق التوفر في الواجهة:** لا تكرره — التحقق النهائي في الخادم دائماً.
