import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { usePOSInventory } from "@/hooks/usePOSInventory";
import { useSales } from "@/hooks/useSales";
import { ScannerSection } from "@/components/pos/ScannerSection";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CartPanel, POSCartItem } from "@/components/pos/CartPanel";
import { InvoiceDialog } from "@/components/pos/InvoiceDialog";
import { CashierSalesHistory } from "@/components/pos/CashierSalesHistory";
import { OpenShiftPanel, ShiftBar } from "@/components/pos/ShiftControls";
import { FocusModeBar, FocusModeButton, useFocusMode } from "@/components/pos/FocusMode";
import { useShift } from "@/hooks/useShift";
import { useOfflineSales } from "@/hooks/useOfflineSales";
import { OfflineBanner } from "@/components/pos/OfflineBanner";
import { isNetworkError } from "@/lib/offline/offlineSales";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from '@/hooks/useTabParam';
import { ShoppingCart, FileText, Loader2 } from "lucide-react";
import type { Device, Accessory, PaymentMethod } from "@/types/database";
import type { PaymentLine } from "@/lib/payments";
import { toast } from "sonner";

interface InvoiceData {
  saleId: string;
  invoiceNumber: string;
  items: POSCartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  payments?: PaymentLine[];
  saleDateISO?: string;
  /** Made offline: not on the server yet (queued on this device). */
  offline?: boolean;
  customerName?: string;
  customerPhone?: string;
  merchantName: string;
  branchName: string;
  date: string;
  deliveryDate?: string;
}

export default function POSPage() {
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [activeTab, setActiveTab] = useTabParam("pos");
  const { t, isRTL } = useLanguage();
  const { merchant, currentBranch, merchantUser, user } = useAuth();

  // تسجيل حضور الكاشير (مرة واحدة في اليوم) عند دخوله نقطة البيع —
  // يظهر في قسم الموارد البشرية كموعد الدخول
  useEffect(() => {
    if (!merchant || !user || merchantUser?.role !== 'cashier') return;
    (async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data } = await supabase
          .from('activity_logs')
          .select('id')
          .eq('merchant_id', merchant.id)
          .eq('user_id', user.id)
          .eq('action', 'pos_check_in')
          .gte('created_at', today.toISOString())
          .limit(1);
        if (!data || data.length === 0) {
          await supabase.from('activity_logs').insert({
            merchant_id: merchant.id,
            user_id: user.id,
            action: 'pos_check_in',
            entity_type: 'attendance',
          } as any);
        }
      } catch { /* السجل اختياري — ما نعطل نقطة البيع */ }
    })();
  }, [merchant?.id, user?.id, merchantUser?.role]);

  const { createSale, markAsPrinted, sales, loading: salesLoading, updateSale, refetch: refetchSales } = useSales();
  const { shift, loading: shiftLoading, refresh: refreshShift, openShift, recordMovement, closeShift } = useShift();

  // Offline selling: when the connection drops, sales are queued on this device and
  // synced back through the server later. onSynced refreshes what the sync changed.
  const syncedRef = useRef<() => void>(() => {});
  const offline = useOfflineSales({ onSynced: () => syncedRef.current() });
  const { devices, accessories, loading, refetch, applyOfflineSale, searchByIMEI, searchBySkuOrName } =
    usePOSInventory({ offline: !offline.online });
  syncedRef.current = () => { refetch(); refetchSales(); refreshShift(); };

  // One id per checkout attempt of this cart: a retry after a lost response (online
  // again, or from the offline queue) can never sell twice.
  const attemptRef = useRef<string | null>(null);
  useEffect(() => { attemptRef.current = null; }, [cart]);

  // The shift can't be closed while offline sales are still waiting to sync.
  const closeShiftWhenSynced: typeof closeShift = async (counted, notes) => {
    if (offline.pending > 0) {
      toast.error("توجد مبيعات بدون إنترنت لم تُزامن بعد؛ انتظر المزامنة ثم أغلق الوردية");
      return null;
    }
    return closeShift(counted, notes);
  };

  const focusMode = useFocusMode();

  const isCashier = merchantUser?.role === 'cashier';

  const addDeviceToCart = (device: Device) => {
    const alreadyInCart = cart.find(item => item.deviceId === device.id);
    if (alreadyInCart) {
      toast.error("This device is already in cart");
      return;
    }
    const newItem: POSCartItem = {
      id: `dev-${device.id}`,
      type: "device",
      name: `${device.brand || ''} ${device.model}`.trim(),
      identifier: device.imei,
      price: Number(device.price),
      cost: Number(device.cost),
      quantity: 1,
      deviceId: device.id,
    };
    setCart(prev => [...prev, newItem]);
    toast.success(`Added ${newItem.name}`);
  };

  const addAccessoryToCart = (accessory: Accessory) => {
    const existing = cart.find(item => item.accessoryId === accessory.id);
    if (existing) {
      if (existing.quantity >= accessory.quantity) {
        toast.error("Not enough stock");
        return;
      }
      setCart(prev =>
        prev.map(item =>
          item.accessoryId === accessory.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      const newItem: POSCartItem = {
        id: `acc-${accessory.id}`,
        type: "accessory",
        name: accessory.name,
        identifier: accessory.sku,
        price: Number(accessory.price),
        cost: Number(accessory.cost),
        quantity: 1,
        accessoryId: accessory.id,
      };
      setCart(prev => [...prev, newItem]);
    }
    toast.success(`Added ${accessory.name}`);
  };

  const handleScan = async (code: string) => {
    setIsSearching(true);
    try {
      const deviceResult = await searchByIMEI(code);
      if (deviceResult) {
        addDeviceToCart(deviceResult);
      } else {
        const { accessories } = await searchBySkuOrName(code);
        if (accessories.length === 1) {
          addAccessoryToCart(accessories[0]);
        } else if (accessories.length > 0) {
          toast.info(`Found ${accessories.length} accessories. Select from the grid.`);
        } else {
          toast.error("No products found");
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const finishSale = (data: InvoiceData) => {
    setInvoiceData(data);
    setCart([]);
    setSelectedPayment(null);
    // Auto-print if enabled
    try {
      const prefs = JSON.parse(localStorage.getItem("pos_printer_prefs") || "{}");
      if (prefs.autoPrint) {
        setTimeout(() => {
          const printBtn = document.querySelector('[data-auto-print]') as HTMLButtonElement;
          printBtn?.click();
        }, 500);
      }
    } catch { /* printing preferences are optional */ }
  };

  const handleCompleteSale = async (customerName: string, customerPhone: string, discount: number, payments: PaymentLine[]) => {
    if (!selectedPayment || cart.length === 0) return;
    attemptRef.current ??= crypto.randomUUID();
    const clientRef = attemptRef.current;
    const common = {
      items: [...cart],
      payments,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      merchantName: merchant?.name || "Store",
      branchName: currentBranch?.name || "Main",
    };

    setIsProcessing(true);
    try {
      if (!offline.online) {
        // Offline: queue on this device under the till's own OFF- series.
        try {
          const sale = await offline.recordSale({
            clientRef,
            cart,
            payments,
            discount,
            vatEnabled: (merchant as { vat_enabled?: boolean } | null)?.vat_enabled !== false,
            customerName: customerName || undefined,
            customerPhone: customerPhone || undefined,
          });
          applyOfflineSale(sale);
          const soldAt = new Date(sale.sold_at);
          finishSale({
            ...common,
            saleId: sale.client_ref,
            invoiceNumber: sale.invoice_number,
            subtotal: sale.subtotal,
            tax: sale.tax_amount,
            discount: 0,
            total: sale.total_amount,
            paymentMethod: payments.length > 1 ? "mixed" : (payments[0]?.method ?? "cash"),
            saleDateISO: sale.sold_at,
            offline: true,
            date: soldAt.toLocaleString(),
            deliveryDate: soldAt.toLocaleDateString(),
          });
          toast.success(`حُفظت الفاتورة ${sale.invoice_number} على الجهاز، وستُزامن عند عودة الاتصال`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "تعذر حفظ البيع بدون إنترنت");
        }
        return;
      }

      const result = await createSale(cart, payments, customerName || undefined, customerPhone || undefined, discount, undefined, clientRef);
      if (result.error || !result.data) {
        if (isNetworkError(result.error)) {
          // The sale may or may not have reached the server. Keep the cart and the same
          // attempt id: confirming again saves it offline, and the sync recognises it if
          // the first attempt did go through.
          offline.markOffline();
          toast.error("انقطع الاتصال أثناء إتمام البيع. اضغط إتمام البيع مرة أخرى لحفظه بدون إنترنت.");
          return;
        }
        // The server refused (e.g. a unit was just sold elsewhere, or the shift was
        // closed from another till): refresh the shelf and the shift.
        await Promise.all([refetch(), refreshShift()]);
        return;
      }

      // Totals come from pos_checkout, the single source of truth for the invoice.
      const sale = result.data;
      const saleDate = new Date(sale.sale_date);
      finishSale({
        ...common,
        saleId: sale.sale_id,
        invoiceNumber: sale.invoice_number,
        subtotal: Number(sale.subtotal),
        tax: Number(sale.tax_amount),
        discount: Number(sale.discount_amount),
        total: Number(sale.total_amount),
        paymentMethod: sale.payment_method,
        saleDateISO: sale.sale_date,
        date: saleDate.toLocaleString(),
        deliveryDate: saleDate.toLocaleDateString(),
      });
      await refetch();
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrinted = () => {
    if (invoiceData?.saleId && !invoiceData.offline) {
      markAsPrinted(invoiceData.saleId);
    }
  };

  // Filter sales for cashier - only their own
  const cashierSales = isCashier
    ? sales.filter(s => s.sold_by === merchantUser?.user_id)
    : sales;

  return (
    <AppLayout title={t.pos.title} subtitle={t.pos.subtitle} focusMode={focusMode.focus}>
      {focusMode.focus && (
        <FocusModeBar
          branchName={currentBranch?.name}
          userName={user?.email || undefined}
          fullscreen={focusMode.fullscreen}
          onFullscreen={focusMode.enterFullscreen}
          onExit={focusMode.exit}
        />
      )}
      <div className={focusMode.focus ? "mt-3" : "mb-3"}>
        <OfflineBanner
          online={offline.online}
          pending={offline.pending}
          syncing={offline.syncing}
          terminalReady={offline.terminalReady}
          onSync={offline.syncNow}
        />
      </div>
      <Tabs
        value={focusMode.focus ? "pos" : activeTab}
        onValueChange={setActiveTab}
        className={focusMode.focus ? "h-[calc(100vh-80px)] mt-3" : "h-[calc(100vh-140px)]"}
      >

        <TabsContent value="pos" className="h-[calc(100%-60px)]">
          {shiftLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !shift ? (
            <div className="h-full flex flex-col">
              {!focusMode.focus && (
                <div className="flex justify-end">
                  <FocusModeButton onEnter={focusMode.enter} />
                </div>
              )}
              <div className="flex-1"><OpenShiftPanel onOpen={openShift} /></div>
            </div>
          ) : (
          <div className="flex flex-col gap-4 h-full">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ShiftBar report={shift} onMovement={recordMovement} onClose={closeShiftWhenSynced} onClosed={refreshShift} />
            </div>
            {!focusMode.focus && <FocusModeButton onEnter={focusMode.enter} />}
          </div>
          <div className="flex gap-6 flex-1 min-h-0">
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
              <ScannerSection onScan={handleScan} isSearching={isSearching} captureKeys={focusMode.focus} />
              <ProductGrid
                devices={devices}
                accessories={accessories}
                loading={loading}
                onAddDevice={addDeviceToCart}
                onAddAccessory={addAccessoryToCart}
              />
            </div>

            <CartPanel
              cart={cart}
              selectedPayment={selectedPayment}
              onSelectPayment={setSelectedPayment}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeFromCart}
              onClearCart={() => setCart([])}
              onCompleteSale={handleCompleteSale}
              isProcessing={isProcessing}
              offline={!offline.online}
            />
          </div>
          </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="h-[calc(100%-60px)] overflow-auto">
          <CashierSalesHistory
            sales={cashierSales}
            loading={salesLoading}
            isCashier={isCashier}
            onUpdateSale={updateSale}
            onRefresh={refetchSales}
            merchantName={merchant?.name || "Store"}
            branchName={currentBranch?.name || "Main"}
          />
        </TabsContent>
      </Tabs>

      {invoiceData && (
        <InvoiceDialog
          data={invoiceData}
          onClose={() => setInvoiceData(null)}
          onPrinted={handlePrinted}
        />
      )}
    </AppLayout>
  );
}
