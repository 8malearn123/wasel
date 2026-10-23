import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n';

export type DenialReason = 'plan' | 'permission';

const MESSAGES: Record<DenialReason, { ar: [string, string]; en: [string, string] }> = {
  plan: {
    ar: ['هذه الصفحة غير متاحة في باقتك الحالية', 'نقلناك إلى صفحة الباقات لتطّلع على الباقة التي تتضمنها.'],
    en: ['This page is not included in your current plan', 'We have taken you to the plans page to see which plan includes it.'],
  },
  permission: {
    ar: ['ليست لديك صلاحية لفتح هذه الصفحة', 'اطلب من مدير المتجر منحك الصلاحية من صفحة المستخدمين والصلاحيات.'],
    en: ['You do not have permission to open this page', 'Ask the shop manager to grant it from Users & permissions.'],
  },
};

/** A toast saying why, in the reader's language — once per reason at a time */
export function announceDenial(reason: DenialReason, isRTL: boolean) {
  const [title, description] = MESSAGES[reason][isRTL ? 'ar' : 'en'];
  toast.warning(title, { id: `denied-${reason}`, description });
}

/**
 * A redirect that says why. The route guards used to send a user who lacked
 * the plan or the permission to another page without a word, which read as a
 * broken link.
 */
export function DeniedRedirect({ to, reason }: { to: string; reason: DenialReason }) {
  const { isRTL } = useLanguage();
  useEffect(() => { announceDenial(reason, isRTL); }, [reason, isRTL]);
  return <Navigate to={to} replace />;
}
