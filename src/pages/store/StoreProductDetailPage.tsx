import { useParams, Link, useNavigate } from 'react-router-dom';
import { Smartphone, Package, Share2, ShoppingCart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStoreCart } from '@/components/store/StoreCart';
import { ProductCard, type StoreProduct } from '@/components/store/ProductCard';
import { StoreSEO } from '@/components/store/StoreSEO';
import type { StoreSettings } from '@/hooks/useOnlineStore';
import { toast } from 'sonner';

interface Props {
  store: StoreSettings;
  devices: any[];
  accessories: any[];
  type: 'device' | 'accessory';
}

export function StoreProductDetailPage({ store, devices, accessories, type }: Props) {
  const { productId, slug } = useParams<{ productId: string; slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useStoreCart();
  const currency = store.currency_symbol || 'ر.س';

  const item = type === 'device' ? devices.find((d) => d.id === productId) : accessories.find((a) => a.id === productId);

  if (!item) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">المنتج غير متاح</h1>
        <Button asChild><Link to={`/store/${slug}/products`}>تصفح المنتجات</Link></Button>
      </div>
    );
  }

  const name = type === 'device' ? `${item.brand || ''} ${item.model}`.trim() : item.name;
  const price = Number(item.price);

  const handleAdd = () => {
    addItem({
      id: `${type}-${item.id}`,
      name,
      price,
      quantity: 1,
      type,
      deviceId: type === 'device' ? item.id : undefined,
      accessoryId: type === 'accessory' ? item.id : undefined,
    });
  };

  const handleBuyNow = () => { handleAdd(); navigate(`/store/${slug}/cart`); };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: name, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('تم نسخ الرابط');
    }
  };

  const similar: StoreProduct[] = (type === 'device' ? devices : accessories)
    .filter((p) => p.id !== item.id && (p.brand === item.brand || p.category === item.category))
    .slice(0, 4)
    .map((p) => type === 'device'
      ? { id: p.id, type: 'device', name: `${p.brand || ''} ${p.model}`.trim(), brand: p.brand, price: Number(p.price), storage: p.storage, color: p.color }
      : { id: p.id, type: 'accessory', name: p.name, brand: p.brand, price: Number(p.price) });

  const productImage = (item as any).image_url || store.og_image_url || store.banner_url || undefined;
  const descBase = (item as any).description || `${name}${item.brand ? ` من ${item.brand}` : ''}${item.storage ? ` - ${item.storage}` : ''}${item.color ? ` - ${item.color}` : ''}. متوفر الآن في ${store.store_name} بسعر ${price.toLocaleString()} ${currency} شامل الضريبة.`;
  const seoTitle = `${name}${item.brand ? ` - ${item.brand}` : ''} | ${store.store_name}`;
  const canonical = `${window.location.origin}/store/${slug}/${type}/${item.id}`;
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: descBase,
    sku: (item as any).sku || (item as any).imei || item.id,
    brand: item.brand ? { '@type': 'Brand', name: item.brand } : undefined,
    image: productImage ? [productImage] : undefined,
    category: item.category || undefined,
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'SAR',
      price: price.toFixed(2),
      availability: 'https://schema.org/InStock',
      itemCondition: type === 'device' && item.condition === 'used'
        ? 'https://schema.org/UsedCondition'
        : 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: store.store_name },
    },
  };
  const breadcrumbsLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: store.store_name, item: `${window.location.origin}/store/${slug}` },
      { '@type': 'ListItem', position: 2, name: 'المنتجات', item: `${window.location.origin}/store/${slug}/products` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <StoreSEO
        title={seoTitle}
        description={descBase.slice(0, 160)}
        image={productImage}
        canonical={canonical}
        type="product"
        siteName={store.store_name}
        jsonLd={[productJsonLd, breadcrumbsLd]}
      />
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-muted/40 rounded-2xl flex items-center justify-center">
          {type === 'device' ? <Smartphone className="w-32 h-32 text-muted-foreground/30" /> : <Package className="w-32 h-32 text-muted-foreground/30" />}
        </div>
        <div>
          {item.brand && <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">{item.brand}</p>}
          <h1 className="text-3xl font-bold mb-3">{name}</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            {item.condition && <Badge variant="secondary">{item.condition === 'new' ? 'جديد' : item.condition}</Badge>}
            {item.storage && <Badge variant="outline">{item.storage}</Badge>}
            {item.color && <Badge variant="outline">{item.color}</Badge>}
            {item.category && <Badge variant="outline">{item.category}</Badge>}
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-bold" style={{ color: `hsl(var(--store-primary))` }}>{price.toLocaleString()}</span>
            <span className="text-muted-foreground">{currency}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-6">السعر شامل ضريبة القيمة المضافة 15%</p>

          {type === 'device' && (
            <div className="bg-muted/30 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> ضمان أصلي من المتجر</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> توصيل سريع</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> دفع آمن</div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleBuyNow} className="flex-1 text-white" size="lg" style={{ background: `hsl(var(--store-primary))` }}>
              <ShoppingCart className="w-4 h-4 ml-2" /> اشترِ الآن
            </Button>
            <Button onClick={handleAdd} variant="outline" size="lg">إضافة للسلة</Button>
            <Button onClick={handleShare} variant="ghost" size="lg" className="px-3"><Share2 className="w-5 h-5" /></Button>
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-4">منتجات مشابهة</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {similar.map((p) => <ProductCard key={`${p.type}-${p.id}`} product={p} currency={currency} />)}
          </div>
        </section>
      )}
    </div>
  );
}
