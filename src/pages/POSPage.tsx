import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, FileText } from "lucide-react";
import type { Device, Accessory, PaymentMethod } from "@/types/database";
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
  customerName?: string;
  customerPhone?: string;
  merchantName: string;
  branchName: string;
  date: string;
}

export default function POSPage() {
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [activeTab, setActiveTab] = useState("pos");
  const { t, isRTL } = useLanguage();
  const { merchant, currentBranch, merchantUser } = useAuth();

  const { devices, accessories, loading, refetch, searchByIMEI, searchBySkuOrName } = usePOSInventory();
  const { createSale, markAsPrinted, sales, loading: salesLoading, updateSale, refetch: refetchSales } = useSales();

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

  const handleCompleteSale = async (customerName: string, customerPhone: string, discount: number) => {
    if (!selectedPayment || cart.length === 0) return;

    setIsProcessing(true);
    try {
      const result = await createSale(cart, selectedPayment, customerName || undefined, customerPhone || undefined, discount);
      if (!result.error && result.data) {
        const totalBeforeDiscount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = totalBeforeDiscount - discount;
        const tax = total - (total / 1.15);
        const subtotal = total - tax;

        setInvoiceData({
          saleId: result.data.id,
          invoiceNumber: result.data.invoice_number,
          items: [...cart],
          subtotal,
          tax,
          discount,
          total,
          paymentMethod: selectedPayment,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          merchantName: merchant?.name || "Store",
          branchName: currentBranch?.name || "Main",
          date: new Date().toLocaleString(),
        });

        setCart([]);
        setSelectedPayment(null);
        await refetch();

        // Auto-print if enabled
        try {
          const prefs = JSON.parse(localStorage.getItem("pos_printer_prefs") || "{}");
          if (prefs.autoPrint) {
            setTimeout(() => {
              const printBtn = document.querySelector('[data-auto-print]') as HTMLButtonElement;
              printBtn?.click();
            }, 500);
          }
        } catch {}
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrinted = () => {
    if (invoiceData?.saleId) {
      markAsPrinted(invoiceData.saleId);
    }
  };

  // Filter sales for cashier - only their own
  const cashierSales = isCashier
    ? sales.filter(s => s.sold_by === merchantUser?.user_id)
    : sales;

  return (
    <AppLayout title={t.pos.title} subtitle={t.pos.subtitle}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100vh-140px)]">
        <TabsList className="mb-4">
          <TabsTrigger value="pos" className="gap-2">
            <ShoppingCart className="w-4 h-4" />
            {isRTL ? "نقطة البيع" : "POS"}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <FileText className="w-4 h-4" />
            {isRTL ? "فواتيري" : "My Invoices"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="h-[calc(100%-60px)]">
          <div className="flex gap-6 h-full">
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
              <ScannerSection onScan={handleScan} isSearching={isSearching} />
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
            />
          </div>
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
