import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Supabase JS types don't yet expose the `oauth` namespace publicly.
type OAuthAPI = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const supaOAuth = (supabase.auth as any).oauth as OAuthAPI;

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("رابط الموافقة غير صالح (authorization_id مفقود).");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await supaOAuth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await supaOAuth.approveAuthorization(authorizationId)
      : await supaOAuth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("لم يُرجع الخادم رابط إعادة توجيه.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 text-center">
          <XCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h1 className="text-lg font-bold mb-2">تعذّر تحميل طلب المصادقة</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const clientName = details.client?.name ?? "تطبيق خارجي";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4" dir="rtl">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-bold text-center mb-2">ربط {clientName} بحسابك</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          سيتمكن {clientName} من قراءة بيانات متجرك (المبيعات، المخزون، الصيانة) نيابةً عنك عبر بروتوكول MCP.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => decide(false)}
          >
            رفض
          </Button>
          <Button
            className="flex-1 bg-gradient-primary hover:opacity-90"
            disabled={busy}
            onClick={() => decide(true)}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "موافقة"}
          </Button>
        </div>
      </div>
    </div>
  );
}
