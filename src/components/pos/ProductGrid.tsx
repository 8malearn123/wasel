import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { Loader2, Smartphone, Package, Plus, Minus } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import type { Device, Accessory } from "@/types/database";

interface ProductGridProps {
  devices: Device[];
  accessories: Accessory[];
  loading: boolean;
  onAddDevice: (device: Device) => void;
  onAddAccessory: (accessory: Accessory) => void;
  onRemoveDevice: (device: Device) => void;
  onRemoveAccessory: (accessory: Accessory) => void;
  /** How many of each device is already in the cart, keyed by device id */
  deviceQuantities: Record<string, number>;
  /** How many of each accessory is already in the cart, keyed by accessory id */
  accessoryQuantities: Record<string, number>;
}

// Product photo shown when /products/<SKU>.jpg exists in public/,
// falling back to the category icon when it doesn't
function ProductImage({ sku, icon: Icon, tint }: { sku: string; icon: any; tint: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", tint)}>
        <Icon className="w-5 h-5 opacity-60" />
      </div>
    );
  }
  return (
    <img
      src={`/products/${sku}.jpg`}
      alt=""
      className="w-14 h-14 rounded-lg object-cover mb-3 bg-muted/30"
      onError={() => setFailed(true)}
    />
  );
}

// "-" / "+" controls on every product card, so the cashier can raise or lower
// how many of the product go in the cart without leaving the grid
function QuantityStepper({
  tone,
  quantity,
  canIncrease,
  onIncrease,
  onDecrease,
}: {
  tone: "primary" | "accent";
  quantity: number;
  canIncrease: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const { isRTL } = useLanguage();
  const accent = tone === "primary" ? "text-primary" : "text-accent";

  const buttonClass = (enabled: boolean) =>
    cn(
      "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
      enabled
        ? cn(accent, "hover:bg-muted")
        : "text-muted-foreground/40 cursor-not-allowed"
    );

  return (
    <div className="absolute top-2 end-2 flex items-center gap-0.5 rounded-full border border-border bg-background/90 p-0.5 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        disabled={quantity === 0}
        onClick={onDecrease}
        aria-label={isRTL ? "إنقاص الكمية" : "Decrease quantity"}
        className={buttonClass(quantity > 0)}
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
      {quantity > 0 && (
        <span className={cn("min-w-[1rem] text-center text-xs font-bold tabular-nums", accent)}>
          {quantity}
        </span>
      )}
      <button
        type="button"
        disabled={!canIncrease}
        onClick={onIncrease}
        aria-label={isRTL ? "زيادة الكمية" : "Increase quantity"}
        className={buttonClass(canIncrease)}
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
    </div>
  );
}

export function ProductGrid({
  devices,
  accessories,
  loading,
  onAddDevice,
  onAddAccessory,
  onRemoveDevice,
  onRemoveAccessory,
  deviceQuantities,
  accessoryQuantities,
}: ProductGridProps) {
  const { t, isRTL } = useLanguage();
  const { categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter products by selected category
  const filteredDevices = useMemo(() => {
    if (!selectedCategory) return devices;
    return devices.filter(d => d.category === selectedCategory);
  }, [devices, selectedCategory]);

  const filteredAccessories = useMemo(() => {
    if (!selectedCategory) return accessories;
    return accessories.filter(a => a.category === selectedCategory);
  }, [accessories, selectedCategory]);

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

  // Build category tabs from merchant categories
  const activeCategories = categories.filter(c => c.is_active);

  return (
    <div className="flex-1 overflow-y-auto space-y-3">
      {/* Category Filter Tabs */}
      {activeCategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
              !selectedCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {isRTL ? "الكل" : "All"}
          </button>
          {activeCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                selectedCategory === cat.name
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              {isRTL && cat.name_ar ? cat.name_ar : cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Devices */}
      {filteredDevices.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            {t.pos.devices} ({filteredDevices.length})
          </h3>
          <div className="pos-grid">
            {filteredDevices.map((device, index) => {
              const inCart = deviceQuantities[device.id] ?? 0;
              return (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => onAddDevice(device)}
                    className="w-full p-4 rounded-xl border text-start transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] bg-primary/5 border-primary/20 hover:border-primary/40"
                  >
                    <ProductImage sku={device.imei} icon={Smartphone} tint="bg-primary/10" />
                    <p className="font-medium text-foreground text-sm truncate">
                      {device.brand ? `${device.brand} ` : ''}{device.model}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{device.imei}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-lg font-bold text-foreground">
                        {Number(device.price).toLocaleString()} ر.س
                      </span>
                      {device.storage && (
                        <span className="text-xs text-muted-foreground">{device.storage}</span>
                      )}
                    </div>
                  </button>
                  {/* Devices carry no stock count of their own, so the cashier sets the quantity */}
                  <QuantityStepper
                    tone="primary"
                    quantity={inCart}
                    canIncrease
                    onIncrease={() => onAddDevice(device)}
                    onDecrease={() => onRemoveDevice(device)}
                  />
                </motion.div>
              );
            })}
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
            {filteredAccessories.map((acc, index) => {
              const inCart = accessoryQuantities[acc.id] ?? 0;
              return (
                <motion.div
                  key={acc.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => onAddAccessory(acc)}
                    className="w-full p-4 rounded-xl border text-start transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] bg-accent/5 border-accent/20 hover:border-accent/40"
                  >
                    <ProductImage sku={acc.sku} icon={Package} tint="bg-accent/10" />
                    <p className="font-medium text-foreground text-sm truncate">{acc.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{acc.sku}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-lg font-bold text-foreground">
                        {Number(acc.price).toLocaleString()} ر.س
                      </span>
                      <span className="text-xs text-muted-foreground">{acc.quantity} in stock</span>
                    </div>
                  </button>
                  {/* Can't put more in the cart than the branch actually holds */}
                  <QuantityStepper
                    tone="accent"
                    quantity={inCart}
                    canIncrease={inCart < acc.quantity}
                    onIncrease={() => onAddAccessory(acc)}
                    onDecrease={() => onRemoveAccessory(acc)}
                  />
                </motion.div>
              );
            })}
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
