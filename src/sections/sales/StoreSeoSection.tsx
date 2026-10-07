import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { toast } from 'sonner';
import { seoService, isOk, type SeoFields } from '@/services';
import { SeoEditor } from '@/components/seo/SeoEditor';
import { LoadingState, ErrorState } from '@/components/common/StateViews';

/**
 * SEO for the storefront itself.
 *
 * Title, description and the social image are stored in store_settings, which
 * already has columns for them. Canonical URL, social title/description and the
 * indexable switch have no column yet; they are editable here and will persist
 * once the backend adds them — the editor does not pretend they saved.
 */
export default function StoreSeoSection() {
  const { isRTL } = useLanguage();
  const t = isRTL;

  const [fields, setFields] = useState<SeoFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await seoService.getStoreSeo();
    if (!isOk(result)) { setError(result.error.message); setLoading(false); return; }
    setFields(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!fields) return;
    setSaving(true);
    const result = await seoService.saveStoreSeo(fields);
    setSaving(false);
    if (!isOk(result)) { toast.error(result.error.message); return; }
    toast.success(t ? 'تم حفظ إعدادات محركات البحث' : 'SEO settings saved');
  };

  return (
    <>
      {loading ? <LoadingState />
        : error ? <ErrorState message={error} onRetry={load} />
        : fields ? (
          <div className="max-w-2xl space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">
                  {t ? 'بيانات المتجر في البحث' : 'The store’s search listing'}
                </h2>
              </div>

              <SeoEditor
                value={fields}
                onChange={setFields}
                baseUrl={`${window.location.origin}/store`}
              />
            </div>

            {/* Honest about what persists today and what does not. */}
            <p className="text-xs text-muted-foreground">
              {t
                ? 'يُحفظ حالياً: العنوان والوصف وصورة المشاركة. الرابط الأساسي وعنوان ووصف المشاركة وخيار الفهرسة تُحفظ بعد أن يضيف الخادم أعمدتها.'
                : 'Saved today: title, description and social image. Canonical URL, social title/description and the indexing switch persist once the backend adds their columns.'}
            </p>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t ? 'حفظ' : 'Save'}
              </Button>
            </div>
          </div>
        ) : null}
    </>
  );
}
