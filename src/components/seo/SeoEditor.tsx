import { Globe, Image as ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import type { SeoFields } from '@/services';

/**
 * The SEO fields for a store or a product, with a preview of how the result
 * *could* look in a search listing.
 *
 * The preview is an approximation, and says so. Search engines rewrite titles
 * and descriptions whenever they judge their own wording a better match, so
 * this shows what is being offered to them — not what they will print.
 */

// Google truncates around these widths. They are guidance, not rules, which is
// why going over shows an amber hint rather than an error.
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

interface Props {
  value: SeoFields;
  onChange: (next: SeoFields) => void;
  /** What the slug hangs off, e.g. https://wasel.app/store/my-shop */
  baseUrl?: string;
  /** Falls back into the preview when the SEO title is blank */
  fallbackTitle?: string;
  fallbackDescription?: string;
  disabled?: boolean;
}

export function SeoEditor({
  value, onChange, baseUrl, fallbackTitle, fallbackDescription, disabled,
}: Props) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const set = (patch: Partial<SeoFields>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-title">{t ? 'عنوان SEO' : 'SEO title'}</Label>
          <LengthHint current={(value.title || '').length} limit={TITLE_LIMIT} />
        </div>
        <Input id="seo-title" value={value.title ?? ''} disabled={disabled}
          onChange={e => set({ title: e.target.value || null })}
          placeholder={fallbackTitle} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-description">{t ? 'وصف الصفحة' : 'Meta description'}</Label>
          <LengthHint current={(value.description || '').length} limit={DESCRIPTION_LIMIT} />
        </div>
        <Textarea id="seo-description" rows={3} value={value.description ?? ''} disabled={disabled}
          onChange={e => set({ description: e.target.value || null })}
          placeholder={fallbackDescription} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="seo-slug">{t ? 'الرابط (Slug)' : 'Slug'}</Label>
          <Input id="seo-slug" dir="ltr" value={value.slug ?? ''} disabled={disabled}
            onChange={e => set({ slug: e.target.value || null })} />
        </div>
        <div>
          <Label htmlFor="seo-canonical">{t ? 'الرابط الأساسي (Canonical)' : 'Canonical URL'}</Label>
          <Input id="seo-canonical" dir="ltr" value={value.canonicalUrl ?? ''} disabled={disabled}
            onChange={e => set({ canonicalUrl: e.target.value || null })}
            placeholder={baseUrl && value.slug ? `${baseUrl}/${value.slug}` : undefined} />
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-sm font-medium text-foreground">
          {t ? 'المشاركة على وسائل التواصل' : 'Social sharing'}
        </p>

        <div>
          <Label htmlFor="og-title">{t ? 'عنوان المشاركة' : 'Social title'}</Label>
          <Input id="og-title" value={value.socialTitle ?? ''} disabled={disabled}
            onChange={e => set({ socialTitle: e.target.value || null })}
            placeholder={value.title ?? fallbackTitle} />
        </div>

        <div>
          <Label htmlFor="og-description">{t ? 'وصف المشاركة' : 'Social description'}</Label>
          <Textarea id="og-description" rows={2} value={value.socialDescription ?? ''} disabled={disabled}
            onChange={e => set({ socialDescription: e.target.value || null })}
            placeholder={value.description ?? fallbackDescription} />
        </div>

        <div>
          <Label htmlFor="og-image">{t ? 'صورة المشاركة' : 'Social image'}</Label>
          <div className="flex gap-2">
            <Input id="og-image" dir="ltr" value={value.socialImageUrl ?? ''} disabled={disabled}
              onChange={e => set({ socialImageUrl: e.target.value || null })} />
            {value.socialImageUrl && (
              <img src={value.socialImageUrl} alt=""
                className="w-10 h-10 rounded object-cover border border-border shrink-0" />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="seo-index" className="cursor-pointer">
            {t ? 'السماح بالفهرسة' : 'Allow indexing'}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t
              ? 'عند الإيقاف، تُطلب من محركات البحث عدم فهرسة الصفحة.'
              : 'When off, search engines are asked not to index this page.'}
          </p>
        </div>
        <Switch id="seo-index" checked={value.indexable} disabled={disabled}
          onCheckedChange={v => set({ indexable: v })} />
      </div>

      <SearchPreview
        title={value.title || fallbackTitle || ''}
        description={value.description || fallbackDescription || ''}
        url={value.canonicalUrl || (baseUrl && value.slug ? `${baseUrl}/${value.slug}` : baseUrl || '')}
      />
    </div>
  );
}

function LengthHint({ current, limit }: { current: number; limit: number }) {
  const { isRTL } = useLanguage();
  const over = current > limit;
  const near = !over && current > limit * 0.9;
  return (
    <span className={cn('text-xs tabular-nums',
      over ? 'text-warning' : near ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
      {current} / {limit}
      {over && (isRTL ? ' · قد يُقتطع' : ' · may be truncated')}
    </span>
  );
}

export function SearchPreview({
  title, description, url,
}: { title: string; description: string; url: string }) {
  const { isRTL } = useLanguage();
  const t = isRTL;

  const clip = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {t ? 'شكل تقريبي للنتيجة في البحث' : 'Roughly how the result could look'}
        </p>
      </div>

      <div dir="ltr" className="text-start">
        <p className="text-xs text-[#4d5156] dark:text-muted-foreground truncate">
          {url || 'example.com'}
        </p>
        <p className="text-[#1a0dab] dark:text-primary text-lg leading-snug truncate">
          {clip(title, TITLE_LIMIT) || 'Title'}
        </p>
        <p className="text-sm text-[#4d5156] dark:text-muted-foreground line-clamp-2">
          {clip(description, DESCRIPTION_LIMIT) || 'Description'}
        </p>
      </div>

      {/* Stated plainly rather than implied: this is not a promise. */}
      <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/60">
        {t
          ? 'معاينة تقريبية فقط. محركات البحث قد تعيد صياغة العنوان والوصف، ولا يضمن هذا ظهور الصفحة أو ترتيبها.'
          : 'An approximation only. Search engines may rewrite the title and description, and this guarantees neither indexing nor ranking.'}
      </p>
    </div>
  );
}
