import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, X, Minus, Plus, CreditCard, Banknote, ReceiptText, User, Phone, ShieldCheck,
  Smartphone, CalendarClock, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CouponApply } from "./CouponApply";
import { MadaMark, VisaMark, MastercardMark, ApplePayMark, TabbyMark, TamaraMark } from "@/components/icons/PaymentMarks";
import { useLanguage } from "@/i18n";
import type { Accessory, PaymentMethod } from "@/types/database";

export interface POSCartItem {
  id: string;
  type: 'device' | 'accessory' | 'warranty' | 'service';
  name: string;
  identifier: string;
  price: number;
  cost: number;
  quantity: number;
  deviceId?: string;
  accessoryId?: string;
  /** For a warranty line: the cart's device it protects */
  coversDeviceId?: string;
}

interface CartPanelProps {
  cart: POSCartItem[];
  selectedPayment: PaymentMethod | null;
  onSelectPayment: (method: PaymentMethod) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  // Still passed by the POS page; the warranty and add-on suggestions that
  // used them were removed from the cart
  onAddWarranty?: (item: POSCartItem) => void;
  onAddAccessory?: (accessory: Accessory) => void;
  accessories?: Accessory[];
  onClearCart: () => void;
  onCompleteSale: (customerName: string, customerPhone: string, discount: number) => void;
  isProcessing: boolean;
}

export function CartPanel({
  cart,
  selectedPayment,
  onSelectPayment,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCompleteSale,
  isProcessing,
}: CartPanelProps) {
  const { t, isRTL } = useLanguage();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const discount = couponDiscount;
  const totalBeforeDiscount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = totalBeforeDiscount - discount;
  const tax = total - (total / 1.15);
  const subtotal = total - tax;
  // What the customer pays at the till. Delivery is charged on website orders
  // only (store settings → shipping cost), never in the shop
  const amountDue = total;
  const amountDueTax = amountDue - (amountDue / 1.15);

  // Installments (Tabby / Tamara) are shown but not yet switched on
  const paymentMethods: { id: PaymentMethod | "installments"; icon: typeof Banknote; label: string; hint?: string; soon?: boolean; logos?: ReactNode }[] = [
    { id: "cash", icon: Banknote, label: isRTL ? "كاش" : "Cash" },
    { id: "card", icon: CreditCard, label: isRTL ? "مدى والبطاقات" : "Mada & cards", logos: <><MadaMark /><VisaMark /><MastercardMark /></> },
    { id: "apple_pay", icon: Smartphone, label: "Apple Pay", logos: <ApplePayMark /> },
    // part cash, part card — at the till only; the online store has its own methods
    { id: "mixed", icon: Layers, label: isRTL ? "مختلط" : "Mixed", hint: isRTL ? "كاش + بطاقة" : "Cash + card" },
    { id: "installments", icon: CalendarClock, label: isRTL ? "تقسيط" : "Installments", hint: isRTL ? "تابي · تمارا" : "Tabby · Tamara", soon: true, logos: <><TabbyMark /><TamaraMark /></> },
  ];

  const handleComplete = () => {
    setShowPaymentDialog(false);
    setCashReceived("");
    onCompleteSale(customerName, customerPhone, discount);
    setCustomerName("");
    setCustomerPhone("");
    setCouponDiscount(0);
    setAppliedCoupon(null);
  };

  const receivedAmount = parseFloat(cashReceived) || 0;
  const changeDue = receivedAmount - amountDue;
  const cashInsufficient = selectedPayment === "cash" && cashReceived !== "" && receivedAmount < amountDue;
  const canConfirmPayment =
    !!selectedPayment && (selectedPayment !== "cash" || cashReceived === "" || receivedAmount >= amountDue);

  // Sensible quick-tender suggestions for cash payments
  const quickAmounts = Array.from(
    new Set([Math.ceil(amountDue), Math.ceil(amountDue / 50) * 50, Math.ceil(amountDue / 100) * 100, Math.ceil(amountDue / 500) * 500])
  ).filter((v) => v >= amountDue).slice(0, 4);

  const hasCustomer = customerName.trim() || customerPhone.trim();

  return (
    <motion.div
      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-[380px] bg-card rounded-xl border border-border shadow-lg flex flex-col overflow-hidden"
    >
      {/* Cart Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">{t.pos.currentCart}</h3>
          <span className="text-xs text-muted-foreground">({cart.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Add Customer Button */}
          <Button
            variant={hasCustomer ? "default" : "outline"}
            size="sm"
            className={cn("h-7 text-xs gap-1 px-2", hasCustomer && "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20")}
            onClick={() => setShowCustomerDialog(true)}
          >
            <User className="w-3 h-3" />
            {hasCustomer ? (customerName || customerPhone) : (isRTL ? "عميل" : "Customer")}
          </Button>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs px-2"
              onClick={onClearCart}
            >
              {isRTL ? "مسح" : "Clear"}
            </Button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {cart.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center py-10"
            >
              <ShoppingCart className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{t.pos.emptyCart}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{t.pos.scanToAdd}</p>
            </motion.div>
          ) : (
            cart.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                className="p-3 rounded-lg bg-muted/30 border border-border/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{item.identifier}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {item.type === "device" && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {isRTL ? "جهاز" : "Device"}
                      </span>
                    )}
                    {item.type === "warranty" ? (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {isRTL ? "ضمان" : "Warranty"}
                      </span>
                    ) : (
                      <>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                  <span className="font-bold text-foreground">
                    {(item.price * item.quantity).toLocaleString()} <span className="text-xs text-muted-foreground">ر.س</span>
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Cart Footer */}
      <div className="border-t border-border p-3 space-y-2.5 bg-muted/10">
        {/* Totals */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.pos.subtotal}</span>
            <span className="font-medium">{subtotal.toLocaleString()} ر.س</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.pos.tax}</span>
            <span className="font-medium">{tax.toFixed(2)} ر.س</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-primary">
              <span>{isRTL ? "الخصم" : "Discount"}</span>
              <span>-{discount.toFixed(2)} ر.س</span>
            </div>
          )}
          <div className="flex justify-between text-base pt-1.5 border-t border-border">
            <span className="font-semibold">{t.pos.total}</span>
            <span className="font-bold text-primary">{total.toFixed(2)} ر.س</span>
          </div>
        </div>

        {/* Complete Sale */}
        <Button
          className="w-full h-12 text-base font-semibold bg-gradient-primary hover:opacity-90 shadow-glow touch-button"
          disabled={cart.length === 0 || isProcessing}
          onClick={() => setShowPaymentDialog(true)}
        >
          <ReceiptText className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
          {isProcessing ? (isRTL ? "جاري البيع..." : "Processing...") : t.pos.completeSale}
        </Button>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => { setShowPaymentDialog(open); if (!open) setCashReceived(""); }}>
        <DialogContent className="sm:max-w-[640px] p-6 sm:p-8 max-h-[92vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
          {/* the close button sits in the right corner; the title keeps clear of it */}
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2.5 text-xl">
              <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </span>
              {isRTL ? "الدفع" : "Payment"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Amount due */}
            <div className="rounded-2xl bg-primary/5 border border-primary/20 px-6 py-6 text-center">
              <p className="text-sm text-muted-foreground mb-1.5">{isRTL ? "المبلغ المستحق" : "Amount Due"}</p>
              <p className="text-5xl font-bold text-primary tracking-tight">{amountDue.toFixed(2)} <span className="text-xl">ر.س</span></p>
              <p className="text-xs text-muted-foreground mt-2">
                {isRTL ? `شامل ضريبة القيمة المضافة ${amountDueTax.toFixed(2)} ر.س` : `Includes VAT ${amountDueTax.toFixed(2)} SAR`}
              </p>
            </div>

            {/* Coupon — the customer's code, applied before paying */}
            <div>
              <Label className="text-sm font-semibold mb-2.5 block">{isRTL ? "كوبون الخصم" : "Coupon"}</Label>
              <CouponApply
                subtotal={totalBeforeDiscount}
                onApply={(d, code) => { setCouponDiscount(d); setAppliedCoupon(code); }}
                onRemove={() => { setCouponDiscount(0); setAppliedCoupon(null); }}
                appliedCoupon={appliedCoupon}
                isRTL={isRTL}
              />
              {/* How much the coupon saved — as a percentage and in riyals */}
              {appliedCoupon && discount > 0 && (
                <div className="mt-2 rounded-lg bg-success/10 border border-success/20 px-3 py-2 text-center">
                  <p className="text-sm font-semibold text-success">
                    {(() => {
                      const pct = totalBeforeDiscount > 0
                        ? Math.round((discount / totalBeforeDiscount) * 100)
                        : 0;
                      return isRTL
                        ? `🎉 حصلت على خصم ${pct}% — وفّرت ${discount.toFixed(2)} ر.س`
                        : `🎉 ${pct}% off — you saved ${discount.toFixed(2)} SAR`;
                    })()}
                  </p>
                </div>
              )}
            </div>

            {/* Payment method */}
            <div>
              <Label className="text-sm font-semibold mb-2.5 block">{isRTL ? "طريقة الدفع" : "Payment Method"}</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    disabled={method.soon}
                    onClick={() => !method.soon && onSelectPayment(method.id as PaymentMethod)}
                    title={method.soon ? (isRTL ? "قريباً" : "Coming soon") : undefined}
                    className={cn(
                      "relative min-h-[112px] py-4 px-1 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all",
                      method.soon
                        ? "border-dashed border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed"
                        : selectedPayment === method.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <method.icon className="w-6 h-6" />
                    <span className="text-[13px] font-semibold leading-tight text-center">{method.label}</span>
                    {method.hint && <span className="text-[10px] leading-none opacity-80">{method.hint}</span>}
                    {method.logos && (
                      <span className={cn("flex items-center justify-center gap-1 h-3 mt-0.5 [zoom:1.3]", method.soon && "opacity-60")}>{method.logos}</span>
                    )}
                    {method.soon && (
                      <span className="absolute -top-2 start-1.5 text-[10px] px-1.5 rounded-md bg-muted border border-border text-muted-foreground">
                        {isRTL ? "قريباً" : "Soon"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash tender + change */}
            {selectedPayment === "cash" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{isRTL ? "المبلغ المستلم من العميل" : "Amount Received"}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder={amountDue.toFixed(2)}
                  className={cn("h-12 text-xl font-bold text-center", cashInsufficient && "border-destructive")}
                />
                <div className="flex gap-1.5">
                  {quickAmounts.map((v) => (
                    <button
                      key={v}
                      onClick={() => setCashReceived(String(v))}
                      className="flex-1 py-2.5 rounded-lg border border-border bg-muted/40 text-sm font-medium hover:border-primary/50 transition-all"
                    >
                      {v.toLocaleString()}
                    </button>
                  ))}
                </div>
                {cashReceived !== "" && (
                  cashInsufficient ? (
                    <p className="text-sm text-destructive font-medium text-center">
                      {isRTL ? `المبلغ ناقص ${(amountDue - receivedAmount).toFixed(2)} ر.س` : `Short by ${(amountDue - receivedAmount).toFixed(2)} SAR`}
                    </p>
                  ) : (
                    <div className="flex justify-between items-center rounded-lg bg-success/10 border border-success/20 px-3 py-2">
                      <span className="text-sm font-medium text-success">{isRTL ? "الباقي للعميل" : "Change Due"}</span>
                      <span className="text-lg font-bold text-success">{changeDue.toFixed(2)} ر.س</span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" className="h-12 px-6 text-base" onClick={() => setShowPaymentDialog(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className="bg-gradient-primary hover:opacity-90 flex-1 h-12 text-base font-semibold"
              disabled={!canConfirmPayment || isProcessing}
              onClick={handleComplete}
            >
              <ReceiptText className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
              {isRTL ? "تأكيد الدفع وإصدار الفاتورة" : "Confirm & Issue Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Info Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{isRTL ? "بيانات العميل" : "Customer Info"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? "اسم العميل" : "Customer Name"}</Label>
              <div className="relative">
                <User className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={isRTL ? "اسم العميل" : "Customer name"}
                  className={cn(isRTL ? "pr-9" : "pl-9")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "رقم الجوال" : "Phone Number"}</Label>
              <div className="relative">
                <Phone className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={isRTL ? "05xxxxxxxx" : "05xxxxxxxx"}
                  className={cn(isRTL ? "pr-9" : "pl-9")}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            {hasCustomer && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => { setCustomerName(""); setCustomerPhone(""); setShowCustomerDialog(false); }}
              >
                {isRTL ? "مسح البيانات" : "Clear"}
              </Button>
            )}
            <Button onClick={() => setShowCustomerDialog(false)}>
              {isRTL ? "تم" : "Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
