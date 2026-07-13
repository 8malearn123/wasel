import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard, type StoreProduct } from '@/components/store/ProductCard';
import { useStoreFavorites } from '@/components/store/StoreFavorites';
import type { StoreSettings } from '@/hooks/useOnlineStore';

interface Props {
  store: StoreSettings;
  devices: any[];
  accessories: any[];
}

export function StoreFavoritesPage({ store, devices, accessories }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const { ids } = useStoreFavorites();
  const currency = store.currency_symbol || 'ر.س';

  const favorites: StoreProduct[] = useMemo(() => {
    const all: StoreProduct[] = [
      ...devices.map((d) => ({ id: d.id, type: 'device' as const, name: `${d.brand || ''} ${d.model}`.trim(), brand: d.brand, price: Number(d.price), storage: d.storage, color: d.color, condition: d.condition, category: d.category, createdAt: d.created_at })),
      ...accessories.map((a) => ({ id: a.id, type: 'accessory' as const, name: a.name, brand: a.brand, price: Number(a.price), category: a.category, createdAt: a.created_at })),
    ];
    return all.filter((p) => ids.includes(`${p.type}-${p.id}`));
  }, [devices, accessories, ids]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="w-6 h-6 text-red-500 fill-red-500" />
        <h1 className="text-2xl font-bold">المفضلة</h1>
        <span className="text-sm text-muted-foreground">({favorites.length})</span>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium mb-1">ما فيه شيء في المفضلة بعد</p>
          <p className="text-sm text-muted-foreground mb-6">اضغط على القلب ❤️ في أي منتج يعجبك وراح تلاقيه هنا</p>
          <Button asChild style={{ background: `hsl(var(--store-primary))` }} className="text-white">
            <Link to={`/store/${slug}/products`}>تصفح المنتجات</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {favorites.map((p) => <ProductCard key={`${p.type}-${p.id}`} product={p} currency={currency} />)}
        </div>
      )}
    </div>
  );
}
