import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductThumbProps {
  /** SKU for accessories or IMEI for devices — the photo lives at /products/<code>.jpg */
  code: string;
  fallback: React.ReactNode;
  className?: string;
}

export function ProductThumb({ code, fallback, className }: ProductThumbProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={`/products/${code}.jpg`}
      alt=""
      onError={() => setFailed(true)}
      className={cn("rounded-lg object-cover bg-muted/30 shrink-0", className || "w-10 h-10")}
    />
  );
}
