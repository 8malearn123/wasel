import { useEffect, useRef, useState } from 'react';
import { Box, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';

interface Props {
  /** Public URL of the .glb / .gltf model */
  src: string;
  /** Shown while the model loads, and as the poster behind it */
  posterUrl?: string | null;
  alt?: string;
  className?: string;
}

/**
 * A rotatable, zoomable 3D view of one product.
 *
 * model-viewer bundles three.js and is around 300 KB gzipped — far too much to
 * put in the main bundle for the sake of the few products that have a model. It
 * is therefore imported dynamically, on mount, so a visitor browsing ordinary
 * products never downloads it. The component is only ever rendered when a
 * product actually has a model_3d row.
 *
 * GLB is the format: it is what model-viewer reads, it packs geometry and
 * textures into one binary file, and it is already in the product_media
 * media_type CHECK.
 */
export function Product3DViewer({ src, posterUrl, alt, className }: Props) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const viewerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The custom element registers itself on import; a second import is a
    // no-op, so navigating between 3D products does not reload it.
    import('@google/model-viewer')
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch(error => {
        console.warn('[3d] model-viewer failed to load:', error);
        if (!cancelled) setStatus('failed');
      });

    return () => { cancelled = true; };
  }, []);

  // The product image is a complete fallback: a visitor on a browser that
  // cannot run WebGL still sees the product.
  if (status === 'failed') {
    return posterUrl ? (
      <img src={posterUrl} alt={alt || ''} className={cn('w-full h-full object-contain', className)} />
    ) : (
      <div className={cn('flex flex-col items-center justify-center text-muted-foreground gap-2', className)}>
        <Box className="w-10 h-10 opacity-40" />
        <p className="text-sm">{t ? 'تعذّر عرض النموذج ثلاثي الأبعاد' : 'The 3D view could not load'}</p>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className={cn('relative flex items-center justify-center bg-muted/30', className)}>
        {posterUrl && (
          <img src={posterUrl} alt={alt || ''} className="w-full h-full object-contain opacity-40" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">
            {t ? 'جارٍ تحميل النموذج ثلاثي الأبعاد…' : 'Loading the 3D model…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <model-viewer
        ref={viewerRef}
        src={src}
        poster={posterUrl || undefined}
        alt={alt || ''}
        camera-controls
        touch-action="pan-y"
        auto-rotate
        auto-rotate-delay="2500"
        shadow-intensity="0.6"
        exposure="1"
        loading="lazy"
        reveal="auto"
        style={{ width: '100%', height: '100%', backgroundColor: 'transparent', '--poster-color': 'transparent' } as React.CSSProperties}
      />

      <button
        type="button"
        onClick={() => {
          // resetTurntableRotation is part of the element's own API
          const viewer = viewerRef.current as unknown as { resetTurntableRotation?: () => void } | null;
          viewer?.resetTurntableRotation?.();
        }}
        className="absolute bottom-2 end-2 p-2 rounded-lg bg-background/80 border border-border hover:bg-background transition-colors"
        title={t ? 'إعادة الضبط' : 'Reset view'}
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      <p className="absolute bottom-2 start-2 text-[11px] text-muted-foreground bg-background/80 px-2 py-1 rounded">
        {t ? 'اسحب للتدوير · قرّب للتكبير' : 'Drag to rotate · pinch to zoom'}
      </p>
    </div>
  );
}
