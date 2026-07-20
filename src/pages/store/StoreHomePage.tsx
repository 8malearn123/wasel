import { motion } from 'framer-motion';
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

  // ترتيب وإظهار الأقسام حسب محرر المتجر (تصميم ماكس) مع الافتراضي كنسخة احتياطية
  const savedSections = designExtras?.home_sections;
  const sectionOrder = (savedSections && savedSections.length > 0
    ? [
        ...savedSections,
        // أي قسم جديد ما كان موجود وقت الحفظ يظهر في آخر القائمة
        ...DEFAULT_HOME_SECTIONS.filter(d => !savedSections.some(s => s.key === d.key)),
      ]
    : DEFAULT_HOME_SECTIONS
  ).filter(s => s.visible !== false).map(s => s.key);

  const sections: Record<string, React.ReactNode> = {
    hero: (
      <section
        key="hero"
        className="relative overflow-hidden"
        style={{
          background: store.hero_image_url
            ? `linear-gradient(135deg, hsl(var(--store-primary) / 0.85), hsl(var(--store-secondary) / 0.85)), url(${store.hero_image_url}) center/cover`
            : `linear-gradient(135deg, hsl(var(--store-primary)), hsl(var(--store-secondary)))`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-28 text-white text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-5xl font-extrabold mb-4">
            {store.hero_title || `أهلاً في ${store.store_name}`}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-base md:text-lg opacity-90 max-w-2xl mx-auto mb-8">
            {store.hero_subtitle || store.description || 'اكتشف أحدث الأجهزة والإكسسوارات بأفضل الأسعار.'}
          </motion.p>
          <Button size="lg" asChild className="bg-white hover:bg-white/90 text-black">
            <Link to={`/store/${slug}/products`}>{designExtras?.hero_button_text || 'تسوق الآن'}</Link>
          </Button>
        </div>
      </section>
    ),

    wide: (designExtras?.wide_banners || []).length > 0 ? (
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
            {(b.title || b.subtitle) && (
              <div className="text-center text-white px-4">
                {b.title && <h2 className="text-2xl md:text-5xl font-extrabold mb-3 drop-shadow-lg">{b.title}</h2>}
                {b.subtitle && <p className="text-base md:text-xl opacity-95 drop-shadow max-w-2xl mx-auto">{b.subtitle}</p>}
              </div>
            )}
          </motion.section>
        ))}
      </div>
    ) : null,

    feature: designExtras?.feature_images && designExtras.feature_images.length > 0 ? (
      <section key="feature" className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-4">
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
              {f.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5">
                  <p className="text-white text-lg md:text-2xl font-bold drop-shadow">{f.caption}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>
    ) : null,

    divider: designExtras?.divider?.enabled ? (
      <section
        key="divider"
        className="w-full h-24 md:h-36 flex items-center justify-center my-6"
        style={{ background: `linear-gradient(90deg, hsl(var(--store-primary)), hsl(var(--store-secondary)))` }}
      >
        {designExtras.divider.text && (
          <motion.p
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-white text-xl md:text-4xl font-extrabold drop-shadow px-4 text-center"
          >
            {designExtras.divider.text}
          </motion.p>
        )}
      </section>
    ) : null,

    gallery: designExtras && designExtras.gallery.length > 0 ? (
      <section key="gallery" className="max-w-7xl mx-auto px-4 py-10">
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
      <section key="text" className="max-w-4xl mx-auto px-4 py-10 text-center">
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
            className="text-base md:text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap"
          >
            {designExtras.custom_text}
          </motion.p>
        )}
      </section>
    ) : null,

    categories: categories.length > 0 ? (
      <section key="categories" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">التصنيفات</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((c) => (
            <Link key={c.id} to={`/store/${slug}/products?category=${encodeURIComponent(c.name)}`} className="group bg-card rounded-2xl border p-6 text-center hover:shadow-lg transition-shadow">
              {c.image_url ? (
                <img src={c.image_url} alt={c.name} className="w-16 h-16 mx-auto rounded-xl object-cover mb-3" />
              ) : (
                <div className="w-16 h-16 mx-auto rounded-xl mb-3" style={{ background: `hsl(var(--store-primary) / 0.1)` }} />
              )}
              <h3 className="font-semibold text-sm">{c.name}</h3>
            </Link>
          ))}
        </div>
      </section>
    ) : null,

    products: (
      <section key="products" className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{store.featured_section_enabled ? 'منتجات مميزة' : 'أحدث المنتجات'}</h2>
          <Button variant="ghost" asChild>
            <Link to={`/store/${slug}/products`}>عرض الكل <ArrowLeft className="w-4 h-4 mr-1" /></Link>
          </Button>
        </div>
        {featured.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد منتجات متاحة حالياً</p>
        ) : designExtras?.product_motion === 'marquee' ? (
          /* شريط منتجات متحرك تلقائياً — تصميم ماكس */
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
          /* منتجات تطفو بحركة ناعمة — تصميم ماكس */
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

    perks: designExtras?.store_perks && designExtras.store_perks.filter(p => p.title).length > 0 ? (
      <section key="perks" className="border-t" style={{ background: `hsl(var(--store-primary) / 0.04)` }}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {designExtras.store_perks.filter(p => p.title).map((perk, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-card rounded-2xl border p-6 text-center hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-3">{perk.icon}</div>
                <h3 className="font-bold mb-1">{perk.title}</h3>
                {perk.desc && <p className="text-xs text-muted-foreground leading-relaxed">{perk.desc}</p>}
              </motion.div>
            ))}
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
        return (
          <div key={key}>
            {node}
            {/* البنرات الإضافية تظل مرتبطة بعد البنر الرئيسي */}
            {key === 'hero' && Array.isArray(store.additional_banners) && store.additional_banners.length > 0 && (
              <section className="max-w-7xl mx-auto px-4 py-10">
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
            )}
          </div>
        );
      })}
    </div>
  );
}
