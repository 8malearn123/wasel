import { useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductCard, type StoreProduct } from '@/components/store/ProductCard';
import { StoreSEO } from '@/components/store/StoreSEO';
import type { StoreSettings, StoreCategory } from '@/hooks/useOnlineStore';

interface Props {
  store: StoreSettings;
  devices: any[];
  accessories: any[];
  categories: StoreCategory[];
}

export function StoreProductsPage({ store, devices, accessories, categories }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [type, setType] = useState<'all' | 'device' | 'accessory'>('all');
  const category = params.get('category') || '';
  const currency = store.currency_symbol || 'ر.س';

  const products: StoreProduct[] = useMemo(() => {
    const list: StoreProduct[] = [
      ...devices.map((d) => ({ id: d.id, type: 'device' as const, name: `${d.brand || ''} ${d.model}`.trim(), brand: d.brand, price: Number(d.price), storage: d.storage, color: d.color, condition: d.condition, category: d.category })),
      ...accessories.map((a) => ({ id: a.id, type: 'accessory' as const, name: a.name, brand: a.brand, price: Number(a.price), category: a.category })),
    ];
    let filtered = list;
    if (type !== 'all') filtered = filtered.filter((p) => p.type === type);
    if (category) filtered = filtered.filter((p) => (p.category || '').toLowerCase() === category.toLowerCase());
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q));
    }
    if (sort === 'price_asc') filtered = [...filtered].sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') filtered = [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [devices, accessories, type, category, search, sort]);

  const seoTitle = category
    ? `${category} - ${store.store_name}`
    : `كل المنتجات | ${store.store_name}`;
  const seoDesc = `تصفّح ${products.length} منتج${category ? ` في تصنيف ${category}` : ''} من ${store.store_name}. أسعار شاملة الضريبة وتوصيل سريع.`;
  const canonical = `${window.location.origin}/store/${slug}/products${category ? `?category=${encodeURIComponent(category)}` : ''}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <StoreSEO
        title={seoTitle}
        description={seoDesc}
        image={store.og_image_url || store.banner_url || undefined}
        canonical={canonical}
        siteName={store.store_name}
      />
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن منتج..." className="pr-10" />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as any)}>
          <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المنتجات</SelectItem>
            <SelectItem value="device">الأجهزة</SelectItem>
            <SelectItem value="accessory">الإكسسوارات</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">الأحدث</SelectItem>
            <SelectItem value="price_asc">السعر: الأقل</SelectItem>
            <SelectItem value="price_desc">السعر: الأعلى</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {category && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">تصنيف:</span>
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: `hsl(var(--store-primary) / 0.1)`, color: `hsl(var(--store-primary))` }}>{category}</span>
          <Button variant="ghost" size="sm" onClick={() => { params.delete('category'); setParams(params); }}>إزالة</Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-4">{products.length} منتج</p>

      {products.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">لا توجد منتجات مطابقة</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => <ProductCard key={`${p.type}-${p.id}`} product={p} currency={currency} />)}
        </div>
      )}
    </div>
  );
}
