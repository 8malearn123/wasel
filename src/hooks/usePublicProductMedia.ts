import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProductItemType } from './useProductMedia';

export interface PublicMedia {
  id: string;
  media_type: 'image' | 'model_3d';
  public_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

/**
 * A storefront visitor's view of one product's media.
 *
 * Anonymous reads are allowed by the "Public read media of published store
 * items" policy, so this returns only what a published store is already
 * showing. Before the product_media migration is applied the query fails and
 * this returns nothing, which is exactly how a product with no media behaves —
 * the page keeps working either way.
 */
export function usePublicProductMedia(itemType: ProductItemType, itemId?: string | null) {
  const [images, setImages] = useState<PublicMedia[]>([]);
  const [model3d, setModel3d] = useState<PublicMedia | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!itemId) { setImages([]); setModel3d(null); return; }

    setLoading(true);
    supabase
      .from('product_media' as never)
      .select('id, media_type, public_url, alt_text, sort_order, is_primary')
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .order('sort_order')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // table not there yet, or nothing visible to this viewer
          setImages([]);
          setModel3d(null);
        } else {
          const rows = (data || []) as unknown as PublicMedia[];
          setImages(rows.filter(m => m.media_type === 'image'));
          // one model per product: the first by sort order
          setModel3d(rows.find(m => m.media_type === 'model_3d') ?? null);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [itemType, itemId]);

  return { images, model3d, loading };
}
