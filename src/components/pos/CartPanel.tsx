import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, X, Minus, Plus, CreditCard, Banknote, Building2, Percent, Receipt, User, Phone
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
import { useLanguage } from "@/i18n";
import { CouponApply } from "./CouponApply";
import type { PaymentMethod } from "@/types/database";

export interface POSCartItem {
  id: string;
  type: 'device' | 'accessory';
  name: string;
  identifier: string;
  price: number;
  cost: number;
  quantity: number;
  deviceId?: string;
  accessoryId?: string;
}

interface CartPanelProps {
  cart: POSCartItem[];
  selectedPayment: PaymentMethod | null;
  onSelectPayment: (method: PaymentMethod) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
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
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  const discount = couponDiscount;
  const totalBeforeDiscount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = totalBeforeDiscount - discount;
  const tax = total - (total / 1.15);
  const subtotal = total - tax;

  const paymentMethods: { id: PaymentMethod; icon: typeof Banknote; label: string }[] = [
    { id: "cash", icon: Banknote, label: t.pos.cash },
    { id: "card", icon: CreditCard, label: t.pos.card },
    { id: "bank_transfer", icon: Building2, label: "Bank" },
    { id: "mixed", icon: Percent, label: t.pos.mixed },
  ];

  const handleComplete = () => {
    onCompleteSale(customerName, customerPhone, discount);
    setCustomerName("");
    setCustomerPhone("");
    setCouponDiscount(0);
    setAppliedCoupon(null);
  };

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
                  {item.type === "accessory" ? (
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, -1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateQuantity(item.id, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      {isRTL ? "جهاز" : "Device"}
                    </span>
                  )}
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
        {/* Coupon */}
        <CouponApply
          subtotal={subtotal}
          onApply={(d, code) => { setCouponDiscount(d); setAppliedCoupon(code); }}
          onRemove={() => { setCouponDiscount(0); setAppliedCoupon(null); }}
          appliedCoupon={appliedCoupon}
          isRTL={isRTL}
        />

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

        {/* Payment Methods */}
        <div className="grid grid-cols-4 gap-1.5">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => onSelectPayment(method.id)}
              className={cn(
                "py-2 rounded-lg border flex flex-col items-center gap-0.5 transition-all",
                selectedPayment === method.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50"
              )}
            >
              <method.icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{method.label}</span>
            </button>
          ))}
        </div>

        {/* Complete Sale */}
        <Button
          className="w-full h-12 text-base font-semibold bg-gradient-primary hover:opacity-90 shadow-glow touch-button"
          disabled={cart.length === 0 || !selectedPayment || isProcessing}
          onClick={handleComplete}
        >
          <Receipt className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
          {isProcessing ? (isRTL ? "جاري المعالجة..." : "Processing...") : t.pos.completeSale}
        </Button>
      </div>

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
