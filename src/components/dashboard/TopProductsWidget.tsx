import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Smartphone, Package, TrendingUp } from "lucide-react";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TopProduct {
  id: string;
  name: string;
  type: "device" | "accessory";
  soldCount: number;
  revenue: number;
}

export function TopProductsWidget() {
  const { isRTL } = useLanguage();
  const { merchant } = useAuth();
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTopProducts = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);

    // Get sale_items with device/accessory data
    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('device_id, accessory_id, unit_price, quantity, sale:sales!inner(merchant_id)')
      .eq('sale.merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!saleItems) {
      setLoading(false);
      return;
    }

    // Aggregate by accessory
    const accMap = new Map<string, { count: number; revenue: number }>();
    for (const item of saleItems) {
      if (item.accessory_id) {
        const existing = accMap.get(item.accessory_id) || { count: 0, revenue: 0 };
        existing.count += item.quantity;
        existing.revenue += item.quantity * Number(item.unit_price);
        accMap.set(item.accessory_id, existing);
      }
    }

    // Get top accessory names
    const topAccIds = [...accMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id]) => id);

    const result: TopProduct[] = [];

    if (topAccIds.length > 0) {
      const { data: accs } = await supabase
        .from('accessories')
        .select('id, name')
        .in('id', topAccIds);

      for (const acc of accs || []) {
        const stats = accMap.get(acc.id);
        if (stats) {
          result.push({
            id: acc.id,
            name: acc.name,
            type: 'accessory',
            soldCount: stats.count,
            revenue: stats.revenue,
          });
        }
      }
    }

    // Count device sales (each device is unique)
    const deviceCount = saleItems.filter(i => i.device_id).length;
    const deviceRevenue = saleItems.filter(i => i.device_id).reduce((s, i) => s + Number(i.unit_price), 0);
    if (deviceCount > 0) {
      result.unshift({
        id: 'devices-total',
        name: isRTL ? 'أجهزة (إجمالي)' : 'Devices (Total)',
        type: 'device',
        soldCount: deviceCount,
        revenue: deviceRevenue,
      });
    }

    setProducts(result.sort((a, b) => b.soldCount - a.soldCount).slice(0, 5));
    setLoading(false);
  }, [merchant, isRTL]);

  useEffect(() => {
    fetchTopProducts();
  }, [fetchTopProducts]);

  const maxCount = Math.max(...products.map(p => p.soldCount), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="bg-card rounded-xl border border-border shadow-md overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{isRTL ? "الأكثر مبيعاً" : "Top Sellers"}</h3>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">
            {isRTL ? "لا توجد بيانات" : "No data"}
          </p>
        ) : (
          products.map((product, index) => (
            <div key={product.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {product.type === 'device' ? (
                    <Smartphone className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Package className="w-3.5 h-3.5 text-accent" />
                  )}
                  <span className="font-medium text-foreground truncate max-w-[120px]">{product.name}</span>
                </div>
                <span className="text-muted-foreground text-xs">{product.soldCount} {isRTL ? "مبيعات" : "sold"}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(product.soldCount / maxCount) * 100}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="h-1.5 rounded-full bg-gradient-to-r from-primary to-accent"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
