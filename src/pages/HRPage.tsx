import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Briefcase, Users, Wallet, TrendingUp, Loader2, Pencil, Phone, CalendarDays,
  Target, Percent, Save, Printer, FileSpreadsheet,
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
import { useHRSettings, commissionFor, type HRSettings } from "@/hooks/useHRSettings";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

// الهدف والعمولة الخاصة بموظف واحد — تُحفظ في إعدادات الموارد البشرية (على السيرفر)
interface PerEmployeeHR {
  daily?: number;
  monthly?: number;
  rate?: number;
  commEnabled?: boolean;
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
  const { merchant, subscription } = useAuth();
  const { users, loading } = useMerchantUsers();
  const [hr, setHr] = useState<Record<string, HRInfo>>(loadHR);
  const [editing, setEditing] = useState<MerchantUser | null>(null);
  const [monthSales, setMonthSales] = useState<Record<string, number>>({});
  const [dailySales, setDailySales] = useState<Record<string, number>>({});
  const [monthProfit, setMonthProfit] = useState<Record<string, number>>({});
  const [dailyProfit, setDailyProfit] = useState<Record<string, number>>({});
  const { settings: hrSettings, save: saveHRSettings } = useHRSettings();
  const [showAttendanceReport, setShowAttendanceReport] = useState(false);
  const [showPayroll, setShowPayroll] = useState(false);
  const isMax = subscription?.plan === 'Distributor' || subscription?.plan === 'trial';
  // سجل الحضور: دخول/انصراف الكاشير من نقطة البيع (آخر ٧ أيام)
  const [attendance, setAttendance] = useState<Array<{ user_id: string; action: string; created_at: string }>>([]);

  useEffect(() => {
    if (!merchant) return;
    (async () => {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("activity_logs")
        .select("user_id, action, created_at")
        .eq("merchant_id", merchant.id)
        .in("action", ["pos_check_in", "pos_check_out"])
        .gte("created_at", from.toISOString())
        .order("created_at", { ascending: true })
        .limit(1000);
      setAttendance((data || []).filter(r => r.user_id) as Array<{ user_id: string; action: string; created_at: string }>);
    })();
  }, [merchant]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(isRTL ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" });

  // دخول/انصراف اليوم لكل موظف: أول دخول وآخر انصراف
  const todayKey = new Date().toDateString();
  const todayAttendance: Record<string, { in?: string; out?: string }> = {};
  for (const r of attendance) {
    if (new Date(r.created_at).toDateString() !== todayKey) continue;
    const rec = todayAttendance[r.user_id] || {};
    if (r.action === "pos_check_in" && !rec.in) rec.in = r.created_at;
    if (r.action === "pos_check_out") rec.out = r.created_at;
    todayAttendance[r.user_id] = rec;
  }

  // سجل آخر ٧ أيام: لكل (موظف، يوم) أول دخول وآخر انصراف
  const historyMap: Record<string, { user_id: string; day: string; in?: string; out?: string }> = {};
  for (const r of attendance) {
    const day = new Date(r.created_at).toDateString();
    const key = `${r.user_id}|${day}`;
    const rec = historyMap[key] || { user_id: r.user_id, day };
    if (r.action === "pos_check_in" && !rec.in) rec.in = r.created_at;
    if (r.action === "pos_check_out") rec.out = r.created_at;
    historyMap[key] = rec;
  }
  const history = Object.values(historyMap).sort((a, b) =>
    new Date(b.in || b.out || 0).getTime() - new Date(a.in || a.out || 0).getTime()
  );

  // مبيعات وأرباح كل موظف — لهذا الشهر ولليوم (تُستخدم للأهداف والعمولات)
  useEffect(() => {
    if (!merchant) return;
    (async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: salesRows } = await supabase
        .from("sales")
        .select("id, sold_by, total_amount, sale_date")
        .eq("merchant_id", merchant.id)
        .gte("sale_date", start.toISOString())
        .limit(3000);

      const mSales: Record<string, number> = {};
      const dSales: Record<string, number> = {};
      const saleOwner: Record<string, { by: string; today: boolean }> = {};
      for (const s of salesRows || []) {
        if (!s.sold_by) continue;
        const isToday = new Date(s.sale_date) >= today;
        mSales[s.sold_by] = (mSales[s.sold_by] || 0) + Number(s.total_amount || 0);
        if (isToday) dSales[s.sold_by] = (dSales[s.sold_by] || 0) + Number(s.total_amount || 0);
        saleOwner[s.id] = { by: s.sold_by, today: isToday };
      }
      setMonthSales(mSales);
      setDailySales(dSales);

      // الأرباح = (سعر البيع - التكلفة) × الكمية من بنود الفواتير
      const ids = Object.keys(saleOwner);
      const mProfit: Record<string, number> = {};
      const dProfit: Record<string, number> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, quantity, unit_price, cost_at_sale")
          .in("sale_id", chunk);
        for (const it of items || []) {
          const owner = saleOwner[it.sale_id];
          if (!owner) continue;
          const profit = (Number(it.unit_price || 0) - Number(it.cost_at_sale || 0)) * Number(it.quantity || 0);
          mProfit[owner.by] = (mProfit[owner.by] || 0) + profit;
          if (owner.today) dProfit[owner.by] = (dProfit[owner.by] || 0) + profit;
        }
      }
      setMonthProfit(mProfit);
      setDailyProfit(dProfit);
    })();
  }, [merchant]);

  // أساس احتساب العمولة حسب الإعدادات (يومي/شهري × مبيعات/أرباح)
  const commissionBase = (userId: string) => {
    const { period, basis } = hrSettings.commission;
    if (period === 'daily') return basis === 'profit' ? (dailyProfit[userId] || 0) : (dailySales[userId] || 0);
    return basis === 'profit' ? (monthProfit[userId] || 0) : (monthSales[userId] || 0);
  };

  const saveHR = (muId: string, info: HRInfo) => {
    const next = { ...hr, [muId]: info };
    setHr(next);
    try { localStorage.setItem(HR_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    toast.success(isRTL ? "تم حفظ بيانات الموظف" : "Employee info saved");
  };

  // حفظ هدف/عمولة خاصة بموظف — القيمة الفارغة تعني اتباع إعداد الفريق العام
  const savePerEmployee = async (userId: string, p: PerEmployeeHR) => {
    const targetsPer = { ...(hrSettings.targets.perEmployee || {}) };
    const commPer = { ...(hrSettings.commission.perEmployee || {}) };

    const t: { daily?: number; monthly?: number } = {};
    if (p.daily !== undefined) t.daily = p.daily;
    if (p.monthly !== undefined) t.monthly = p.monthly;
    if (Object.keys(t).length) targetsPer[userId] = t; else delete targetsPer[userId];

    const c: { rate?: number; enabled?: boolean } = {};
    if (p.rate !== undefined) c.rate = p.rate;
    if (p.commEnabled !== undefined) c.enabled = p.commEnabled;
    if (Object.keys(c).length) commPer[userId] = c; else delete commPer[userId];

    const unchanged =
      JSON.stringify(hrSettings.targets.perEmployee?.[userId] ?? null) === JSON.stringify(targetsPer[userId] ?? null) &&
      JSON.stringify(hrSettings.commission.perEmployee?.[userId] ?? null) === JSON.stringify(commPer[userId] ?? null);
    if (unchanged) return;

    await saveHRSettings({
      targets: { ...hrSettings.targets, perEmployee: targetsPer },
      commission: { ...hrSettings.commission, perEmployee: commPer },
    });
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

      {/* أهداف المبيعات والعمولات — باقة ماكس */}
      {isMax && (
        <TargetsAndCommissions
          settings={hrSettings}
          onSave={saveHRSettings}
          teamDaily={users.reduce((s, u) => s + (dailySales[u.user_id] || 0), 0)}
          teamMonthly={teamMonthSales}
          isRTL={isRTL}
        />
      )}

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
                    ...(isMax ? [
                      isRTL ? "الهدف" : "Target",
                      isRTL ? "العمولة" : "Commission",
                    ] : []),
                    isRTL ? "دخول اليوم" : "Check-in",
                    isRTL ? "انصراف اليوم" : "Check-out",
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
                      {isMax && (() => {
                        const isDaily = hrSettings.commission.period === 'daily';
                        const perT = hrSettings.targets.perEmployee?.[u.user_id];
                        const target = isDaily
                          ? (perT?.daily ?? hrSettings.targets.daily)
                          : (perT?.monthly ?? hrSettings.targets.monthly);
                        const achieved = isDaily ? (dailySales[u.user_id] || 0) : (monthSales[u.user_id] || 0);
                        const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
                        const comm = commissionFor(hrSettings, u.user_id, commissionBase(u.user_id));
                        return (
                          <>
                            <td className="px-4 py-3">
                              {target > 0 ? (
                                <div className="min-w-[110px]" title={perT ? (isRTL ? "هدف خاص بهذا الموظف" : "Custom target for this employee") : undefined}>
                                  <div className="flex items-center justify-between text-[11px] mb-1">
                                    <span className={pct >= 100 ? "text-success font-bold" : "text-muted-foreground"}>{pct}%</span>
                                    <span className={perT ? "text-primary font-semibold" : "text-muted-foreground"}>{target.toLocaleString()}</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className={pct >= 100 ? "h-full bg-success" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              ) : <span className="text-sm text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {comm.enabled ? (
                                <div>
                                  <p className="text-sm font-bold text-success">{Math.round(comm.value).toLocaleString()} ر.س</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {comm.rate}% {hrSettings.commission.basis === 'profit' ? (isRTL ? 'من الأرباح' : 'of profit') : (isRTL ? 'من المبيعات' : 'of sales')}
                                  </p>
                                </div>
                              ) : <span className="text-sm text-muted-foreground">—</span>}
                            </td>
                          </>
                        );
                      })()}
                      <td className="px-4 py-3 text-sm font-semibold text-success" dir="ltr">
                        {todayAttendance[u.user_id]?.in ? fmtTime(todayAttendance[u.user_id].in!) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-warning" dir="ltr">
                        {todayAttendance[u.user_id]?.out ? fmtTime(todayAttendance[u.user_id].out!) : "—"}
                      </td>
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

      {/* أزرار الطباعة — كشف الحضور ومسير الرواتب */}
      {isMax && users.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowAttendanceReport(true)}>
            <Printer className="w-4 h-4 me-2" />
            {isRTL ? "طباعة كشف حضور موظف" : "Print attendance sheet"}
          </Button>
          <Button variant="outline" onClick={() => setShowPayroll(true)}>
            <FileSpreadsheet className="w-4 h-4 me-2" />
            {isRTL ? "طباعة مسير الرواتب الشهري" : "Print monthly payroll"}
          </Button>
        </div>
      )}

      {/* سجل الحضور — آخر ٧ أيام */}
      {history.length > 0 && (
        <div className="mt-6 bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-bold text-sm">{isRTL ? "سجل الحضور — آخر ٧ أيام" : "Attendance Log — Last 7 Days"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isRTL ? "الدخول يسجَّل تلقائياً عند فتح الكاشير نقطة البيع، والانصراف عند تسجيل الخروج" : "Check-in is recorded when the cashier opens the POS; check-out on sign-out"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {[isRTL ? "اليوم" : "Day", isRTL ? "الموظف" : "Employee", isRTL ? "الدخول" : "Check-in", isRTL ? "الانصراف" : "Check-out", isRTL ? "مدة الدوام" : "Duration"].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-xs font-medium text-muted-foreground text-right whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {history.map(rec => {
                  const emp = users.find(u => u.user_id === rec.user_id);
                  const empName = emp?.profile?.full_name || (isRTL ? "موظف" : "Employee");
                  const dur = rec.in && rec.out
                    ? Math.max(0, new Date(rec.out).getTime() - new Date(rec.in).getTime())
                    : null;
                  const durText = dur !== null
                    ? `${Math.floor(dur / 3600000)}${isRTL ? "س" : "h"} ${Math.floor((dur % 3600000) / 60000)}${isRTL ? "د" : "m"}`
                    : "—";
                  return (
                    <tr key={`${rec.user_id}-${rec.day}`} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-sm text-foreground">
                        {new Date(rec.in || rec.out || Date.now()).toLocaleDateString(isRTL ? "ar-SA" : "en-US", { weekday: "long", day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{empName}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-success" dir="ltr">{rec.in ? fmtTime(rec.in) : "—"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-warning" dir="ltr">{rec.out ? fmtTime(rec.out) : "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground" dir="ltr">{durText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AttendanceReportDialog
        open={showAttendanceReport}
        onClose={() => setShowAttendanceReport(false)}
        users={users}
        merchantId={merchant?.id}
        merchantName={merchant?.name || ""}
        isRTL={isRTL}
      />

      <PayrollDialog
        open={showPayroll}
        onClose={() => setShowPayroll(false)}
        users={users}
        hr={hr}
        hrSettings={hrSettings}
        merchantId={merchant?.id}
        merchantName={merchant?.name || ""}
        isRTL={isRTL}
      />

      <EditHRDialog
        user={editing}
        info={editing ? hr[editing.id] || {} : {}}
        settings={hrSettings}
        isMax={isMax}
        onClose={() => setEditing(null)}
        onSave={(info, per) => {
          if (!editing) return;
          saveHR(editing.id, info);
          if (isMax) savePerEmployee(editing.user_id, per);
          setEditing(null);
        }}
        isRTL={isRTL}
      />
    </AppLayout>
  );
}

// فتح نافذة طباعة بمحتوى HTML جاهز (عربي RTL)
function printHTML(title: string, body: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { toast.error("المتصفح منع فتح نافذة الطباعة"); return; }
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;padding:28px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      .sub{color:#666;font-size:12px;margin-bottom:18px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
      th,td{border:1px solid #ddd;padding:8px;text-align:right}
      th{background:#f5f5f5;font-weight:700}
      tfoot td{font-weight:800;background:#fafafa}
      .sign{margin-top:44px;display:flex;justify-content:space-between;font-size:13px}
      .sign div{width:45%;border-top:1px solid #999;padding-top:6px;text-align:center}
      @media print{body{padding:0}}
    </style></head><body>${body}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// كشف حضور وانصراف موظف خلال فترة محددة
function AttendanceReportDialog({ open, onClose, users, merchantId, merchantName, isRTL }: {
  open: boolean; onClose: () => void; users: MerchantUser[];
  merchantId?: string; merchantName: string; isRTL: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const [userId, setUserId] = useState("all");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!merchantId) return;
    setBusy(true);
    try {
      const start = new Date(from); start.setHours(0, 0, 0, 0);
      const end = new Date(to); end.setHours(23, 59, 59, 999);
      let q = supabase
        .from("activity_logs")
        .select("user_id, action, created_at")
        .eq("merchant_id", merchantId)
        .in("action", ["pos_check_in", "pos_check_out"])
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true })
        .limit(5000);
      if (userId !== "all") {
        const u = users.find(x => x.id === userId);
        if (u) q = q.eq("user_id", u.user_id);
      }
      const { data } = await q;

      const map: Record<string, { user_id: string; day: string; in?: string; out?: string }> = {};
      for (const r of data || []) {
        if (!r.user_id) continue;
        const day = new Date(r.created_at).toDateString();
        const k = `${r.user_id}|${day}`;
        const rec = map[k] || { user_id: r.user_id, day };
        if (r.action === "pos_check_in" && !rec.in) rec.in = r.created_at;
        if (r.action === "pos_check_out") rec.out = r.created_at;
        map[k] = rec;
      }
      const rows = Object.values(map).sort((a, b) =>
        new Date(a.in || a.day).getTime() - new Date(b.in || b.day).getTime());

      if (rows.length === 0) { toast.info("ما فيه سجلات حضور في هذه الفترة"); setBusy(false); return; }

      const fmt = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "—";
      let totalMs = 0;
      const trs = rows.map(r => {
        const name = users.find(u => u.user_id === r.user_id)?.profile?.full_name || "موظف";
        const ms = r.in && r.out ? Math.max(0, new Date(r.out).getTime() - new Date(r.in).getTime()) : 0;
        totalMs += ms;
        const dur = r.in && r.out ? `${Math.floor(ms / 3600000)}س ${Math.floor((ms % 3600000) / 60000)}د` : "—";
        return `<tr><td>${new Date(r.in || r.day).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</td>
          <td>${name}</td><td>${fmt(r.in)}</td><td>${fmt(r.out)}</td><td>${dur}</td></tr>`;
      }).join("");

      const empLabel = userId === "all" ? "جميع الموظفين" : (users.find(u => u.id === userId)?.profile?.full_name || "موظف");
      printHTML("كشف الحضور والانصراف", `
        <h1>${merchantName} — كشف الحضور والانصراف</h1>
        <p class="sub">الموظف: ${empLabel} · الفترة: من ${new Date(from).toLocaleDateString("ar-SA")} إلى ${new Date(to).toLocaleDateString("ar-SA")} · تاريخ الطباعة: ${new Date().toLocaleDateString("ar-SA")}</p>
        <table>
          <thead><tr><th>اليوم</th><th>الموظف</th><th>الدخول</th><th>الانصراف</th><th>مدة الدوام</th></tr></thead>
          <tbody>${trs}</tbody>
          <tfoot><tr><td colspan="4">إجمالي ساعات الدوام</td><td>${Math.floor(totalMs / 3600000)}س ${Math.floor((totalMs % 3600000) / 60000)}د</td></tr></tfoot>
        </table>
        <div class="sign"><div>توقيع الموظف</div><div>توقيع المدير</div></div>
      `);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            {isRTL ? "طباعة كشف الحضور والانصراف" : "Print attendance sheet"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">{isRTL ? "الموظف" : "Employee"}</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "جميع الموظفين" : "All employees"}</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.profile?.full_name || (isRTL ? "موظف" : "Employee")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{isRTL ? "من تاريخ" : "From"}</Label>
              <Input type="date" className="mt-1" value={from} onChange={e => setFrom(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label className="text-xs">{isRTL ? "إلى تاريخ" : "To"}</Label>
              <Input type="date" className="mt-1" value={to} onChange={e => setTo(e.target.value)} dir="ltr" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Printer className="w-4 h-4 me-1" />}
            {isRTL ? "طباعة الكشف" : "Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// مسير الرواتب الشهري: الراتب + العمولة لكل موظف
function PayrollDialog({ open, onClose, users, hr, hrSettings, merchantId, merchantName, isRTL }: {
  open: boolean; onClose: () => void; users: MerchantUser[];
  hr: Record<string, HRInfo>; hrSettings: HRSettings;
  merchantId?: string; merchantName: string; isRTL: boolean;
}) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!merchantId) return;
    setBusy(true);
    try {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999);

      const { data: salesRows } = await supabase
        .from("sales")
        .select("id, sold_by, total_amount")
        .eq("merchant_id", merchantId)
        .gte("sale_date", start.toISOString())
        .lte("sale_date", end.toISOString())
        .limit(5000);

      const sales: Record<string, number> = {};
      const owner: Record<string, string> = {};
      for (const s of salesRows || []) {
        if (!s.sold_by) continue;
        sales[s.sold_by] = (sales[s.sold_by] || 0) + Number(s.total_amount || 0);
        owner[s.id] = s.sold_by;
      }

      const profit: Record<string, number> = {};
      const ids = Object.keys(owner);
      for (let i = 0; i < ids.length; i += 200) {
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, quantity, unit_price, cost_at_sale")
          .in("sale_id", ids.slice(i, i + 200));
        for (const it of items || []) {
          const by = owner[it.sale_id];
          if (!by) continue;
          profit[by] = (profit[by] || 0) + (Number(it.unit_price || 0) - Number(it.cost_at_sale || 0)) * Number(it.quantity || 0);
        }
      }

      let totalSalary = 0, totalComm = 0;
      const trs = users.map(u => {
        const info = hr[u.id] || {};
        const salary = Number(info.salary || 0);
        const base = hrSettings.commission.basis === "profit" ? (profit[u.user_id] || 0) : (sales[u.user_id] || 0);
        const comm = commissionFor(hrSettings, u.user_id, base);
        totalSalary += salary;
        totalComm += comm.value;
        return `<tr>
          <td>${u.profile?.full_name || "موظف"}</td>
          <td>${info.jobTitle || "—"}</td>
          <td>${salary ? salary.toLocaleString() : "—"}</td>
          <td>${(sales[u.user_id] || 0).toLocaleString()}</td>
          <td>${comm.enabled ? `${Math.round(comm.value).toLocaleString()} (${comm.rate}%)` : "—"}</td>
          <td>${Math.round(salary + comm.value).toLocaleString()}</td>
        </tr>`;
      }).join("");

      const monthLabel = start.toLocaleDateString("ar-SA", { month: "long", year: "numeric" });
      printHTML("مسير الرواتب", `
        <h1>${merchantName} — مسير الرواتب</h1>
        <p class="sub">الشهر: ${monthLabel} · العمولة محسوبة من ${hrSettings.commission.basis === "profit" ? "الأرباح" : "المبيعات"} · تاريخ الطباعة: ${new Date().toLocaleDateString("ar-SA")}</p>
        <table>
          <thead><tr><th>الموظف</th><th>المسمى الوظيفي</th><th>الراتب الأساسي</th><th>مبيعات الشهر</th><th>العمولة</th><th>الإجمالي المستحق</th></tr></thead>
          <tbody>${trs}</tbody>
          <tfoot><tr><td colspan="2">الإجمالي</td><td>${totalSalary.toLocaleString()}</td><td>—</td><td>${Math.round(totalComm).toLocaleString()}</td><td>${Math.round(totalSalary + totalComm).toLocaleString()} ر.س</td></tr></tfoot>
        </table>
        <div class="sign"><div>توقيع المحاسب</div><div>توقيع المدير</div></div>
      `);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            {isRTL ? "طباعة مسير الرواتب" : "Print payroll"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">{isRTL ? "الشهر" : "Month"}</Label>
            <Input type="month" className="mt-1" value={month} onChange={e => setMonth(e.target.value)} dir="ltr" />
          </div>
          <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-2.5">
            {isRTL
              ? "المسير يشمل الراتب الأساسي لكل موظف + عمولته المحسوبة من مبيعات/أرباح الشهر، مع خانات توقيع."
              : "Includes base salary plus commission with signature lines."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Printer className="w-4 h-4 me-1" />}
            {isRTL ? "طباعة المسير" : "Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// أهداف المبيعات (يومي/شهري) وإعدادات عمولة الموظفين — باقة ماكس
function TargetsAndCommissions({ settings, onSave, teamDaily, teamMonthly, isRTL }: {
  settings: HRSettings;
  onSave: (s: HRSettings) => Promise<void> | void;
  teamDaily: number;
  teamMonthly: number;
  isRTL: boolean;
}) {
  const [form, setForm] = useState<HRSettings>(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(settings); }, [settings]);

  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const dayPct = form.targets.daily > 0 ? Math.min(100, Math.round((teamDaily / form.targets.daily) * 100)) : 0;
  const monPct = form.targets.monthly > 0 ? Math.min(100, Math.round((teamMonthly / form.targets.monthly) * 100)) : 0;

  const setTarget = (k: 'daily' | 'monthly', v: number) =>
    setForm(f => ({ ...f, targets: { ...f.targets, [k]: v } }));
  const setComm = (patch: Partial<HRSettings['commission']>) =>
    setForm(f => ({ ...f, commission: { ...f.commission, ...patch } }));

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      {/* الأهداف */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Target className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h3 className="font-bold text-sm">{isRTL ? 'أهداف المبيعات' : 'Sales Targets'}</h3>
            <p className="text-[11px] text-muted-foreground">{isRTL ? 'حدد هدف الفريق اليومي والشهري' : 'Set daily and monthly team targets'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{isRTL ? 'الهدف اليومي (ر.س)' : 'Daily target'}</Label>
            <Input type="number" min={0} className="mt-1 h-9" value={form.targets.daily || ''}
              onChange={e => setTarget('daily', Number(e.target.value) || 0)} placeholder="5000" />
          </div>
          <div>
            <Label className="text-xs">{isRTL ? 'الهدف الشهري (ر.س)' : 'Monthly target'}</Label>
            <Input type="number" min={0} className="mt-1 h-9" value={form.targets.monthly || ''}
              onChange={e => setTarget('monthly', Number(e.target.value) || 0)} placeholder="150000" />
          </div>
        </div>

        {/* تقدم الفريق */}
        {[
          { label: isRTL ? 'إنجاز اليوم' : 'Today', pct: dayPct, val: teamDaily, target: form.targets.daily },
          { label: isRTL ? 'إنجاز الشهر' : 'This month', pct: monPct, val: teamMonthly, target: form.targets.monthly },
        ].filter(r => r.target > 0).map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={r.pct >= 100 ? 'font-bold text-success' : 'font-semibold text-foreground'}>
                {r.val.toLocaleString()} / {r.target.toLocaleString()} ر.س ({r.pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={r.pct >= 100 ? 'h-full bg-success' : 'h-full bg-primary'} style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* العمولات */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <Percent className="w-[18px] h-[18px]" />
            </span>
            <div>
              <h3 className="font-bold text-sm">{isRTL ? 'عمولات الموظفين' : 'Employee Commissions'}</h3>
              <p className="text-[11px] text-muted-foreground">{isRTL ? 'النسبة والفترة وأساس الاحتساب' : 'Rate, period and basis'}</p>
            </div>
          </div>
          <Switch checked={form.commission.enabled} onCheckedChange={v => setComm({ enabled: v })} />
        </div>

        {form.commission.enabled && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{isRTL ? 'نسبة العمولة (%)' : 'Commission rate (%)'}</Label>
              <Input type="number" min={0} max={100} step={0.5} className="mt-1 h-9"
                value={form.commission.rate}
                onChange={e => setComm({ rate: Number(e.target.value) || 0 })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{isRTL ? 'فترة الاحتساب' : 'Period'}</Label>
                <Select value={form.commission.period} onValueChange={(v: any) => setComm({ period: v })}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{isRTL ? 'يومية' : 'Daily'}</SelectItem>
                    <SelectItem value="monthly">{isRTL ? 'شهرية' : 'Monthly'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{isRTL ? 'تُحتسب من' : 'Based on'}</Label>
                <Select value={form.commission.basis} onValueChange={(v: any) => setComm({ basis: v })}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">{isRTL ? 'المبيعات' : 'Sales'}</SelectItem>
                    <SelectItem value="profit">{isRTL ? 'الأرباح' : 'Profit'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-2.5">
              {isRTL
                ? `كل موظف ياخذ ${form.commission.rate}% من ${form.commission.basis === 'profit' ? 'أرباح' : 'مبيعات'} ${form.commission.period === 'daily' ? 'اليوم' : 'الشهر'} — تظهر محسوبة في جدول الموظفين تحت`
                : `Each employee earns ${form.commission.rate}% of ${form.commission.basis} for the ${form.commission.period === 'daily' ? 'day' : 'month'}`}
            </p>
          </div>
        )}

        {dirty && (
          <Button size="sm" className="w-full" disabled={saving}
            onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }}>
            {saving ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}
            {isRTL ? 'حفظ الأهداف والعمولات' : 'Save targets & commissions'}
          </Button>
        )}
      </div>
    </div>
  );
}

function EditHRDialog({ user, info, settings, isMax, onClose, onSave, isRTL }: {
  user: MerchantUser | null;
  info: HRInfo;
  settings: HRSettings;
  isMax: boolean;
  onClose: () => void;
  onSave: (info: HRInfo, per: PerEmployeeHR) => void;
  isRTL: boolean;
}) {
  const [form, setForm] = useState<HRInfo>(info);
  const [per, setPer] = useState<PerEmployeeHR>({});
  useEffect(() => {
    setForm(info);
    if (!user) return;
    const t = settings.targets.perEmployee?.[user.user_id];
    const c = settings.commission.perEmployee?.[user.user_id];
    setPer({
      daily: t?.daily,
      monthly: t?.monthly,
      rate: c?.rate,
      commEnabled: c?.enabled ?? settings.commission.enabled,
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // رقم فارغ = اتبع إعداد الفريق العام
  const num = (v: string) => (v === "" ? undefined : Math.max(0, Number(v) || 0));

  const submit = () => onSave(form, {
    daily: per.daily,
    monthly: per.monthly,
    // النسبة والتفعيل يُحفظان فقط إذا اختلفا عن الإعداد العام
    rate: per.rate,
    commEnabled: per.commEnabled === settings.commission.enabled ? undefined : per.commEnabled,
  });

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] max-h-[88vh] overflow-y-auto">
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

          {/* الهدف والعمولة الخاصة بالموظف — باقة ماكس */}
          {isMax && (
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </span>
                <div>
                  <p className="font-bold text-xs">{isRTL ? "الهدف والعمولة الخاصة بالموظف" : "Employee target & commission"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL ? "اتركه فارغاً ليتبع إعداد الفريق العام" : "Leave empty to follow the team defaults"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "الهدف اليومي (ر.س)" : "Daily target (SAR)"}</Label>
                  <Input type="number" min={0} dir="ltr" className="h-9"
                    placeholder={settings.targets.daily ? String(settings.targets.daily) : (isRTL ? "بدون هدف" : "no target")}
                    value={per.daily ?? ""}
                    onChange={e => setPer(p => ({ ...p, daily: num(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "الهدف الشهري (ر.س)" : "Monthly target (SAR)"}</Label>
                  <Input type="number" min={0} dir="ltr" className="h-9"
                    placeholder={settings.targets.monthly ? String(settings.targets.monthly) : (isRTL ? "بدون هدف" : "no target")}
                    value={per.monthly ?? ""}
                    onChange={e => setPer(p => ({ ...p, monthly: num(e.target.value) }))} />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <Label className="text-xs">{isRTL ? "احتساب عمولة لهذا الموظف" : "Commission for this employee"}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {settings.commission.enabled
                      ? (isRTL ? `العام: مفعّلة ${settings.commission.rate}%` : `Team default: on ${settings.commission.rate}%`)
                      : (isRTL ? "العام: موقوفة" : "Team default: off")}
                  </p>
                </div>
                <Switch checked={!!per.commEnabled}
                  onCheckedChange={v => setPer(p => ({ ...p, commEnabled: v, rate: v ? p.rate : undefined }))} />
              </div>

              {per.commEnabled && (
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "نسبة العمولة (%)" : "Commission rate (%)"}</Label>
                  <Input type="number" min={0} max={100} step={0.5} dir="ltr" className="h-9"
                    placeholder={String(settings.commission.rate)}
                    value={per.rate ?? ""}
                    onChange={e => setPer(p => ({ ...p, rate: num(e.target.value) }))} />
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL
                      ? `تُحتسب من ${settings.commission.basis === "profit" ? "الأرباح" : "المبيعات"} ${settings.commission.period === "daily" ? "اليومية" : "الشهرية"} — فارغ = النسبة العامة (${settings.commission.rate}%)`
                      : `Based on ${settings.commission.period} ${settings.commission.basis} — empty = team rate (${settings.commission.rate}%)`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{isRTL ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit}>{isRTL ? "حفظ" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
