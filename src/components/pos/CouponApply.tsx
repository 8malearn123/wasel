import { useState } from 'react';
import { Ticket, Loader2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CouponResult {
  id: string;
  code: string;
  name: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  min_order_amount: number | null;
}

interface CouponApplyProps {
  subtotal: number;
  onApply: (discount: number, couponCode: string) => void;
  onRemove: () => void;
  appliedCoupon: string | null;
  isRTL: boolean;
}

export function CouponApply({ subtotal, onApply, onRemove, appliedCoupon, isRTL }: CouponApplyProps) {
  const { merchant } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApply = async () => {
    if (!code.trim() || !merchant) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchErr } = await supabase
        .from('coupons')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('code', code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (fetchErr || !data) {
        setError(isRTL ? 'كوبون غير صالح' : 'Invalid coupon');
        setLoading(false);
        return;
      }

      const coupon = data as CouponResult;

      // Check min order
      if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
        setError(isRTL ? `الحد الأدنى للطلب ${coupon.min_order_amount}` : `Min order: ${coupon.min_order_amount}`);
        setLoading(false);
        return;
      }

      // Check max uses
      if (data.max_uses && data.used_count >= data.max_uses) {
        setError(isRTL ? 'الكوبون نفد' : 'Coupon exhausted');
        setLoading(false);
        return;
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError(isRTL ? 'الكوبون منتهي' : 'Coupon expired');
        setLoading(false);
        return;
      }

      // Calculate discount
      let discount = 0;
      if (coupon.discount_type === 'percentage') {
        discount = subtotal * (coupon.discount_value / 100);
        if (coupon.max_discount_amount) {
          discount = Math.min(discount, coupon.max_discount_amount);
        }
      } else {
        discount = coupon.discount_value;
      }

      discount = Math.min(discount, subtotal);

      // Increment usage
      await supabase
        .from('coupons')
        .update({ used_count: data.used_count + 1 })
        .eq('id', coupon.id);

      onApply(discount, coupon.code);
      setCode('');
    } catch {
      setError(isRTL ? 'خطأ في التحقق' : 'Verification error');
    } finally {
      setLoading(false);
    }
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
        <Check className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-sm text-primary font-medium flex-1">{appliedCoupon}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
          <Input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
            placeholder={isRTL ? "رمز الكوبون" : "Coupon code"}
            className={cn("h-9 text-sm font-mono", isRTL ? "pr-9" : "pl-9")}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          />
        </div>
        <Button variant="outline" size="sm" className="h-9 px-3" onClick={handleApply} disabled={loading || !code.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRTL ? "تطبيق" : "Apply")}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
