import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, Loader2, Star, Trash2, ChevronLeft, ChevronRight, ImageOff, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import { usePermissions } from '@/hooks/usePermissions';
import { useProductMedia, type ProductItemType } from '@/hooks/useProductMedia';

interface Props {
  itemType: ProductItemType;
  /** Null while the product is still being created — uploads wait for an id */
  itemId?: string | null;
}

/**
 * Photos of one product: add, reorder, pick the cover, remove.
 *
 * Every control is hidden without the matching permission and refused by RLS
 * without it, so a cashier sees the photos and no buttons.
 */
export function ProductMediaManager({ itemType, itemId }: Props) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const { can } = usePermissions();
  const { images: media, model3d, loading, uploading, upload, uploadModel, remove, setPrimary, reorder } =
    useProductMedia(itemType, itemId);
  const inputRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const mayUpload = can('products.media.upload');
  const mayDelete = can('products.media.delete');

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await upload(file);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const move = (index: number, delta: number) => {
    const next = [...media];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder(next.map(m => m.id));
  };

  if (!itemId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t ? 'احفظ المنتج أولاً ثم أضف صوره' : 'Save the product first, then add its photos'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{t ? 'صور المنتج' : 'Product photos'}</Label>
        {media.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {t ? `${media.length} صورة` : `${media.length} photo${media.length === 1 ? '' : 's'}`}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : media.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <ImageOff className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {t ? 'لا توجد صور لهذا المنتج' : 'No photos yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <AnimatePresence>
            {media.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  'relative group rounded-lg overflow-hidden border bg-muted/30 aspect-square',
                  item.is_primary ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                )}
              >
                <img
                  src={item.public_url}
                  alt={item.alt_text || ''}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />

                {item.is_primary && (
                  <span className="absolute top-1 start-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                    {t ? 'الأساسية' : 'Cover'}
                  </span>
                )}

                {(mayUpload || mayDelete) && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 p-1 bg-background/85 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {mayUpload && (
                      <>
                        <button
                          type="button"
                          title={t ? 'للخلف' : 'Move back'}
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30"
                        >
                          {isRTL ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          title={t ? 'اجعلها الأساسية' : 'Make cover'}
                          onClick={() => setPrimary(item.id)}
                          disabled={item.is_primary}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30"
                        >
                          <Star className={cn('w-3.5 h-3.5', item.is_primary && 'fill-primary text-primary')} />
                        </button>
                        <button
                          type="button"
                          title={t ? 'للأمام' : 'Move forward'}
                          onClick={() => move(index, 1)}
                          disabled={index === media.length - 1}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30"
                        >
                          {isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                    {mayDelete && (
                      <button
                        type="button"
                        title={t ? 'حذف' : 'Delete'}
                        onClick={() => setConfirming(item.id)}
                        className="p-1 rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                )}

                {confirming === item.id && (
                  <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                    <p className="text-xs">{t ? 'حذف الصورة؟' : 'Delete this photo?'}</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                        onClick={() => { remove(item); setConfirming(null); }}>
                        {t ? 'حذف' : 'Delete'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                        onClick={() => setConfirming(null)}>
                        {t ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {mayUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            hidden
            onChange={e => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" />{t ? 'جارٍ الرفع…' : 'Uploading…'}</>
              : <><ImagePlus className="w-4 h-4" />{t ? 'إضافة صور' : 'Add photos'}</>}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {t
              ? 'JPG أو PNG أو WebP، حتى 10 ميجابايت. تُصغَّر الصورة تلقائياً قبل الرفع.'
              : 'JPG, PNG or WebP up to 10 MB. Images are downscaled before upload.'}
          </p>
        </>
      )}

      {/* 3D — optional. A product without a model behaves exactly as before,
          and the viewer's bundle is never downloaded for it. */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Box className="w-4 h-4" />
            {t ? 'نموذج ثلاثي الأبعاد' : '3D model'}
          </Label>
          {model3d && (
            <span className="text-xs text-success">{t ? 'مرفوع' : 'Uploaded'}</span>
          )}
        </div>

        {model3d ? (
          <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
            <Box className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm flex-1 truncate" dir="ltr">
              {model3d.storage_path.split('/').pop()}
            </span>
            {model3d.bytes && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {(model3d.bytes / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
            {mayDelete && (
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(model3d)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t
              ? 'اختياري — يظهر في صفحة المنتج بإمكانية التدوير والتكبير.'
              : 'Optional — shown on the product page, rotatable and zoomable.'}
          </p>
        )}

        {mayUpload && (
          <>
            <input
              ref={modelRef}
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              hidden
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) await uploadModel(file);
                if (modelRef.current) modelRef.current.value = '';
              }}
            />
            <Button type="button" variant="outline" size="sm" className="w-full gap-2"
              disabled={uploading} onClick={() => modelRef.current?.click()}>
              <Box className="w-4 h-4" />
              {model3d
                ? (t ? 'استبدال النموذج' : 'Replace the model')
                : (t ? 'رفع نموذج GLB' : 'Upload a GLB model')}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {t ? 'GLB أو glTF، حتى 10 ميجابايت.' : 'GLB or glTF, up to 10 MB.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
