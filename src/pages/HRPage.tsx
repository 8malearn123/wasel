import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Briefcase, Users, Wallet, TrendingUp, Loader2, Pencil, Phone, CalendarDays,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useMerchantUsers } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n";
import { toast } from "sonner";
import type { MerchantUser } from "@/types/database";

// Extra HR details are kept on this device (no employees table in the DB)
interface HRInfo {
  jobTitle?: string;
  salary?: number;
  hireDate?: string;
  phone?: string;
  notes?: string;
}

const HR_KEY = "hr-records";

function loadHR(): Record<string, HRInfo> {
  try { return JSON.parse(localStorage.getItem(HR_KEY) || "{}"); } catch { return {}; }
}

const ROLE_LABELS: Record<string, { ar: string; en: string; cls: string }> = {
  owner: { ar: "مالك", en: "Owner", cls: "bg-primary/10 text-primary border-primary/20" },
  manager: { ar: "مدير", en: "Manager", cls: "bg-accent/10 text-accent-foreground border-accent/20" },
  cashier: { ar: "كاشير", en: "Cashier", cls: "bg-success/10 text-success border-success/20" },
  inventory_manager: { ar: "مدير مخزون", en: "Inventory Manager", cls: "bg-warning/10 text-warning border-warning/20" },
  technician: { ar: "فني صيانة", en: "Technician", cls: "bg-muted text-muted-foreground border-border" },
};

export default function HRPage() {
  const { isRTL } = useLanguage();
  const { merchant } = useAuth();
  const { users, loading } = useMerchantUsers();
  const [hr, setHr] = useState<Record<string, HRInfo>>(loadHR);
  const [editing, setEditing] = useState<MerchantUser | null>(null);
  const [monthSales, setMonthSales] = useState<Record<string, number>>({});

  // Sales this month per employee (by created_by)
  useEffect(() => {
    if (!merchant) return;
    (async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("sales")
        .select("created_by, total_amount")
        .eq("merchant_id", merchant.id)
        .gte("sale_date", start.toISOString())
        .limit(2000);
      const totals: Record<string, number> = {};
      for (const s of data || []) {
        if (!s.created_by) continue;
        totals[s.created_by] = (totals[s.created_by] || 0) + Number(s.total_amount || 0);
      }
      setMonthSales(totals);
    })();
  }, [merchant]);

  const saveHR = (muId: string, info: HRInfo) => {
    const next = { ...hr, [muId]: info };
    setHr(next);
    try { localStorage.setItem(HR_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    toast.success(isRTL ? "تم حفظ بيانات الموظف" : "Employee info saved");
  };

  const activeUsers = users.filter(u => u.is_active);
  const totalSalaries = users.reduce((s, u) => s + (hr[u.id]?.salary || 0), 0);
  const teamMonthSales = users.reduce((s, u) => s + (monthSales[u.user_id] || 0), 0);

  return (
    <AppLayout
      title={isRTL ? "الموارد البشرية" : "Human Resources"}
      subtitle={isRTL ? "معلومات الموظفين والرواتب والأداء" : "Employee info, salaries and performance"}
    >
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        {[
          { icon: Users, value: users.length, label: isRTL ? "إجمالي الموظفين" : "Total Employees", color: "text-primary bg-primary/10" },
          { icon: Briefcase, value: activeUsers.length, label: isRTL ? "الموظفون النشطون" : "Active Employees", color: "text-success bg-success/10" },
          { icon: Wallet, value: `${totalSalaries.toLocaleString()} ر.س`, label: isRTL ? "إجمالي الرواتب الشهرية" : "Monthly Salaries", color: "text-warning bg-warning/10" },
          { icon: TrendingUp, value: `${teamMonthSales.toLocaleString()} ر.س`, label: isRTL ? "مبيعات الفريق هذا الشهر" : "Team Sales This Month", color: "text-primary bg-primary/10" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Employees table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{isRTL ? "لا يوجد موظفون بعد — أضفهم من صفحة المستخدمين" : "No employees yet — add them from the Users page"}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {[
                    isRTL ? "الموظف" : "Employee",
                    isRTL ? "المسمى الوظيفي" : "Job Title",
                    isRTL ? "الدور" : "Role",
                    isRTL ? "الجوال" : "Phone",
                    isRTL ? "الراتب" : "Salary",
                    isRTL ? "تاريخ التعيين" : "Hire Date",
                    isRTL ? "مبيعات الشهر" : "Month Sales",
                    isRTL ? "الحالة" : "Status",
                    "",
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-xs font-medium text-muted-foreground text-right whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {users.map(u => {
                  const info = hr[u.id] || {};
                  const role = ROLE_LABELS[u.role] || { ar: u.role, en: u.role, cls: "bg-muted text-muted-foreground" };
                  const name = u.profile?.full_name || (isRTL ? "مستخدم غير معروف" : "Unknown user");
                  return (
                    <tr key={u.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                            {name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{name}</p>
                            <p className="text-xs text-muted-foreground">{u.branch?.name || (isRTL ? "كل الفروع" : "All branches")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{info.jobTitle || "—"}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={role.cls}>{isRTL ? role.ar : role.en}</Badge></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono" dir="ltr">{info.phone || "—"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground">{info.salary ? `${info.salary.toLocaleString()} ر.س` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{info.hireDate || new Date(u.created_at).toLocaleDateString("ar-SA")}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-primary">{(monthSales[u.user_id] || 0).toLocaleString()} ر.س</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={u.is_active ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                          {u.is_active ? (isRTL ? "نشط" : "Active") : (isRTL ? "موقوف" : "Inactive")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" title={isRTL ? "تعديل بيانات الموظف" : "Edit employee info"} onClick={() => setEditing(u)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EditHRDialog
        user={editing}
        info={editing ? hr[editing.id] || {} : {}}
        onClose={() => setEditing(null)}
        onSave={(info) => { if (editing) { saveHR(editing.id, info); setEditing(null); } }}
        isRTL={isRTL}
      />
    </AppLayout>
  );
}

function EditHRDialog({ user, info, onClose, onSave, isRTL }: {
  user: MerchantUser | null;
  info: HRInfo;
  onClose: () => void;
  onSave: (info: HRInfo) => void;
  isRTL: boolean;
}) {
  const [form, setForm] = useState<HRInfo>(info);
  useEffect(() => { setForm(info); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            {isRTL ? "بيانات الموظف" : "Employee Info"} — {user?.profile?.full_name || ""}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>{isRTL ? "المسمى الوظيفي" : "Job Title"}</Label>
            <Input placeholder={isRTL ? "مثال: بائع أول، محاسب..." : "e.g. Senior Salesman"} value={form.jobTitle || ""} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isRTL ? "الراتب الشهري (ر.س)" : "Monthly Salary (SAR)"}</Label>
              <Input type="number" min={0} dir="ltr" value={form.salary ?? ""} onChange={e => setForm(f => ({ ...f, salary: Number(e.target.value) || undefined }))} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {isRTL ? "تاريخ التعيين" : "Hire Date"}</Label>
              <Input type="date" dir="ltr" value={form.hireDate || ""} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {isRTL ? "رقم الجوال" : "Phone"}</Label>
            <Input placeholder="05xxxxxxxx" dir="ltr" value={form.phone || ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
            <Textarea rows={2} placeholder={isRTL ? "ملاحظات إدارية عن الموظف..." : "Notes about the employee..."} value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={() => onSave(form)}>{isRTL ? "حفظ" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
