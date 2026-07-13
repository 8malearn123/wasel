import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';

// Customer wishlist, saved per-store on the visitor's device
interface FavoritesContextType {
  ids: string[];
  count: number;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function StoreFavoritesProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const storageKey = `store-favs:${slug}`;
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch { /* ignore */ }
  }, [ids, storageKey]);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  const toggleFavorite = useCallback((id: string) => {
    setIds((prev) => {
      if (prev.includes(id)) {
        toast.info('أُزيل من المفضلة');
        return prev.filter((x) => x !== id);
      }
      toast.success('أُضيف إلى المفضلة ❤️');
      return [...prev, id];
    });
  }, []);

  return (
    <FavoritesContext.Provider value={{ ids, count: ids.length, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useStoreFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useStoreFavorites must be inside StoreFavoritesProvider');
  return ctx;
}
