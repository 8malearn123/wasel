import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { Loader2 } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import type { Device, Accessory } from "@/types/database";

interface ProductGridProps {
  devices: Device[];
  accessories: Accessory[];
  loading: boolean;
  onAddDevice: (device: Device) => void;
  onAddAccessory: (accessory: Accessory) => void;
}

export function ProductGrid({ devices, accessories, loading, onAddDevice, onAddAccessory }: ProductGridProps) {
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
            {filteredDevices.map((device, index) => (
              <motion.button
                key={device.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => onAddDevice(device)}
                className="p-4 rounded-xl border text-start transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] bg-primary/5 border-primary/20 hover:border-primary/40"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-primary/10">
                  <span className="text-lg">📱</span>
                </div>
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
              </motion.button>
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
              <motion.button
                key={acc.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => onAddAccessory(acc)}
                className="p-4 rounded-xl border text-start transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] bg-accent/5 border-accent/20 hover:border-accent/40"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-accent/10">
                  <span className="text-lg">🎧</span>
                </div>
                <p className="font-medium text-foreground text-sm truncate">{acc.name}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{acc.sku}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-lg font-bold text-foreground">
                    {Number(acc.price).toLocaleString()} ر.س
                  </span>
                  <span className="text-xs text-muted-foreground">{acc.quantity} in stock</span>
                </div>
              </motion.button>
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
