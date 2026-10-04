import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type ProductItemType = 'device' | 'accessory' | 'repair_part';

export interface ProductMedia {
  id: string;
  merchant_id: string;
  item_type: ProductItemType;
  item_id: string;
  media_type: 'image' | 'model_3d';
  storage_path: string;
  public_url: string;
  thumb_url: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mime: string | null;
  created_at: string;
}

const BUCKET = 'product-media';
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
/** Longest edge after downscaling. A product photo past this is wasted bytes. */
const MAX_EDGE = 1600;

/**
 * Checked here so the user gets a sentence instead of a failed request. The
 * bucket repeats both limits (file_size_limit and allowed_mime_types), which is
 * what actually stops a crafted upload.
 */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) {
    return 'الصيغ المدعومة: JPG، PNG، WebP، AVIF';
  }
  if (file.size > MAX_BYTES) {
    return `حجم الصورة أكبر من ${Math.round(MAX_BYTES / 1024 / 1024)} ميجابايت`;
  }
  return null;
}

/** Downscale and re-encode before upload. Returns the original if anything fails. */
async function compress(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, width: bitmap.width, height: bitmap.height };
    ctx.drawImage(bitmap, 0, 0, width, height);

    // WebP where the browser supports it, JPEG otherwise. Transparency is not
    // worth keeping for a product photo on a white card.
    const type = canvas.toDataURL('image/webp').startsWith('data:image/webp')
      ? 'image/webp'
      : 'image/jpeg';
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, type, 0.85));
    return blob ? { blob, width, height } : { blob: file, width, height };
  } catch {
    return { blob: file, width: 0, height: 0 };
  }
}

export function useProductMedia(itemType: ProductItemType, itemId?: string | null) {
  const { merchant } = useAuth();
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchMedia = useCallback(async () => {
    if (!itemId || !merchant) { setMedia([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('product_media' as never)
      .select('*')
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .order('sort_order')
      .order('created_at');
    if (error) console.warn('[product media]', error.message);
    setMedia(((data || []) as unknown as ProductMedia[]));
    setLoading(false);
  }, [itemType, itemId, merchant]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const upload = async (file: File) => {
    if (!merchant || !itemId) return null;

    const problem = validateImageFile(file);
    if (problem) { toast.error(problem); return null; }

    setUploading(true);
    try {
      const { blob, width, height } = await compress(file);
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      // The first path segment is the merchant id — the storage policy pins it
      const path = `${merchant.id}/${itemType}/${itemId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });

      if (uploadError) { toast.error(uploadError.message); return null; }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { data, error } = await supabase
        .from('product_media' as never)
        .insert({
          merchant_id: merchant.id,
          item_type: itemType,
          item_id: itemId,
          media_type: 'image',
          storage_path: path,
          public_url: urlData.publicUrl,
          sort_order: media.length,
          width: width || null,
          height: height || null,
          bytes: blob.size,
          mime: blob.type,
        } as never)
        .select()
        .single();

      if (error) {
        // the row failed, so the object would be an orphan
        await supabase.storage.from(BUCKET).remove([path]);
        toast.error(error.message);
        return null;
      }

      await fetchMedia();
      return data as unknown as ProductMedia;
    } finally {
      setUploading(false);
    }
  };

  const remove = async (item: ProductMedia) => {
    const { error } = await supabase.from('product_media' as never).delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    // The row is the record; a leftover object is wasted space, not a bug.
    await supabase.storage.from(BUCKET).remove([item.storage_path]);
    await fetchMedia();
  };

  const setPrimary = async (id: string) => {
    // One statement: a database trigger clears the previous primary
    const { error } = await supabase
      .from('product_media' as never)
      .update({ is_primary: true } as never)
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    await fetchMedia();
  };

  const reorder = async (orderedIds: string[]) => {
    const previous = media;
    setMedia(orderedIds.map((id, i) => ({ ...previous.find(m => m.id === id)!, sort_order: i })));
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from('product_media' as never).update({ sort_order: index } as never).eq('id', id),
      ),
    );
    const failed = results.find(r => r.error);
    if (failed?.error) {
      toast.error(failed.error.message);
      setMedia(previous);
      return;
    }
    await fetchMedia();
  };

  const setAltText = async (id: string, alt_text: string) => {
    const { error } = await supabase
      .from('product_media' as never)
      .update({ alt_text } as never)
      .eq('id', id);
    if (error) toast.error(error.message);
    else await fetchMedia();
  };

  return { media, loading, uploading, upload, remove, setPrimary, reorder, setAltText, refetch: fetchMedia };
}

/** The cover image of many items at once — for a grid or a table. */
export function usePrimaryMedia(itemType: ProductItemType, itemIds: string[]) {
  const { merchant } = useAuth();
  const [byItem, setByItem] = useState<Record<string, string>>({});
  const key = itemIds.join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!merchant || itemIds.length === 0) { setByItem({}); return; }
      const { data } = await supabase
        .from('product_media' as never)
        .select('item_id, public_url')
        .eq('item_type', itemType)
        .eq('is_primary', true)
        .in('item_id', itemIds);
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const row of (data || []) as unknown as { item_id: string; public_url: string }[]) {
        map[row.item_id] = row.public_url;
      }
      setByItem(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemType, key, merchant]);

  return byItem;
}
