import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isCashierMember } from '@/lib/cashier';

/**
 * Signing out, the one way the header always did it: a cashier's leaving is
 * written to the attendance log first (never blocking the sign-out), then the
 * session ends and the login page opens. The sidebar's button uses the same.
 */
export function useSignOut() {
  const { signOut, merchantUser, merchant, user } = useAuth();
  const navigate = useNavigate();
  return useCallback(async () => {
    if (isCashierMember(merchantUser) && merchant && user) {
      try {
        await supabase.from('activity_logs').insert({
          merchant_id: merchant.id,
          user_id: user.id,
          action: 'pos_check_out',
          entity_type: 'attendance',
        } as never);
      } catch { /* لا نوقف الخروج لو فشل التسجيل */ }
    }
    await signOut();
    navigate('/auth');
  }, [signOut, merchantUser, merchant, user, navigate]);
}

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  owner: { ar: 'المالك', en: 'Owner' },
  admin: { ar: 'أدمن', en: 'Admin' },
  branch_manager: { ar: 'مدير فرع', en: 'Branch manager' },
  inventory_manager: { ar: 'مسؤول المخزون', en: 'Inventory manager' },
  cashier: { ar: 'كاشير', en: 'Cashier' },
};

/** Who is signed in, and as what — a custom role by its own name */
export function useWhoAmI(isArabic: boolean) {
  const { merchantUser, user } = useAuth();
  const displayName = (user?.user_metadata?.full_name as string | undefined)?.trim() || '';
  const roleLabel = merchantUser?.role === 'custom'
    ? merchantUser.customRole?.name ?? (isArabic ? 'دور مخصص' : 'Custom role')
    : (ROLE_LABELS[merchantUser?.role ?? '']?.[isArabic ? 'ar' : 'en'] ?? '');
  return { displayName, roleLabel };
}
