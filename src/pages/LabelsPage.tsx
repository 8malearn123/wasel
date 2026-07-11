import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/i18n";
import { useDevices, useAccessories } from "@/hooks/useInventory";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from '@/hooks/useTabParam';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, Barcode, Settings2, Package, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import JsBarcode from "jsbarcode";

type LabelSize = "small" | "medium" | "large";

interface LabelItem {
  id: string;
  type: "device" | "accessory";
  name: string;
  code: string; // IMEI or SKU
  brand?: string;
  price: number;
  model?: string;
  color?: string;
  storage?: string;
}

function BarcodeCanvas({ value, width, height }: { value: string; width: number; height: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: 1.5,
          height,
          displayValue: true,
          fontSize: 12,
          margin: 4,
          textMargin: 2,
        });
      } catch {
        // fallback for invalid barcode
      }
    }
  }, [value, width, height]);

  return <svg ref={svgRef} />;
}

function LabelCard({
  item,
  size,
  showPrice,
  showBrand,
  isSelected,
  onToggle,
  isRTL,
}: {
  item: LabelItem;
  size: LabelSize;
  showPrice: boolean;
  showBrand: boolean;
  isSelected: boolean;
  onToggle: () => void;
  isRTL: boolean;
}) {
  const sizeConfig = {
    small: { w: "w-48", h: 30, barW: 140 },
    medium: { w: "w-64", h: 40, barW: 200 },
    large: { w: "w-80", h: 50, barW: 260 },
  };

  const cfg = sizeConfig[size];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${cfg.w} border border-border rounded-lg bg-card p-3 relative cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm"
      }`}
      onClick={onToggle}
    >
      <div className={`absolute top-2 ${isRTL ? "left-2" : "right-2"}`}>
        <Checkbox checked={isSelected} onCheckedChange={onToggle} />
      </div>

      <div className="flex flex-col items-center gap-1 print-label">
        <p className="text-xs font-semibold text-foreground truncate max-w-full">
          {item.name}
        </p>
        {showBrand && item.brand && (
          <p className="text-[10px] text-muted-foreground">{item.brand}</p>
        )}
        <BarcodeCanvas value={item.code} width={cfg.barW} height={cfg.h} />
        {showPrice && (
          <Badge variant="secondary" className="text-[10px]">
            {item.price.toFixed(2)} SAR
          </Badge>
        )}
      </div>
    </motion.div>
  );
}

export default function LabelsPage() {
  const { t, isRTL } = useLanguage();
  const { devices, loading: devicesLoading } = useDevices();
  const { accessories, loading: accessoriesLoading } = useAccessories();

  const [tab, setTab] = useTabParam("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [labelSize, setLabelSize] = useState<LabelSize>("medium");
  const [showPrice, setShowPrice] = useState(true);
  const [showBrand, setShowBrand] = useState(true);

  const loading = devicesLoading || accessoriesLoading;

  const allItems: LabelItem[] = [
    ...devices.map((d) => ({
      id: d.id,
      type: "device" as const,
      name: d.model,
      code: d.imei,
      brand: d.brand || undefined,
      price: Number(d.price),
      model: d.model,
      color: d.color || undefined,
      storage: d.storage || undefined,
    })),
    ...accessories.map((a) => ({
      id: a.id,
      type: "accessory" as const,
      name: a.name,
      code: a.sku,
      brand: a.brand || undefined,
      price: Number(a.price),
    })),
  ];

  const filteredItems = allItems.filter((item) => {
    const matchesTab =
      tab === "all" ||
      (tab === "devices" && item.type === "device") ||
      (tab === "accessories" && item.type === "accessory");

    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.brand && item.brand.toLowerCase().includes(q));

    return matchesTab && matchesSearch;
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => setSelectedIds(new Set(filteredItems.map((i) => i.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handlePrint = (items: LabelItem[]) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const labelsHtml = items
      .map((item) => {
        const canvas = document.createElement("canvas");
        try {
          JsBarcode(canvas, item.code, {
            format: "CODE128",
            width: 2,
            height: labelSize === "small" ? 30 : labelSize === "medium" ? 40 : 50,
            displayValue: true,
            fontSize: 10,
            margin: 2,
          });
        } catch {
          return "";
        }
        const barcodeDataUrl = canvas.toDataURL("image/png");

        return `
          <div class="label">
            <p class="name">${item.name}</p>
            ${showBrand && item.brand ? `<p class="brand">${item.brand}</p>` : ""}
            <img src="${barcodeDataUrl}" />
            ${showPrice ? `<p class="price">${item.price.toFixed(2)} SAR</p>` : ""}
          </div>
        `;
      })
      .join("");

    printWindow.document.write(`
      <html><head><title>Print Labels</title>
      <style>
        body { margin: 0; padding: 10px; }
        .label { display: inline-block; border: 1px dashed #ccc; padding: 8px; margin: 4px; text-align: center; page-break-inside: avoid; }
        .name { font-size: 11px; font-weight: bold; margin: 0 0 2px; }
        .brand { font-size: 9px; color: #666; margin: 0 0 2px; }
        .price { font-size: 10px; margin: 2px 0 0; background: #f0f0f0; padding: 1px 6px; border-radius: 4px; display: inline-block; }
        img { max-width: 100%; }
        @media print { .label { border: 1px dashed #ccc; } }
      </style></head><body>${labelsHtml}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const selectedItems = filteredItems.filter((i) => selectedIds.has(i.id));

  return (
    <AppLayout title={t.labels.title} subtitle={t.labels.subtitle}>
      <div className="space-y-4">
        {/* Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
                <Input
                  placeholder={t.labels.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={isRTL ? "pr-9" : "pl-9"}
                />
              </div>

              {/* Label Size */}
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">{t.labels.small}</SelectItem>
                    <SelectItem value="medium">{t.labels.medium}</SelectItem>
                    <SelectItem value="large">{t.labels.large}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={showPrice} onCheckedChange={setShowPrice} id="show-price" />
                  <Label htmlFor="show-price" className="text-sm">{t.labels.showPrice}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={showBrand} onCheckedChange={setShowBrand} id="show-brand" />
                  <Label htmlFor="show-brand" className="text-sm">{t.labels.showBrand}</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={setTab}>
          </Tabs>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Badge variant="outline">
                {selectedIds.size} {t.labels.itemsSelected}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={selectedIds.size > 0 ? deselectAll : selectAll}>
              {selectedIds.size > 0 ? t.labels.deselectAll : t.labels.selectAll}
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => handlePrint(selectedItems)}
              className="gap-1"
            >
              <Printer className="w-4 h-4" />
              {t.labels.printSelected}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filteredItems.length === 0}
              onClick={() => handlePrint(filteredItems)}
              className="gap-1"
            >
              <Printer className="w-4 h-4" />
              {t.labels.printAll}
            </Button>
          </div>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Barcode className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t.labels.noItems}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {filteredItems.map((item) => (
              <LabelCard
                key={item.id}
                item={item}
                size={labelSize}
                showPrice={showPrice}
                showBrand={showBrand}
                isSelected={selectedIds.has(item.id)}
                onToggle={() => toggleSelect(item.id)}
                isRTL={isRTL}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
