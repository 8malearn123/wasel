import { ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard, type StoreProduct } from '@/components/store/ProductCard';
import { DEFAULT_HOME_SECTIONS, type StoreSettings, type StoreCategory, type DesignExtras } from '@/hooks/useOnlineStore';

interface Props {
  store: StoreSettings;
  devices: any[];
  accessories: any[];
  categories: StoreCategory[];
  designExtras?: DesignExtras | null;
}

// عداد تنازلي حي للعروض
function OfferCountdown({ endsAt, title, glitter }: { endsAt: string; title?: string; glitter?: boolean }) {
  const calc = () => Math.max(0, new Date(endsAt).getTime() - Date.now());
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);
  if (left <= 0) return null;
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const units = [
    { v: d, l: 'يوم' },
    { v: h, l: 'ساعة' },
    { v: m, l: 'دقيقة' },
    { v: s, l: 'ثانية' },
  ];
  return (
    <section className="relative w-full overflow-hidden my-6"
      style={{ background: `linear-gradient(90deg, hsl(var(--store-secondary)), hsl(var(--store-primary)))` }}>
      {glitter && <div className="glitter-overlay" />}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-10 text-center text-white">
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-85 mb-2" dir="ltr">Limited Offer</p>
        <h3 className="text-2xl md:text-3xl font-extrabold mb-6 drop-shadow">{title || 'العرض ينتهي خلال'}</h3>
        <div className="flex items-center justify-center gap-3" dir="rtl">
          {units.map(u => (
            <div key={u.l} className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 min-w-[72px]">
              <p className="text-3xl md:text-4xl font-black tabular-nums" dir="ltr">{String(u.v).padStart(2, '0')}</p>
              <p className="text-[11px] font-semibold opacity-85 mt-1">{u.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// سلايدر البنرات العريضة — يتنقل تلقائياً كل ٥ ثواني
function WideSlider({ banners, glitter }: { banners: Array<{ image_url?: string; title?: string; subtitle?: string }>; glitter?: boolean }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);
  const b = banners[idx] || banners[0];
  return (
    <section className="relative w-full h-64 md:h-96 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: b.image_url
              ? `linear-gradient(135deg, hsl(var(--store-primary) / 0.35), hsl(var(--store-secondary) / 0.35)), url(${b.image_url}) center/cover`
              : `linear-gradient(135deg, hsl(var(--store-primary)), hsl(var(--store-secondary)))`,
          }}
        >
          {(b.title || b.subtitle) && (
            <div className="text-center text-white px-4">
              {b.title && <h2 className="text-2xl md:text-5xl font-extrabold mb-3 drop-shadow-lg">{b.title}</h2>}
              {b.subtitle && <p className="text-base md:text-xl opacity-95 drop-shadow max-w-2xl mx-auto">{b.subtitle}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {glitter && <div className="glitter-overlay" />}
      {/* نقاط التنقل */}
      <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2 z-10">
        {banners.map((_, i) => (
          <button key={i} type="button" onClick={() => setIdx(i)}
            className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />
        ))}
      </div>
    </section>
  );
}

// استخراج معرف فيديو يوتيوب من أي صيغة رابط
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// ترويسة قسم بأسلوب احترافي: رقم + عنوان إنجليزي صغير + عنوان عربي
function SectionHead({ num, en, ar, action }: { num?: string; en: string; ar: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-8 flex-wrap">
      <div className="flex items-center gap-4">
        {num && <span className="text-4xl font-light text-muted-foreground/30 leading-none" dir="ltr">{num}</span>}
        <div>
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: 'hsl(var(--store-primary))' }} dir="ltr">{en}</p>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-1">{ar}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}

export function StoreHomePage({ store, devices, accessories, categories, designExtras }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const currency = store.currency_symbol || 'ر.س';
  const allProducts: StoreProduct[] = [
    ...devices.map((d) => ({ id: d.id, type: 'device' as const, name: `${d.brand || ''} ${d.model}`.trim(), brand: d.brand, price: Number(d.price), storage: d.storage, color: d.color, condition: d.condition, category: d.category, createdAt: d.created_at })),
    ...accessories.map((a) => ({ id: a.id, type: 'accessory' as const, name: a.name, brand: a.brand, price: Number(a.price), category: a.category, createdAt: a.created_at })),
  ];

  const featured = store.featured_section_enabled && store.featured_product_ids && store.featured_product_ids.length > 0
    ? allProducts.filter((p) => store.featured_product_ids!.includes(p.id))
    : allProducts.slice(0, 8);

  // ترتيب وإظهار الأقسام حسب محرر المتجر مع الافتراضي كنسخة احتياطية
  const savedSections = designExtras?.home_sections;
  const sectionOrder = (savedSections && savedSections.length > 0
    ? [
        ...savedSections,
        ...DEFAULT_HOME_SECTIONS.filter(d => !savedSections.some(s => s.key === d.key)),
      ]
    : DEFAULT_HOME_SECTIONS
  ).filter(s => s.visible !== false).map(s => s.key);

  // ترقيم الأقسام الكبيرة بالتسلسل (٠١، ٠٢...) حسب ترتيبها الفعلي
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const numberedKeys = ['categories', 'products', 'reviews', 'gallery'];
  const numMap: Record<string, string> = {};
  let counter = 0;
  sectionOrder.forEach(k => {
    if (numberedKeys.includes(k)) {
      counter += 1;
      numMap[k] = '٠' + AR_DIGITS[counter];
    }
  });

  const glitter = !!designExtras?.glitter;
  // شريط المميزات يظهر فقط إذا ضافها التاجر بنفسه من محرر ماكس —
  // باقة برو ما عندها هذا القسم فما يظهر في متاجرها
  const perksList = (designExtras?.store_perks || []).filter(p => p.title);

  const sections: Record<string, React.ReactNode> = {
    hero: (
      <section
        key="hero"
        className="relative overflow-hidden"
        style={{
          background: store.hero_image_url
            ? `linear-gradient(135deg, hsl(var(--store-primary) / ${designExtras?.hero_effect === 'glow' ? 0.55 : 0.85}), hsl(var(--store-secondary) / ${designExtras?.hero_effect === 'glow' ? 0.55 : 0.85})), url(${store.hero_image_url}) center/cover`
            : `linear-gradient(135deg, hsl(var(--store-primary)), hsl(var(--store-secondary)))`,
        }}
      >
        {designExtras?.hero_effect === 'dots' && (
          <div className="absolute inset-0 opacity-40 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }} />
        )}
        {designExtras?.hero_effect === 'glow' && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.3), transparent 60%)' }} />
        )}
        {designExtras?.hero_effect === 'dark' && (
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        )}
        {glitter && <div className="glitter-overlay" />}
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-24 md:py-32 text-white text-center">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.85 }}
            className="text-[11px] font-bold tracking-[0.35em] uppercase mb-4" dir="ltr">
            All You Need In One Place
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-6xl font-extrabold mb-5 leading-tight">
            {store.hero_title || `أهلاً في ${store.store_name}`}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-base md:text-lg opacity-90 max-w-2xl mx-auto mb-9">
            {store.hero_subtitle || store.description || 'اكتشف أحدث الأجهزة والإكسسوارات بأفضل الأسعار.'}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" asChild className="bg-white hover:bg-white/90 text-black font-bold px-8">
              <Link to={`/store/${slug}/products`}>{designExtras?.hero_button_text || 'تسوّق الآن'}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild
              className="border-white/60 bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur px-8">
              <Link to={`/store/${slug}/products`}>تصفح العروض</Link>
            </Button>
          </motion.div>
        </div>
      </section>
    ),

    perks: perksList.length > 0 ? (
      <section key="perks" className="border-b bg-card/60">
        <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-5">
          {perksList.slice(0, 4).map((perk, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.07 }} className="text-center">
              <p className="font-bold text-sm">{perk.title}</p>
              {perk.desc && <p className="text-[11px] text-muted-foreground truncate">{perk.desc}</p>}
            </motion.div>
          ))}
        </div>
      </section>
    ) : null,

    wide: (designExtras?.wide_banners || []).length > 0 ? (
      designExtras?.wide_slider && (designExtras.wide_banners || []).length > 1 ? (
        <WideSlider key="wide" banners={designExtras.wide_banners!} glitter={glitter} />
      ) : (
      <div key="wide">
        {(designExtras?.wide_banners || []).map((b, i) => (
          <motion.section
            key={`wide-${i}`}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="relative w-full h-64 md:h-96 overflow-hidden flex items-center justify-center"
            style={{
              background: b.image_url
                ? `linear-gradient(135deg, hsl(var(--store-primary) / 0.35), hsl(var(--store-secondary) / 0.35)), url(${b.image_url}) center/cover`
                : `linear-gradient(135deg, hsl(var(--store-primary)), hsl(var(--store-secondary)))`,
            }}
          >
            {glitter && <div className="glitter-overlay" />}
            {(b.title || b.subtitle) && (
              <div className="relative z-10 text-center text-white px-4">
                {b.title && <h2 className="text-2xl md:text-5xl font-extrabold mb-3 drop-shadow-lg">{b.title}</h2>}
                {b.subtitle && <p className="text-base md:text-xl opacity-95 drop-shadow max-w-2xl mx-auto">{b.subtitle}</p>}
              </div>
            )}
          </motion.section>
        ))}
      </div>
      )
    ) : null,

    countdown: designExtras?.countdown?.enabled && designExtras.countdown.ends_at ? (
      <OfferCountdown key="countdown" endsAt={designExtras.countdown.ends_at} title={designExtras.countdown.title} glitter={glitter} />
    ) : null,

    brands: designExtras?.brands && designExtras.brands.filter(b => b.name || b.image_url).length > 0 ? (
      <section key="brands" className="border-y bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-center text-muted-foreground mb-5" dir="ltr">Our Brands</p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {designExtras.brands.filter(b => b.name || b.image_url).map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                {b.image_url ? (
                  <img src={b.image_url} alt={b.name} className="h-10 object-contain opacity-70 hover:opacity-100 transition-opacity" />
                ) : (
                  <span className="text-lg font-extrabold text-muted-foreground/60 hover:text-foreground transition-colors">{b.name}</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    ) : null,

    video: designExtras?.video?.enabled && designExtras.video.url && youtubeId(designExtras.video.url) ? (
      <section key="video" className="max-w-5xl mx-auto px-4 py-12">
        {designExtras.video.title && (
          <SectionHead en="Watch" ar={designExtras.video.title} />
        )}
        <div className="rounded-3xl overflow-hidden border shadow-lg aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId(designExtras.video.url)}`}
            title={designExtras.video.title || 'فيديو المتجر'}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </section>
    ) : null,

    faq: designExtras?.faq && designExtras.faq.filter(f => f.q && f.a).length > 0 ? (
      <section key="faq" className="max-w-3xl mx-auto px-4 py-12">
        <SectionHead en="FAQ" ar="الأسئلة الشائعة" />
        <div className="space-y-3">
          {designExtras.faq.filter(f => f.q && f.a).map((f, i) => (
            <motion.details key={i}
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="group bg-card rounded-2xl border px-5 py-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-bold text-sm">
                {f.q}
                <span className="text-lg transition-transform group-open:rotate-45 shrink-0" style={{ color: 'hsl(var(--store-primary))' }}>+</span>
              </summary>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3 whitespace-pre-wrap">{f.a}</p>
            </motion.details>
          ))}
        </div>
      </section>
    ) : null,

    feature: designExtras?.feature_images && designExtras.feature_images.length > 0 ? (
      <section key="feature" className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-5">
          {designExtras.feature_images.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="relative overflow-hidden rounded-3xl shadow-lg group h-72 md:h-96"
            >
              <img src={f.image_url} alt={f.caption || `صورة مميزة ${i + 1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-6">
                <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/80 mb-1" dir="ltr">Featured</p>
                {f.caption && <p className="text-white text-lg md:text-2xl font-extrabold drop-shadow">{f.caption}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    ) : null,

    divider: designExtras?.divider?.enabled ? (
      <section
        key="divider"
        className="relative w-full overflow-hidden my-6"
        style={{ background: `linear-gradient(90deg, hsl(var(--store-primary)), hsl(var(--store-secondary)))` }}
      >
        {glitter && <div className="glitter-overlay" />}
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-10 md:py-14 flex items-center justify-between flex-wrap gap-5 text-white">
          <div>
            <motion.h3 initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="text-2xl md:text-4xl font-extrabold drop-shadow">
              {designExtras.divider.text || 'عروض نهاية الأسبوع'}
            </motion.h3>
            <p className="text-sm md:text-base opacity-90 mt-1.5">خصومات على منتجات مختارة — لفترة محدودة</p>
          </div>
          <Button size="lg" asChild className="bg-white hover:bg-white/90 text-black font-bold">
            <Link to={`/store/${slug}/products`}>اكتشف العروض</Link>
          </Button>
        </div>
      </section>
    ) : null,

    banners: Array.isArray(store.additional_banners) && store.additional_banners.length > 0 ? (
      <section key="banners" className="max-w-7xl mx-auto px-4 py-10">
        <div className={`grid gap-4 ${store.additional_banners.length === 1 ? '' : 'md:grid-cols-2'}`}>
          {store.additional_banners.map((b, i) => {
            const Wrapper: any = b.link ? 'a' : 'div';
            const wrapperProps = b.link ? { href: b.link, target: b.link.startsWith('http') ? '_blank' : '_self', rel: 'noopener' } : {};
            return (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <Wrapper
                  {...wrapperProps}
                  className="group relative block overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all aspect-[16/7] cursor-pointer"
                  style={{
                    background: b.image_url
                      ? `linear-gradient(135deg, hsl(var(--store-primary) / 0.45), hsl(var(--store-secondary) / 0.45)), url(${b.image_url}) center/cover`
                      : `linear-gradient(135deg, hsl(var(--store-primary)), hsl(var(--store-secondary)))`,
                  }}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
                    {b.title && <h3 className="text-xl md:text-3xl font-extrabold mb-2 drop-shadow">{b.title}</h3>}
                    {b.subtitle && <p className="text-sm md:text-base opacity-95 max-w-md drop-shadow">{b.subtitle}</p>}
                  </div>
                </Wrapper>
              </motion.div>
            );
          })}
        </div>
      </section>
    ) : null,

    categories: categories.length > 0 ? (
      <section key="categories" className="max-w-7xl mx-auto px-4 py-12">
        <SectionHead num={numMap.categories} en="Shop by Category" ar="تسوّق حسب الفئة" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
              <Link to={`/store/${slug}/products?category=${encodeURIComponent(c.name)}`}
                className="group block bg-card rounded-2xl border py-6 px-4 text-center transition-all hover:shadow-lg hover:-translate-y-0.5">
                <h3 className="font-bold text-sm group-hover:underline underline-offset-4">{c.name}</h3>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    ) : null,

    products: (
      <section key="products" className="max-w-7xl mx-auto px-4 py-12">
        <SectionHead num={numMap.products} en="Best Sellers"
          ar={store.featured_section_enabled ? 'منتجات مميزة' : 'الأكثر مبيعًا'}
          action={
            <Button variant="ghost" asChild>
              <Link to={`/store/${slug}/products`}>عرض الكل <ArrowLeft className="w-4 h-4 mr-1" /></Link>
            </Button>
          } />
        {featured.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد منتجات متاحة حالياً</p>
        ) : designExtras?.product_motion === 'marquee' ? (
          <div className="overflow-hidden" dir="ltr">
            <motion.div
              className="flex gap-4 w-max"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: Math.max(20, featured.slice(0, 8).length * 6), ease: 'linear', repeat: Infinity }}
            >
              {[...featured.slice(0, 8), ...featured.slice(0, 8)].map((p, i) => (
                <div key={`${p.type}-${p.id}-${i}`} className="w-56 shrink-0" dir="rtl">
                  <ProductCard product={p} currency={currency} />
                </div>
              ))}
            </motion.div>
          </div>
        ) : designExtras?.product_motion === 'float' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.slice(0, 8).map((p, i) => (
              <motion.div
                key={`${p.type}-${p.id}`}
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }}
              >
                <ProductCard product={p} currency={currency} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.slice(0, 8).map((p) => <ProductCard key={`${p.type}-${p.id}`} product={p} currency={currency} />)}
          </div>
        )}
      </section>
    ),

    reviews: designExtras?.testimonials && designExtras.testimonials.filter(t => t.text).length > 0 ? (
      <section key="reviews" className="border-y" style={{ background: `hsl(var(--store-primary) / 0.03)` }}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <SectionHead num={numMap.reviews} en="Reviews" ar="آراء العملاء" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {designExtras.testimonials.filter(t => t.text).map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-card rounded-2xl border p-6 flex flex-col"
              >
                <div className="flex gap-0.5 mb-3" dir="ltr">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className="text-base" style={{ color: s <= (t.rating || 5) ? '#f59e0b' : 'hsl(var(--muted-foreground) / 0.3)' }}>★</span>
                  ))}
                </div>
                <p className="text-sm leading-relaxed flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3 mt-5 pt-4 border-t">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white"
                    style={{ background: `hsl(var(--store-primary))` }}>
                    {(t.name || 'ع').charAt(0)}
                  </span>
                  <p className="text-sm font-bold">{t.name || 'عميل'}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    ) : null,

    gallery: designExtras && designExtras.gallery.length > 0 ? (
      <section key="gallery" className="max-w-7xl mx-auto px-4 py-12">
        <SectionHead num={numMap.gallery} en="Gallery" ar="معرض الصور" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {designExtras.gallery.map((g, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="relative overflow-hidden rounded-2xl shadow-md group aspect-[4/3]"
            >
              <img src={g.image_url} alt={g.caption || `صورة ${i + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              {g.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white text-sm font-semibold drop-shadow">{g.caption}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>
    ) : null,

    text: designExtras && (designExtras.custom_heading || designExtras.custom_text) ? (
      <section key="text" className="max-w-3xl mx-auto px-4 py-14 text-center">
        {designExtras.custom_heading && (
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-extrabold mb-4"
            style={{ color: 'hsl(var(--store-primary))' }}
          >
            {designExtras.custom_heading}
          </motion.h2>
        )}
        {designExtras.custom_text && (
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-base md:text-xl text-muted-foreground leading-relaxed whitespace-pre-wrap"
          >
            {designExtras.custom_text}
          </motion.p>
        )}
      </section>
    ) : null,

    support: designExtras?.customer_service?.enabled ? (
      <section key="support" className="max-w-5xl mx-auto px-4 py-12">
        <div className="rounded-3xl border overflow-hidden grid md:grid-cols-2">
          <div className="p-8 md:p-10" style={{ background: `hsl(var(--store-primary) / 0.05)` }}>
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase mb-2" style={{ color: 'hsl(var(--store-primary))' }} dir="ltr">Customer Care</p>
            <h2 className="text-2xl md:text-3xl font-extrabold mb-3">خدمة العملاء</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {designExtras.customer_service.note || 'فريقنا جاهز لمساعدتك — تواصل معنا في أي وقت.'}
            </p>
          </div>
          <div className="p-8 md:p-10 space-y-3 bg-card">
            {designExtras.customer_service.whatsapp && (
              <p className="text-sm font-semibold flex items-center gap-2">💬 واتساب: <span dir="ltr" className="font-mono">{designExtras.customer_service.whatsapp}</span></p>
            )}
            {designExtras.customer_service.phone && (
              <p className="text-sm font-semibold flex items-center gap-2">📞 اتصال: <span dir="ltr" className="font-mono">{designExtras.customer_service.phone}</span></p>
            )}
            {designExtras.customer_service.hours && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">🕐 {designExtras.customer_service.hours}</p>
            )}
            <div className="pt-2 flex gap-2 flex-wrap">
              {designExtras.customer_service.whatsapp && (
                <a href={`https://wa.me/${designExtras.customer_service.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm shadow hover:opacity-90 transition-opacity"
                  style={{ background: '#25D366' }}>
                  تواصل عبر واتساب
                </a>
              )}
              {designExtras.customer_service.phone && (
                <a href={`tel:${designExtras.customer_service.phone}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm shadow hover:opacity-90 transition-opacity"
                  style={{ background: `hsl(var(--store-primary))` }}>
                  اتصل بنا
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    ) : null,
  };

  return (
    <div>
      {sectionOrder.map(key => {
        const node = sections[key];
        if (!node) return null;
        return <div key={key}>{node}</div>;
      })}
    </div>
  );
}
