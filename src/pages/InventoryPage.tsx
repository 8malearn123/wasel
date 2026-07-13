import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { 
  Search, 
  Filter, 
  Plus, 
  Download, 
  Smartphone,
  Package,
  MoreHorizontal,
  Eye,
  Edit,
  ArrowRightLeft,
  Tag,
  Trash2,
  Loader2,
  X,
  Wrench,
  FolderOpen,
  Heart
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/useTabParam";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useDevices, useAccessories } from "@/hooks/useInventory";
import { useRepairParts, RepairPart } from "@/hooks/useRepairParts";
import { useCategories } from "@/hooks/useCategories";
import { CategoryManager } from "@/components/inventory/CategoryManager";
import { ProductThumb } from "@/components/common/ProductThumb";
import { useAuth } from "@/hooks/useAuth";
import type { Device, Accessory, DeviceStatus } from "@/types/database";

export default function InventoryPage() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [activeTab, setActiveTab] = useTabParam("devices");

  // Sync when a global-search result is opened while already on this page
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearchTerm(q);
  }, [searchParams]);

  // Open the product dialog requested by a global-search result (?open=<id>)
  const openedProductRef = useRef<string | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAddAccessory, setShowAddAccessory] = useState(false);
  const [showAddRepairPart, setShowAddRepairPart] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null);
  const [editingRepairPart, setEditingRepairPart] = useState<RepairPart | null>(null);
  const { t, isRTL } = useLanguage();
  const { branches, currentBranch } = useAuth();
  
  const { devices, loading: devicesLoading, addDevice, updateDevice, deleteDevice } = useDevices();
  const { accessories, loading: accessoriesLoading, addAccessory, updateAccessory, deleteAccessory } = useAccessories();

  // "وصل حديثاً" = added within the last 7 days
  const NEW_WINDOW_MS = 7 * 24 * 3600 * 1000;
  const isNewProduct = (createdAt?: string) =>
    !!createdAt && Date.now() - new Date(createdAt).getTime() < NEW_WINDOW_MS;

  // "الأكثر مبيعاً" for devices: top 3 models by sold units
  const topDeviceModels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of devices) {
      if (d.status !== 'sold') continue;
      const key = `${d.brand || ''}|${d.model}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return new Set([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k));
  }, [devices]);

  // "الأكثر مبيعاً" for accessories: top 3 by units sold
  const [topAccessoryIds, setTopAccessoryIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('sale_items')
        .select('accessory_id, quantity')
        .not('accessory_id', 'is', null)
        .limit(2000);
      if (!data) return;
      const counts = new Map<string, number>();
      for (const row of data) {
        if (!row.accessory_id) continue;
        counts.set(row.accessory_id, (counts.get(row.accessory_id) || 0) + (row.quantity || 1));
      }
      setTopAccessoryIds(new Set([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)));
    })();
  }, []);

  const NewBadge = () => (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success/15 text-success whitespace-nowrap">
      {isRTL ? "وصل حديثاً" : "New Arrival"}
    </span>
  );
  const BestSellerBadge = () => (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning whitespace-nowrap">
      {isRTL ? "الأكثر مبيعاً 🔥" : "Best Seller 🔥"}
    </span>
  );
  const { parts: repairParts, loading: partsLoading, addPart, updatePart, deletePart } = useRepairParts();
  const { deviceCategories, accessoryCategories } = useCategories();

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || openedProductRef.current === openId) return;
    const dev = devices.find((d) => d.id === openId);
    if (dev) {
      setEditingDevice(dev);
      openedProductRef.current = openId;
      return;
    }
    const acc = accessories.find((a) => a.id === openId);
    if (acc) {
      setEditingAccessory(acc);
      openedProductRef.current = openId;
    }
  }, [searchParams, devices, accessories]);

  // Favorites (saved on this device)
  const [favIds, setFavIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("inventory-favs") || "[]"); } catch { return []; }
  });
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const toggleFav = (id: string) => {
    setFavIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem("inventory-favs", JSON.stringify(next)); } catch { /* ignore */ }
      window.dispatchEvent(new Event("inventory-favs-changed"));
      return next;
    });
  };

  // Turn the favorites filter on when opened from the header (?fav=1 / event)
  useEffect(() => {
    if (searchParams.get("fav") === "1") setShowFavsOnly(true);
  }, [searchParams]);
  useEffect(() => {
    const show = () => setShowFavsOnly(true);
    window.addEventListener("show-inventory-favs", show);
    return () => window.removeEventListener("show-inventory-favs", show);
  }, []);
  const FavButton = ({ id }: { id: string }) => {
    const fav = favIds.includes(id);
    return (
      <Button
        variant="ghost" size="icon"
        title={fav ? (isRTL ? "إزالة من المفضلة" : "Remove from favorites") : (isRTL ? "إضافة للمفضلة" : "Add to favorites")}
        onClick={() => toggleFav(id)}
      >
        <Heart className={cn("w-4 h-4", fav ? "text-red-500 fill-red-500" : "text-muted-foreground")} />
      </Button>
    );
  };

  // Filter by search
  const filteredDevices = devices.filter(d =>
    (d.imei.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.brand?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!showFavsOnly || favIds.includes(d.id))
  );

  const filteredAccessories = accessories.filter(a =>
    (a.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!showFavsOnly || favIds.includes(a.id))
  );

  const filteredRepairParts = repairParts.filter(p =>
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deviceStats = {
    total: devices.length,
    available: devices.filter(d => d.status === "available").length,
    reserved: devices.filter(d => d.status === "reserved").length,
    totalValue: devices.filter(d => d.status !== "sold").reduce((sum, d) => sum + Number(d.price), 0),
  };

  const accessoryStats = {
    total: accessories.reduce((sum, a) => sum + a.quantity, 0),
    skus: accessories.length,
    lowStock: accessories.filter(a => a.quantity <= a.min_quantity).length,
    totalValue: accessories.reduce((sum, a) => sum + Number(a.price) * a.quantity, 0),
  };

  return (
    <AppLayout title={t.inventory.title} subtitle={t.inventory.subtitle}>
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{deviceStats.total}</p>
              <p className="text-sm text-muted-foreground">{t.inventory.devices}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{accessoryStats.total}</p>
              <p className="text-sm text-muted-foreground">{t.inventory.accessories} ({accessoryStats.skus} SKUs)</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{accessoryStats.lowStock}</p>
              <p className="text-sm text-muted-foreground">{t.inventory.lowStock}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <span className="text-accent font-bold">ر.س</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {(deviceStats.totalValue + accessoryStats.totalValue).toLocaleString()} ر.س
              </p>
              <p className="text-sm text-muted-foreground">{t.inventory.totalValue}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border border-border shadow-md overflow-hidden"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-end gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
                  isRTL ? "right-3" : "left-3"
                )} />
                <Input
                  placeholder={activeTab === "devices" ? t.inventory.searchDevices : t.inventory.searchAccessories}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn("w-64", isRTL ? "pr-9" : "pl-9")}
                />
              </div>
              <Button
                variant={showFavsOnly ? "default" : "outline"}
                className={cn("gap-2", showFavsOnly && "bg-red-500 hover:bg-red-600 text-white")}
                onClick={() => setShowFavsOnly(v => !v)}
              >
                <Heart className={cn("w-4 h-4", showFavsOnly && "fill-white")} />
                {isRTL ? "المفضلة" : "Favorites"}
                {favIds.length > 0 && <span className="text-xs">({favIds.length})</span>}
              </Button>
              <Button
                className="gap-2 bg-gradient-primary hover:opacity-90"
                onClick={() => {
                  if (activeTab === "devices") setShowAddDevice(true);
                  else if (activeTab === "accessories") setShowAddAccessory(true);
                  else setShowAddRepairPart(true);
                }}
              >
                <Plus className="w-4 h-4" />
                {activeTab === "devices" ? t.inventory.addDevice : activeTab === "accessories" ? t.inventory.addAccessory : t.inventory.addRepairPart}
              </Button>
            </div>
          </div>

          {/* Devices Tab */}
          <TabsContent value="devices" className="m-0">
            {devicesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="text-center py-20">
                <Smartphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t.inventory.noDevicesFound}</p>
                <Button 
                  className="mt-4"
                  onClick={() => setShowAddDevice(true)}
                >
                  {t.inventory.addFirstDevice}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.model}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.imei}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.status}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.location}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.cost}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.price}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-left" : "text-right")}>{t.inventory.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredDevices.map((device, index) => (
                      <motion.tr
                        key={device.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-muted/20"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <ProductThumb
                              code={device.imei}
                              className="w-10 h-10"
                              fallback={
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Smartphone className="w-5 h-5 text-primary" />
                                </div>
                              }
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-foreground">{device.model}</p>
                                {topDeviceModels.has(`${device.brand || ''}|${device.model}`) && <BestSellerBadge />}
                                {isNewProduct(device.created_at) && <NewBadge />}
                              </div>
                              <p className="text-sm text-muted-foreground">{device.storage} · {device.color}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{device.imei}</code>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={device.status} />
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{device.branch?.name || t.inventory.unassigned}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{Number(device.cost).toLocaleString()} ر.س</td>
                        <td className="px-6 py-4 font-semibold text-foreground">{Number(device.price).toLocaleString()} ر.س</td>
                        <td className={cn("px-6 py-4", isRTL ? "text-left" : "text-right")}>
                          <div className="flex items-center gap-0.5 justify-end">
                          <FavButton id={device.id} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingDevice(device)}>
                                <Edit className="w-4 h-4 mr-2" /> {t.inventory.edit}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteDevice(device.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> {t.inventory.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Accessories Tab */}
          <TabsContent value="accessories" className="m-0">
            {accessoriesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredAccessories.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t.inventory.noAccessoriesFound}</p>
                <Button 
                  className="mt-4"
                  onClick={() => setShowAddAccessory(true)}
                >
                  {t.inventory.addFirstAccessory}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.product}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.sku}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.category}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.quantity}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.cost}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.price}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-left" : "text-right")}>{t.inventory.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAccessories.map((accessory, index) => {
                      const isLowStock = accessory.quantity <= accessory.min_quantity;
                      
                      return (
                        <motion.tr
                          key={accessory.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          className="hover:bg-muted/20"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <ProductThumb
                                code={accessory.sku}
                                className="w-10 h-10"
                                fallback={
                                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                                    <Package className="w-5 h-5 text-accent" />
                                  </div>
                                }
                              />
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-foreground">{accessory.name}</p>
                                  {topAccessoryIds.has(accessory.id) && <BestSellerBadge />}
                                  {isNewProduct(accessory.created_at) && <NewBadge />}
                                </div>
                                <p className="text-sm text-muted-foreground">{accessory.branch?.name || t.inventory.all}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{accessory.sku}</code>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{accessory.category || '-'}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "font-medium",
                              isLowStock ? "text-destructive" : "text-foreground"
                            )}>
                              {accessory.quantity}
                              {isLowStock && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive ml-2">{t.inventory.low}</span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{Number(accessory.cost).toLocaleString()} ر.س</td>
                          <td className="px-6 py-4 font-semibold text-foreground">{Number(accessory.price).toLocaleString()} ر.س</td>
                          <td className={cn("px-6 py-4", isRTL ? "text-left" : "text-right")}>
                            <div className="flex items-center gap-0.5 justify-end">
                            <FavButton id={accessory.id} />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingAccessory(accessory)}>
                                  <Edit className="w-4 h-4 mr-2" /> {t.inventory.edit}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteAccessory(accessory.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> {t.inventory.delete}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Repair Parts Tab */}
          <TabsContent value="repair_parts" className="m-0">
            {partsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredRepairParts.length === 0 ? (
              <div className="text-center py-20">
                <Wrench className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t.inventory.noRepairParts}</p>
                <Button className="mt-4" onClick={() => setShowAddRepairPart(true)}>
                  {t.inventory.addFirstPart}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.product}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.sku}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.category}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.quantity}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.cost}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-right" : "text-left")}>{t.inventory.price}</th>
                      <th className={cn("px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider", isRTL ? "text-left" : "text-right")}>{t.inventory.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRepairParts.map((part, index) => {
                      const isLowStock = part.quantity <= (part.min_quantity || 5);
                      return (
                        <motion.tr
                          key={part.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          className="hover:bg-muted/20"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Wrench className="w-5 h-5 text-amber-600" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{part.name}</p>
                                <p className="text-sm text-muted-foreground">{part.brand || ''} {part.compatible_models ? `· ${part.compatible_models}` : ''}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{part.sku}</code>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{part.category || '-'}</td>
                          <td className="px-6 py-4">
                            <span className={cn("font-medium", isLowStock ? "text-destructive" : "text-foreground")}>
                              {part.quantity}
                              {isLowStock && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive mr-2">{t.inventory.low}</span>}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{Number(part.cost).toLocaleString()} ر.س</td>
                          <td className="px-6 py-4 font-semibold text-foreground">{Number(part.price).toLocaleString()} ر.س</td>
                          <td className={cn("px-6 py-4", isRTL ? "text-left" : "text-right")}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingRepairPart(part)}>
                                  <Edit className="w-4 h-4 mr-2" /> {t.inventory.edit}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => deletePart(part.id)}>
                                  <Trash2 className="w-4 h-4 mr-2" /> {t.inventory.delete}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="m-0 p-6">
            <CategoryManager />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Add Device Dialog */}
      <DeviceDialog 
        open={showAddDevice}
        onOpenChange={setShowAddDevice}
        branches={branches}
        categories={deviceCategories}
        onSave={addDevice}
      />

      {/* Edit Device Dialog */}
      <DeviceDialog 
        open={!!editingDevice}
        onOpenChange={(open) => !open && setEditingDevice(null)}
        device={editingDevice}
        branches={branches}
        categories={deviceCategories}
        onSave={(data) => editingDevice && updateDevice(editingDevice.id, data)}
      />

      {/* Add Accessory Dialog */}
      <AccessoryDialog 
        open={showAddAccessory}
        onOpenChange={setShowAddAccessory}
        branches={branches}
        categories={accessoryCategories}
        onSave={addAccessory}
      />

      {/* Edit Accessory Dialog */}
      <AccessoryDialog 
        open={!!editingAccessory}
        onOpenChange={(open) => !open && setEditingAccessory(null)}
        accessory={editingAccessory}
        branches={branches}
        categories={accessoryCategories}
        onSave={(data) => editingAccessory && updateAccessory(editingAccessory.id, data)}
      />

      {/* Add Repair Part Dialog */}
      <RepairPartDialog 
        open={showAddRepairPart}
        onOpenChange={setShowAddRepairPart}
        branches={branches}
        onSave={addPart}
      />

      {/* Edit Repair Part Dialog */}
      <RepairPartDialog 
        open={!!editingRepairPart}
        onOpenChange={(open) => !open && setEditingRepairPart(null)}
        part={editingRepairPart}
        branches={branches}
        onSave={(data) => editingRepairPart && updatePart(editingRepairPart.id, data)}
      />
    </AppLayout>
  );
}

// Device Dialog Component
function DeviceDialog({ 
  open, 
  onOpenChange, 
  device, 
  branches,
  categories,
  onSave 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: Device | null;
  branches: { id: string; name: string }[];
  categories: { id: string; name: string; name_ar?: string | null }[];
  onSave: (data: any) => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);
  const { t, isRTL } = useLanguage();
  const [formData, setFormData] = useState({
    imei: '',
    model: '',
    brand: '',
    color: '',
    storage: '',
    cost: '',
    price: '',
    status: 'available' as DeviceStatus,
    branch_id: '',
    condition: 'new',
    category: ''
  });

  useState(() => {
    if (device) {
      setFormData({
        imei: device.imei,
        model: device.model,
        brand: device.brand || '',
        color: device.color || '',
        storage: device.storage || '',
        cost: String(device.cost),
        price: String(device.price),
        status: device.status,
        branch_id: device.branch_id || '',
        condition: device.condition,
        category: device.category || ''
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    await onSave({
      imei: formData.imei,
      model: formData.model,
      brand: formData.brand || null,
      color: formData.color || null,
      storage: formData.storage || null,
      cost: parseFloat(formData.cost) || 0,
      price: parseFloat(formData.price) || 0,
      status: formData.status,
      branch_id: formData.branch_id || null,
      condition: formData.condition,
      category: formData.category || null,
    });
    
    setLoading(false);
    onOpenChange(false);
    setFormData({
      imei: '', model: '', brand: '', color: '', storage: '',
      cost: '', price: '', status: 'available', branch_id: '', condition: 'new', category: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {device && (
              <ProductThumb
                code={device.imei}
                className="w-14 h-14"
                fallback={
                  <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-primary" />
                  </div>
                }
              />
            )}
            {device ? t.inventory.editDevice : t.inventory.addNewDevice}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imei">{t.inventory.imei} *</Label>
                <Input 
                  id="imei" 
                  value={formData.imei}
                  onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                  placeholder="353845110987456"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">{t.inventory.model} *</Label>
                <Input 
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="iPhone 15 Pro"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">{t.inventory.brand}</Label>
                <Input 
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="Apple"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storage">{t.inventory.storage}</Label>
                <Input 
                  id="storage"
                  value={formData.storage}
                  onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                  placeholder="256GB"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">{t.inventory.color}</Label>
                <Input 
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Natural Titanium"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">{t.inventory.branch}</Label>
                <Select value={formData.branch_id} onValueChange={(v) => setFormData({ ...formData, branch_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.inventory.selectBranch} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>{isRTL ? 'التصنيف' : 'Category'}</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v === '__none__' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر التصنيف' : 'Select category'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{isRTL ? 'بدون تصنيف' : 'No category'}</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.name}>{isRTL && c.name_ar ? c.name_ar : c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">{t.inventory.cost} *</Label>
                <Input 
                  id="cost"
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  placeholder="899"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{t.inventory.salePrice} *</Label>
                <Input 
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="1199"
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.inventory.cancel}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {device ? t.inventory.saveChanges : t.inventory.addDevice}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Accessory Dialog Component
function AccessoryDialog({ 
  open, 
  onOpenChange, 
  accessory, 
  branches,
  categories,
  onSave 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessory?: Accessory | null;
  branches: { id: string; name: string }[];
  categories: { id: string; name: string; name_ar?: string | null }[];
  onSave: (data: any) => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);
  const { t, isRTL } = useLanguage();
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    brand: '',
    cost: '',
    price: '',
    quantity: '',
    min_quantity: '5',
    branch_id: ''
  });

  useState(() => {
    if (accessory) {
      setFormData({
        sku: accessory.sku,
        name: accessory.name,
        category: accessory.category || '',
        brand: accessory.brand || '',
        cost: String(accessory.cost),
        price: String(accessory.price),
        quantity: String(accessory.quantity),
        min_quantity: String(accessory.min_quantity),
        branch_id: accessory.branch_id || ''
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    await onSave({
      sku: formData.sku,
      name: formData.name,
      category: formData.category || null,
      brand: formData.brand || null,
      cost: parseFloat(formData.cost) || 0,
      price: parseFloat(formData.price) || 0,
      quantity: parseInt(formData.quantity) || 0,
      min_quantity: parseInt(formData.min_quantity) || 5,
      branch_id: formData.branch_id || null
    });
    
    setLoading(false);
    onOpenChange(false);
    setFormData({
      sku: '', name: '', category: '', brand: '',
      cost: '', price: '', quantity: '', min_quantity: '5', branch_id: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {accessory && (
              <ProductThumb
                code={accessory.sku}
                className="w-14 h-14"
                fallback={
                  <div className="w-14 h-14 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Package className="w-6 h-6 text-accent" />
                  </div>
                }
              />
            )}
            {accessory ? t.inventory.editAccessory : t.inventory.addNewAccessory}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">{t.inventory.sku} *</Label>
                <Input 
                  id="sku" 
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="APL-APP-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t.inventory.name} *</Label>
                <Input 
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="AirPods Pro"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t.inventory.category}</Label>
                {categories.length > 0 ? (
                  <Select value={formData.category || '__none__'} onValueChange={(v) => setFormData({ ...formData, category: v === '__none__' ? '' : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.inventory.category} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{isRTL ? 'بدون تصنيف' : 'No category'}</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.name}>{isRTL && c.name_ar ? c.name_ar : c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Audio"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">{t.inventory.brand}</Label>
                <Input 
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="Apple"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">{t.inventory.quantity} *</Label>
                <Input 
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="25"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_quantity">{t.inventory.minimumStock}</Label>
                <Input 
                  id="min_quantity"
                  type="number"
                  value={formData.min_quantity}
                  onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                  placeholder="5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">{t.inventory.cost} *</Label>
                <Input 
                  id="cost"
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  placeholder="189"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{t.inventory.salePrice} *</Label>
                <Input 
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="249"
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.inventory.cancel}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {accessory ? t.inventory.saveChanges : t.inventory.addAccessory}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Repair Part Dialog Component
function RepairPartDialog({ 
  open, 
  onOpenChange, 
  part, 
  branches,
  onSave 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part?: RepairPart | null;
  branches: { id: string; name: string }[];
  onSave: (data: any) => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    brand: '',
    cost: '',
    price: '',
    quantity: '',
    min_quantity: '5',
    compatible_models: '',
    branch_id: '',
    notes: ''
  });

  useState(() => {
    if (part) {
      setFormData({
        sku: part.sku,
        name: part.name,
        category: part.category || '',
        brand: part.brand || '',
        cost: String(part.cost),
        price: String(part.price),
        quantity: String(part.quantity),
        min_quantity: String(part.min_quantity),
        compatible_models: part.compatible_models || '',
        branch_id: part.branch_id || '',
        notes: part.notes || ''
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    await onSave({
      sku: formData.sku,
      name: formData.name,
      category: formData.category || null,
      brand: formData.brand || null,
      cost: parseFloat(formData.cost) || 0,
      price: parseFloat(formData.price) || 0,
      quantity: parseInt(formData.quantity) || 0,
      min_quantity: parseInt(formData.min_quantity) || 5,
      compatible_models: formData.compatible_models || null,
      branch_id: formData.branch_id || null,
      notes: formData.notes || null
    });
    
    setLoading(false);
    onOpenChange(false);
    setFormData({
      sku: '', name: '', category: '', brand: '',
      cost: '', price: '', quantity: '', min_quantity: '5',
      compatible_models: '', branch_id: '', notes: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{part ? t.inventory.editRepairPart : t.inventory.addNewRepairPart}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rp-sku">SKU *</Label>
                <Input 
                  id="rp-sku" 
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="RP-SCR-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-name">{t.inventory.partName} *</Label>
                <Input 
                  id="rp-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="شاشة iPhone 15 Pro"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rp-category">{t.inventory.category}</Label>
                <Input 
                  id="rp-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="شاشات / بطاريات / ..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-brand">{t.inventory.brand}</Label>
                <Input 
                  id="rp-brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="OEM / Original"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-models">{t.inventory.compatibleDevices}</Label>
              <Input 
                id="rp-models"
                value={formData.compatible_models}
                onChange={(e) => setFormData({ ...formData, compatible_models: e.target.value })}
                placeholder="iPhone 15 Pro, iPhone 15 Pro Max"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rp-quantity">{t.inventory.quantity} *</Label>
                <Input 
                  id="rp-quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="10"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-min">{t.inventory.minimum}</Label>
                <Input 
                  id="rp-min"
                  type="number"
                  value={formData.min_quantity}
                  onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                  placeholder="5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rp-cost">{t.inventory.cost} *</Label>
                <Input 
                  id="rp-cost"
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  placeholder="150"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-price">{t.inventory.salePrice} *</Label>
                <Input 
                  id="rp-price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="250"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-branch">{t.inventory.branch}</Label>
              <Select value={formData.branch_id} onValueChange={(v) => setFormData({ ...formData, branch_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t.inventory.selectBranch} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.inventory.cancel}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {part ? t.inventory.saveChanges : t.inventory.addRepairPart}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
