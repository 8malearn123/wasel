import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductThumbProps {
  /** SKU for accessories or IMEI for devices — the legacy photo at /products/<code>.jpg */
  code: string;
  fallback: React.ReactNode;
  className?: string;
  /** The product's cover image from product_media, when it has one */
  url?: string | null;
  alt?: string;
}

/**
 * A product's photo.
 *
 * Products now carry uploaded media, but photos committed under
 * public/products/<IMEI>.jpg predate that table and are still the only picture
 * many items have — so the uploaded cover wins, the file is the fallback, and
 * the caller's placeholder is the last resort.
 */
export function ProductThumb({ code, fallback, className, url, alt }: ProductThumbProps) {
  const [stage, setStage] = useState<0 | 1 | 2>(url ? 0 : 1);

  if (stage === 2) return <>{fallback}</>;

  const src = stage === 0 ? (url as string) : `/products/${code}.jpg`;

  return (
    <img
      src={src}
      alt={alt || ""}
      loading="lazy"
      onError={() => setStage(s => (s === 0 ? 1 : 2))}
      className={cn("rounded-lg object-cover bg-muted/30 shrink-0", className || "w-10 h-10")}
    />
  );
}
