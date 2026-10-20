import { useState, useMemo, type ElementType, type PointerEvent, type ReactNode } from "react";
import {
  motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { Loader2, Smartphone, Package } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import type { Device, Accessory } from "@/types/database";

interface ProductGridProps {
  devices: Device[];
  accessories: Accessory[];
  loading: boolean;
  onAddDevice: (device: Device) => void;
  onAddAccessory: (accessory: Accessory) => void;
}

// Product photo shown when /products/<SKU>.jpg exists in public/,
// falling back to the category icon when it doesn't. The photos carry their
// own studio backdrop and floor shadow, so they fill the panel edge to edge.
function ProductImage({ sku, icon: Icon }: { sku: string; icon: ElementType }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Icon className="h-10 w-10 text-slate-400" strokeWidth={1.5} />;
  }
  return (
    <img
      src={`/products/${sku}.jpg`}
      alt=""
      draggable={false}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      onError={() => setFailed(true)}
    />
  );
}

const MAX_TILT = 10; // degrees
const SPRING = { stiffness: 260, damping: 22, mass: 0.6 };

/**
 * A product card with depth: it tilts toward the pointer, the photo floats
 * above the card on its own layer with a shadow on the stage under it, and a
 * soft highlight follows the pointer across the surface.
 *
 * Only a mouse or pen tilts it — on a touch till a tap must add the item, not
 * rock the card — and a reader who asked for reduced motion gets the layered
 * card standing still.
 */
function ProductCard3D({
  onSelect, image, children, index,
}: {
  onSelect: () => void;
  image: ReactNode;
  children: ReactNode;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [MAX_TILT, -MAX_TILT]), SPRING);
  const rotateY = useSpring(useTransform(px, [0, 1], [-MAX_TILT, MAX_TILT]), SPRING);
  const glareX = useTransform(px, v => `${v * 100}%`);
  const glareY = useTransform(py, v => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.35), transparent 55%)`;
  const [hovered, setHovered] = useState(false);

  const track = (e: PointerEvent<HTMLButtonElement>) => {
    if (reduceMotion || e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  };
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
    setHovered(false);
  };

  return (
    <div style={{ perspective: 900 }}>
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 20) * 0.02 }}
        onClick={onSelect}
        onPointerMove={track}
        onPointerEnter={e => e.pointerType !== "touch" && setHovered(true)}
        onPointerLeave={reset}
        whileTap={{ scale: 0.97 }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn(
          "group relative w-full rounded-2xl border border-border bg-card p-3 text-start",
          "shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_20px_-12px_rgba(15,23,42,0.25)]",
          "transition-[box-shadow,border-color] duration-300",
          "hover:border-primary/40 hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_24px_40px_-18px_rgba(240,78,26,0.4)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {/* The photo panel lifts off the card toward the reader */}
        <motion.div
          className="relative mb-3 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-slate-200 shadow-[0_6px_16px_-10px_rgba(15,23,42,0.35)] transition-shadow duration-300 group-hover:shadow-[0_18px_28px_-14px_rgba(15,23,42,0.45)]"
          animate={{ z: hovered && !reduceMotion ? 40 : 14 }}
          transition={SPRING}
        >
          {image}
        </motion.div>

        <div style={{ transform: "translateZ(18px)" }}>{children}</div>

        {!reduceMotion && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: glare }}
          />
        )}
      </motion.button>
    </div>
  );
}

export function ProductGrid({ devices, accessories, loading, onAddDevice, onAddAccessory }: ProductGridProps) {
  const { t, isRTL } = useLanguage();
  const { categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Phones or accessories first, then the shop's own categories within that
  const [kind, setKind] = useState<'all' | 'device' | 'accessory'>('all');

  // Filter products by kind and selected category
  const filteredDevices = useMemo(() => {
    if (kind === 'accessory') return [];
    if (!selectedCategory) return devices;
    return devices.filter(d => d.category === selectedCategory);
  }, [devices, selectedCategory, kind]);

  const filteredAccessories = useMemo(() => {
    if (kind === 'device') return [];
    if (!selectedCategory) return accessories;
    return accessories.filter(a => a.category === selectedCategory);
  }, [accessories, selectedCategory, kind]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasItems = devices.length > 0 || accessories.length > 0;

  if (!hasItems) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <p className="text-muted-foreground font-medium">
          {isRTL ? "لا توجد منتجات متاحة" : "No products available"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {isRTL ? "أضف أجهزة أو إكسسوارات للمخزون أولاً" : "Add devices or accessories to your inventory first"}
        </p>
      </div>
    );
  }

  // The shop's categories that fit the chosen kind
  const activeCategories = categories.filter(
    c => c.is_active && (kind === 'all' || c.type === 'all' || c.type === kind)
  );

  const chip = (active: boolean) => cn(
    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
    active
      ? "bg-primary text-primary-foreground border-primary"
      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
  );

  const kinds: { key: 'all' | 'device' | 'accessory'; label: string; count: number }[] = [
    { key: 'all', label: isRTL ? "الكل" : "All", count: devices.length + accessories.length },
    { key: 'device', label: isRTL ? "الأجهزة" : "Devices", count: devices.length },
    { key: 'accessory', label: isRTL ? "الإكسسوارات" : "Accessories", count: accessories.length },
  ];

  return (
    <div className="flex-1 overflow-y-auto space-y-3">
      {/* Filter: kind, then the shop's own categories */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {kinds.map(k => (
          <button
            key={k.key}
            onClick={() => { setKind(k.key); setSelectedCategory(null); }}
            className={chip(kind === k.key && !selectedCategory)}
          >
            {k.label}
            <span className="ms-1.5 opacity-70">{k.count}</span>
          </button>
        ))}
        {activeCategories.length > 0 && <span className="w-px h-5 bg-border shrink-0" aria-hidden />}
        {activeCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
            className={chip(selectedCategory === cat.name)}
          >
            {isRTL && cat.name_ar ? cat.name_ar : cat.name}
          </button>
        ))}
      </div>

      {filteredDevices.length === 0 && filteredAccessories.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">
          {isRTL ? "لا توجد منتجات في هذا التصنيف" : "Nothing in this category"}
        </p>
      )}

      {/* Devices */}
      {filteredDevices.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            {t.pos.devices} ({filteredDevices.length})
          </h3>
          <div className="pos-grid">
            {filteredDevices.map((device, index) => (
              <ProductCard3D
                key={device.id}
                index={index}
                onSelect={() => onAddDevice(device)}
                image={<ProductImage sku={device.imei} icon={Smartphone} />}
              >
                <p className="font-medium text-foreground text-sm truncate">
                  {device.brand ? `${device.brand} ` : ''}{device.model}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{device.imei}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {Number(device.price).toLocaleString()} ر.س
                  </span>
                  {device.storage && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{device.storage}</span>
                  )}
                </div>
              </ProductCard3D>
            ))}
          </div>
        </div>
      )}

      {/* Accessories */}
      {filteredAccessories.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            {t.pos.accessories} ({filteredAccessories.length})
          </h3>
          <div className="pos-grid">
            {filteredAccessories.map((acc, index) => (
              <ProductCard3D
                key={acc.id}
                index={index}
                onSelect={() => onAddAccessory(acc)}
                image={<ProductImage sku={acc.sku} icon={Package} />}
              >
                <p className="font-medium text-foreground text-sm truncate">{acc.name}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{acc.sku}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {Number(acc.price).toLocaleString()} ر.س
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {isRTL ? `${t.inventory.inStock}: ${acc.quantity}` : `${acc.quantity} in stock`}
                  </span>
                </div>
              </ProductCard3D>
            ))}
          </div>
        </div>
      )}

      {/* No results for filter */}
      {filteredDevices.length === 0 && filteredAccessories.length === 0 && selectedCategory && (
        <div className="text-center py-10">
          <p className="text-muted-foreground text-sm">
            {isRTL ? "لا توجد منتجات في هذا التصنيف" : "No products in this category"}
          </p>
        </div>
      )}
    </div>
  );
}
