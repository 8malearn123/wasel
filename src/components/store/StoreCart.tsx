import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: 'device' | 'accessory';
  deviceId?: string;
  accessoryId?: string;
  image?: string;
}

interface CartContextType {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  updateQty: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function StoreCartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const storageKey = `store-cart:${slug}`;
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items, storageKey]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        if (item.type === 'device') { toast.info('الجهاز موجود في السلة'); return prev; }
        toast.success('زيادة الكمية في السلة');
        return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      toast.success('تمت الإضافة للسلة');
      return [...prev, item];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setItems((prev) => prev.map((c) => c.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, c) => s + c.quantity, 0);
  const subtotal = items.reduce((s, c) => s + c.price * c.quantity, 0);

  return (
    <CartContext.Provider value={{ items, count, subtotal, addItem, updateQty, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useStoreCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useStoreCart must be inside StoreCartProvider');
  return ctx;
}
