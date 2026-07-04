import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard, type StoreProduct } from '@/components/store/ProductCard';
import type { StoreSettings, StoreCategory } from '@/hooks/useOnlineStore';

interface Props {
  store: StoreSettings;
  devices: any[];
  accessories: any[];
  categories: StoreCategory[];
}

export function StoreHomePage({ store, devices, accessories, categories }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const currency = store.currency_symbol || 'ر.س';
  const allProducts: StoreProduct[] = [
    ...devices.map((d) => ({ id: d.id, type: 'device' as const, name: `${d.brand || ''} ${d.model}`.trim(), brand: d.brand, price: Number(d.price), storage: d.storage, color: d.color, condition: d.condition, category: d.category })),
    ...accessories.map((a) => ({ id: a.id, type: 'accessory' as const, name: a.name, brand: a.brand, price: Number(a.price), category: a.category })),
  ];

  const featured = store.featured_section_enabled && store.featured_product_ids && store.featured_product_ids.length > 0
    ? allProducts.filter((p) => store.featured_product_ids!.includes(p.id))
    : allProducts.slice(0, 8);

  return (
    <div>
      {/* Hero */}
      <section
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
            <Link to={`/store/${slug}/products`}>تسوق الآن</Link>
          </Button>
        </div>
      </section>

      {/* Additional Banners */}
      {Array.isArray(store.additional_banners) && store.additional_banners.length > 0 && (
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

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12">
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
      )}

      {/* Featured / Products */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{store.featured_section_enabled ? 'منتجات مميزة' : 'أحدث المنتجات'}</h2>
          <Button variant="ghost" asChild>
            <Link to={`/store/${slug}/products`}>عرض الكل <ArrowLeft className="w-4 h-4 mr-1" /></Link>
          </Button>
        </div>
        {featured.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد منتجات متاحة حالياً</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.slice(0, 8).map((p) => <ProductCard key={`${p.type}-${p.id}`} product={p} currency={currency} />)}
          </div>
        )}
      </section>
    </div>
  );
}
