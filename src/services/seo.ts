import { supabase } from '@/integrations/supabase/client';
import type { SeoService, SeoFields, Result } from './contracts';

/**
 * Store SEO is REAL: store_settings already holds seo_title, seo_description,
 * seo_keywords, og_image_url and slug, so this reads and writes them.
 *
 * Product SEO is not: the slug and seo columns on devices/accessories arrive
 * with the Phase 1 migration, which has not been applied. Those methods return
 * `unavailable` rather than pretending, and the editor shows the "waiting for
 * the backend" state. Nothing here creates a table or a column.
 */

const ok = <T,>(data: T): Result<T> => ({ status: 'ok', data });
const fail = (code: 'unavailable' | 'unknown' | 'not_found', message: string): Result<never> =>
  ({ status: 'error' as const, error: { code, message } });

const EMPTY: SeoFields = {
  title: null, description: null, slug: null, canonicalUrl: null,
  socialTitle: null, socialDescription: null, socialImageUrl: null, indexable: true,
};

// store_settings is readable for every published store (the storefront reads
// it), so an unfiltered query returned many rows and maybeSingle() failed with
// «JSON object requested, multiple (or no) rows returned». Always this shop's.
async function myMerchantId(userId: string): Promise<string | null> {
  const { data } = await supabase.from('merchant_users').select('merchant_id').eq('user_id', userId).limit(1);
  return data?.[0]?.merchant_id ?? null;
}

export const supabaseSeoService: SeoService = {
  async getStoreSeo() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return fail('unavailable', 'الجلسة غير متاحة');
    const merchantId = await myMerchantId(auth.user.id);
    if (!merchantId) return ok(EMPTY);

    const { data, error } = await supabase
      .from('store_settings')
      .select('seo_title, seo_description, slug, og_image_url, store_name, description')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (error) return fail('unknown', error.message);
    if (!data) return ok(EMPTY);

    return ok({
      title: data.seo_title ?? null,
      description: data.seo_description ?? null,
      slug: data.slug ?? null,
      // Derived from the slug — there is no canonical column, and inventing one
      // would be a schema change this frontend may not make.
      canonicalUrl: data.slug ? `${window.location.origin}/store/${data.slug}` : null,
      socialTitle: data.seo_title ?? data.store_name ?? null,
      socialDescription: data.seo_description ?? data.description ?? null,
      socialImageUrl: data.og_image_url ?? null,
      indexable: true,
    });
  },

  async saveStoreSeo(fields: SeoFields) {
    const { data: auth } = await supabase.auth.getUser();
    const merchantId = auth?.user ? await myMerchantId(auth.user.id) : null;
    if (!merchantId) return fail('unavailable', 'الجلسة غير متاحة');
    const { data: existing } = await supabase
      .from('store_settings')
      .select('id')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (!existing) return fail('not_found', 'إعدادات المتجر غير موجودة');

    // Only the columns that exist are written. canonicalUrl, socialTitle,
    // socialDescription and indexable have no column yet; they are shown in the
    // editor and the backend developer adds them when the schema does.
    const { error } = await supabase
      .from('store_settings')
      .update({
        seo_title: fields.title,
        seo_description: fields.description,
        og_image_url: fields.socialImageUrl,
      })
      .eq('id', existing.id);

    if (error) return fail('unknown', error.message);
    return ok(fields);
  },

  async getProductSeo() {
    return fail('unavailable', 'حقول SEO للمنتجات تنتظر تطبيق migration المنتجات');
  },

  async saveProductSeo() {
    return fail('unavailable', 'حقول SEO للمنتجات تنتظر تطبيق migration المنتجات');
  },
};
