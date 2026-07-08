import { useEffect, useState } from "react";
import { User, Mail, Building2, Shield, Activity, Loader2, Save } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك المتجر",
  manager: "مدير",
  cashier: "كاشير",
  technician: "فني صيانة",
};

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, merchant, merchantUser } = useAuth();
  const { isRTL } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setFullName(data?.full_name || (user.user_metadata?.full_name ?? "")));
  }, [open, user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: fullName.trim() });
    setSaving(false);
    if (error) {
      toast.error("تعذر حفظ الملف الشخصي: " + error.message);
      return;
    }
    toast.success("تم حفظ الملف الشخصي");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> الملف الشخصي
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="اسمك الكامل" />
          </div>
          <div className="space-y-3 rounded-lg bg-muted/30 border border-border p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4 shrink-0" />
              <span className="truncate">{user?.email || "دخول بكود"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="truncate">{merchant?.name || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-4 h-4 shrink-0" />
              <span>{ROLE_LABELS[merchantUser?.role || ""] || merchantUser?.role || "—"}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          <Button onClick={save} disabled={saving || !fullName.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Save className="w-4 h-4 ml-1" /> حفظ</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LogRow {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  upgrade_requested: "طلب ترقية باقة",
  sale_completed: "إتمام عملية بيع",
  created: "إضافة",
  updated: "تعديل",
  deleted: "حذف",
};

const ENTITY_LABELS: Record<string, string> = {
  subscription: "الاشتراك",
  sale: "مبيعات",
  device: "جهاز",
  accessory: "إكسسوار",
  repair: "صيانة",
  transfer: "تحويل",
};

export function ActivityLogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { merchant } = useAuth();
  const { isRTL } = useLanguage();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !merchant) return;
    setLoading(true);
    supabase
      .from("activity_logs")
      .select("id, action, entity_type, created_at")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(25)
      .then(({ data }) => {
        setRows((data as LogRow[]) || []);
        setLoading(false);
      });
  }, [open, merchant]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> سجل النشاط
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              لا يوجد نشاط مسجّل بعد — ستظهر هنا عملياتك (بيع، تعديل مخزون، طلبات ترقية...)
            </p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/30 border border-border/50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {ACTION_LABELS[r.action] || r.action}
                      <span className="text-muted-foreground font-normal"> — {ENTITY_LABELS[r.entity_type] || r.entity_type}</span>
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
