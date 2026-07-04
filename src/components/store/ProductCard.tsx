import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smartphone, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreCart } from './StoreCart';

export interface StoreProduct {
  id: string;
  type: 'device' | 'accessory';
  name: string;
  brand?: string;
  price: number;
  image?: string;
  imei?: string;
  storage?: string;
  color?: string;
  condition?: string;
  category?: string;
}

export function ProductCard({ product, currency = 'ر.س' }: { product: StoreProduct; currency?: string }) {
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useStoreCart();
  const detailPath = `/store/${slug}/${product.type === 'device' ? 'device' : 'accessory'}/${product.id}`;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: `${product.type}-${product.id}`,
      name: product.name,
      price: product.price,
      quantity: 1,
      type: product.type,
      deviceId: product.type === 'device' ? product.id : undefined,
      accessoryId: product.type === 'accessory' ? product.id : undefined,
      image: product.image,
    });
  };

  return (
    <motion.div whileHover={{ y: -4 }} className="group">
      <Link to={detailPath} className="block bg-card rounded-2xl border overflow-hidden hover:shadow-xl transition-shadow">
        <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
          {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          ) : product.type === 'device' ? (
            <Smartphone className="w-20 h-20 text-muted-foreground/30" />
          ) : (
            <Package className="w-20 h-20 text-muted-foreground/30" />
          )}
        </div>
        <div className="p-4 space-y-2">
          {product.brand && <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{product.brand}</p>}
          <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
          {(product.storage || product.color) && (
            <p className="text-xs text-muted-foreground">{[product.storage, product.color].filter(Boolean).join(' • ')}</p>
          )}
          <div className="flex items-baseline gap-1 pt-1">
            <span className="text-lg font-bold" style={{ color: 'hsl(var(--store-primary))' }}>{Number(product.price).toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{currency}</span>
          </div>
          <Button
            onClick={handleAdd}
            className="w-full mt-2 text-white"
            style={{ background: `hsl(var(--store-primary))` }}
            size="sm"
          >
            أضف للسلة
          </Button>
        </div>
      </Link>
    </motion.div>
  );
}
