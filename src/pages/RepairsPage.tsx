import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wrench,
  Plus,
  Search,
  Loader2,
  Phone,
  Smartphone,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  MoreHorizontal,
  ArrowRight,
  Package,
  DollarSign,
  User,
  FileText,
  Truck,
  Shield,
  ShieldOff,
  Timer,
  Hash,
  Printer,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useRepairs, RepairOrder, RepairStatus, CreateRepairInput } from "@/hooks/useRepairs";
import { useCustomers } from "@/hooks/useCustomers";
import { useDevices } from "@/hooks/useInventory";
import { useRepairParts, RepairPart, RepairOrderPart } from "@/hooks/useRepairParts";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";
import { RepairInvoiceDialog } from "@/components/repairs/RepairInvoiceDialog";
import { format, differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { ar } from "date-fns/locale";

// Simplified flow: older statuses (received/diagnosing/waiting_parts) display as "جاري الإصلاح"
const inProgressConfig = { label: "جاري الإصلاح", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20", icon: <Wrench className="w-3.5 h-3.5" /> };

const statusConfig: Record<RepairStatus, { label: string; color: string; icon: React.ReactNode }> = {
  received: inProgressConfig,
  diagnosing: inProgressConfig,
  waiting_parts: inProgressConfig,
  in_progress: inProgressConfig,
  completed: { label: "مكتمل", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  delivered: { label: "تم التسليم", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", icon: <Truck className="w-3.5 h-3.5" /> },
  warranty_expired: { label: "انتهى الضمان", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: <ShieldOff className="w-3.5 h-3.5" /> },
  cancelled: { label: "ملغي", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const statusFlow: RepairStatus[] = ['in_progress', 'completed', 'delivered'];

// Statuses shown in the filter dropdown
const filterStatuses: RepairStatus[] = ['in_progress', 'completed', 'delivered', 'warranty_expired', 'cancelled'];

// Legacy statuses collapse into "جاري الإصلاح"
const normalizeStatus = (s: RepairStatus): RepairStatus =>
  (['received', 'diagnosing', 'waiting_parts'] as RepairStatus[]).includes(s) ? 'in_progress' : s;

function getWarrantyRemaining(warrantyEndsAt: string | null) {
  if (!warrantyEndsAt) return null;
  const end = new Date(warrantyEndsAt);
  const now = new Date();
  if (end <= now) return { expired: true, text: "انتهى الضمان", days: 0, percentage: 0 };
  const days = differenceInDays(end, now);
  const hours = differenceInHours(end, now) % 24;
  if (days > 0) return { expired: false, text: `${days} يوم ${hours > 0 ? `و ${hours} ساعة` : ''}`, days, percentage: 100 };
  const mins = differenceInMinutes(end, now) % 60;
  return { expired: false, text: `${hours} ساعة ${mins > 0 ? `و ${mins} دقيقة` : ''}`, days: 0, percentage: 50 };
}

export default function RepairsPage() {
  const { repairs, loading, createRepair, updateRepairStatus, updateRepair } = useRepairs();
  const { parts: repairParts, usePartsInRepair, getRepairOrderParts } = useRepairParts();
  const { branches } = useBranches();
  const { merchant, currentBranch } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [viewRepair, setViewRepair] = useState<RepairOrder | null>(null);
  const [invoiceRepair, setInvoiceRepair] = useState<{ repair: RepairOrder; parts: RepairOrderPart[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Auto-refresh for warranty countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasActiveWarranty = repairs.some(r => r.status === 'delivered' && r.warranty_ends_at);
    if (!hasActiveWarranty) return;
    const interval = setInterval(() => setTick(t => t + 1), 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [repairs]);

  const filtered = repairs.filter((r) => {
    const matchesSearch =
      !searchQuery ||
      r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.repair_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customer_phone?.includes(searchQuery) ||
      r.device_model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.device_imei?.includes(searchQuery);
    const matchesStatus = filterStatus === "all" || normalizeStatus(r.status) === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = repairs.reduce((acc, r) => {
    const key = normalizeStatus(r.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeCount = repairs.filter(r => !['delivered', 'cancelled', 'warranty_expired'].includes(r.status)).length;
  const totalRevenue = repairs.filter(r => ['delivered', 'warranty_expired'].includes(r.status)).reduce((s, r) => s + (r.actual_cost || 0), 0);
  const underWarranty = repairs.filter(r => r.status === 'delivered' && r.warranty_ends_at && new Date(r.warranty_ends_at) > new Date()).length;

  return (
    <AppLayout title="الإصلاحات والصيانة" subtitle="إدارة طلبات الإصلاح وتتبع حالتها">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{repairs.length}</p>
              <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-sm text-muted-foreground">طلبات نشطة</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{underWarranty}</p>
              <p className="text-sm text-muted-foreground">تحت الضمان</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalRevenue.toLocaleString()} ر.س</p>
              <p className="text-sm text-muted-foreground">إيرادات الإصلاح</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم العميل، رقم الطلب، IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {filterStatuses.map((key) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-2">
                  {statusConfig[key].icon} {statusConfig[key].label}
                  {statusCounts[key] ? ` (${statusCounts[key]})` : ''}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreate(true)} className="bg-primary shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          طلب إصلاح جديد
        </Button>
      </div>

      {/* Repairs List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border border-border shadow-md overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Wrench className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || filterStatus !== "all" ? "لا توجد نتائج مطابقة" : "لا توجد طلبات إصلاح بعد"}
            </p>
            {!searchQuery && filterStatus === "all" && (
              <Button onClick={() => setShowCreate(true)} className="mt-4" variant="outline">
                <Plus className="w-4 h-4 mr-2" /> إنشاء أول طلب
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((repair, index) => (
              <RepairRow
                key={repair.id}
                repair={repair}
                index={index}
                onView={() => setViewRepair(repair)}
                onStatusChange={(status) => updateRepairStatus(repair.id, status)}
                onPrintInvoice={async () => {
                  const parts = await getRepairOrderParts(repair.id);
                  setInvoiceRepair({ repair, parts });
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      <CreateRepairDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        branches={branches}
        onCreate={createRepair}
      />

      <RepairDetailsDialog
        repair={viewRepair}
        open={!!viewRepair}
        onOpenChange={(open) => !open && setViewRepair(null)}
        onStatusChange={updateRepairStatus}
        onUpdate={updateRepair}
        repairParts={repairParts}
        onUseParts={usePartsInRepair}
        getRepairOrderParts={getRepairOrderParts}
        onPrintInvoice={async (repair, parts) => {
          setViewRepair(null);
          setInvoiceRepair({ repair, parts });
        }}
      />

      {invoiceRepair && (
        <RepairInvoiceDialog
          repair={invoiceRepair.repair}
          usedParts={invoiceRepair.parts}
          merchantName={merchant?.name || "Store"}
          branchName={currentBranch?.name || "Main"}
          onClose={() => setInvoiceRepair(null)}
        />
      )}
    </AppLayout>
  );
}

function RepairRow({
  repair,
  index,
  onView,
  onStatusChange,
  onPrintInvoice,
}: {
  repair: RepairOrder;
  index: number;
  onView: () => void;
  onStatusChange: (status: RepairStatus) => void;
  onPrintInvoice: () => void;
}) {
  const status = statusConfig[repair.status] || statusConfig.received;
  const nextStatus = statusFlow[statusFlow.indexOf(normalizeStatus(repair.status)) + 1];
  const warranty = getWarrantyRemaining(repair.warranty_ends_at);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="p-4 hover:bg-muted/20 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Repair Number Badge */}
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/20">
            <Hash className="w-3.5 h-3.5 text-primary mb-0.5" />
            <span className="text-xs font-bold text-primary leading-none">
              {repair.repair_number.replace('RPR-', '')}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground truncate">{repair.customer_name}</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                {repair.repair_number}
              </span>
              {repair.priority === 'urgent' && (
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              )}
              {repair.priority === 'high' && (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                {repair.device_brand} {repair.device_model || repair.device_type}
              </span>
              {repair.customer_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {repair.customer_phone}
                </span>
              )}
            </div>

            {/* Warranty countdown */}
            {repair.status === 'delivered' && warranty && !warranty.expired && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                  <Shield className="w-3 h-3" />
                  <span>ضمان: {warranty.text}</span>
                </div>
              </div>
            )}
            {repair.status === 'warranty_expired' && (
              <div className="flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 border border-gray-500/20 w-fit">
                <ShieldOff className="w-3 h-3" />
                <span>انتهت فترة الضمان</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-left hidden sm:block">
            {repair.estimated_cost > 0 && (
              <p className="text-sm font-semibold text-foreground">{repair.estimated_cost} ر.س</p>
            )}
            <p className="text-xs text-muted-foreground">
              {format(new Date(repair.received_at), 'dd MMM yyyy', { locale: ar })}
            </p>
          </div>

          <Badge variant="outline" className={cn("shrink-0 flex items-center gap-1", status.color)}>
            {status.icon}
            {status.label}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="w-4 h-4 mr-2" /> عرض التفاصيل
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPrintInvoice}>
                <Printer className="w-4 h-4 mr-2" /> طباعة الفاتورة
              </DropdownMenuItem>
              {nextStatus && !['cancelled', 'warranty_expired'].includes(repair.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onStatusChange(nextStatus)}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    نقل إلى: {statusConfig[nextStatus].label}
                  </DropdownMenuItem>
                </>
              )}
              {!['delivered', 'cancelled', 'warranty_expired'].includes(repair.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => onStatusChange('cancelled')}>
                    <XCircle className="w-4 h-4 mr-2" /> إلغاء الطلب
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}

function CreateRepairDialog({
  open,
  onOpenChange,
  branches,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string }[];
  onCreate: (input: CreateRepairInput) => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);
  const { customers } = useCustomers();
  const { devices } = useDevices();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showBrandSug, setShowBrandSug] = useState(false);
  const [showModelSug, setShowModelSug] = useState(false);

  const allBrands = [...new Set(devices.map(d => d.brand).filter(Boolean))] as string[];
  const allModels = [...new Set(devices.map(d => `${d.brand || ''}|${d.model}`))]
    .map(k => ({ brand: k.split('|')[0], model: k.split('|')[1] }));
  const [form, setForm] = useState<CreateRepairInput>({
    customer_name: '',
    customer_phone: '',
    device_type: 'smartphone',
    device_brand: '',
    device_model: '',
    device_imei: '',
    device_color: '',
    issue_description: '',
    priority: 'normal',
    estimated_cost: 0,
    warranty_days: 30,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name || !form.issue_description) return;

    setLoading(true);
    const { error } = await onCreate(form);
    setLoading(false);

    if (!error) {
      setForm({
        customer_name: '', customer_phone: '', device_type: 'smartphone',
        device_brand: '', device_model: '', device_imei: '', device_color: '',
        issue_description: '', priority: 'normal', estimated_cost: 0, warranty_days: 30, notes: '',
      });
      onOpenChange(false);
    }
  };

  const update = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            طلب إصلاح جديد
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="customer" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="customer">العميل</TabsTrigger>
              <TabsTrigger value="device">الجهاز</TabsTrigger>
              <TabsTrigger value="repair">الإصلاح</TabsTrigger>
            </TabsList>

            <TabsContent value="customer" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>اسم العميل *</Label>
                {(() => {
                  const q = form.customer_name.trim().toLowerCase();
                  const matches = q
                    ? customers.filter(c =>
                        c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)
                      ).slice(0, 6)
                    : [];
                  return (
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pr-9"
                        placeholder="ابحث باسم العميل أو رقم جواله..."
                        value={form.customer_name}
                        onChange={e => { update('customer_name', e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      />
                      {showSuggestions && q && (
                        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                          {matches.length > 0 ? (
                            matches.map(c => (
                              <button
                                type="button"
                                key={c.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  update('customer_name', c.name);
                                  if (c.phone) update('customer_phone', c.phone);
                                  setShowSuggestions(false);
                                }}
                                className="w-full text-right px-3 py-2.5 hover:bg-muted flex items-center justify-between gap-2 border-b border-border/50 last:border-0"
                              >
                                <span className="font-medium text-sm flex items-center gap-2">
                                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                                  {c.name}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono" dir="ltr">{c.phone || ''}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2.5 text-xs text-muted-foreground">
                              العميل غير مسجل — أكمل كتابة اسمه وسيُسجَّل الطلب بهذا الاسم ✍️
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input placeholder="05xxxxxxxx" value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} dir="ltr" />
              </div>
            </TabsContent>

            <TabsContent value="device" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>نوع الجهاز</Label>
                <Select value={form.device_type} onValueChange={v => update('device_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smartphone">هاتف ذكي</SelectItem>
                    <SelectItem value="tablet">تابلت</SelectItem>
                    <SelectItem value="laptop">لابتوب</SelectItem>
                    <SelectItem value="smartwatch">ساعة ذكية</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الماركة</Label>
                  {(() => {
                    const q = (form.device_brand || '').trim().toLowerCase();
                    const matches = allBrands.filter(b => !q || b.toLowerCase().includes(q)).slice(0, 6);
                    return (
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pr-9"
                          placeholder="ابحث: Apple, Samsung..."
                          value={form.device_brand}
                          onChange={e => { update('device_brand', e.target.value); setShowBrandSug(true); }}
                          onFocus={() => setShowBrandSug(true)}
                          onBlur={() => setTimeout(() => setShowBrandSug(false), 150)}
                        />
                        {showBrandSug && matches.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                            {matches.map(b => (
                              <button type="button" key={b}
                                onMouseDown={(e) => { e.preventDefault(); update('device_brand', b); setShowBrandSug(false); }}
                                className="w-full text-right px-3 py-2 hover:bg-muted text-sm border-b border-border/50 last:border-0">
                                {b}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <Label>الموديل</Label>
                  {(() => {
                    const q = (form.device_model || '').trim().toLowerCase();
                    const brandFilter = (form.device_brand || '').trim().toLowerCase();
                    const matches = allModels
                      .filter(m => (!brandFilter || m.brand.toLowerCase().includes(brandFilter)) && (!q || m.model.toLowerCase().includes(q)))
                      .slice(0, 6);
                    return (
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pr-9"
                          placeholder="ابحث: iPhone 15, S24..."
                          value={form.device_model}
                          onChange={e => { update('device_model', e.target.value); setShowModelSug(true); }}
                          onFocus={() => setShowModelSug(true)}
                          onBlur={() => setTimeout(() => setShowModelSug(false), 150)}
                        />
                        {showModelSug && matches.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                            {matches.map(m => (
                              <button type="button" key={`${m.brand}|${m.model}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  update('device_model', m.model);
                                  if (m.brand) update('device_brand', m.brand);
                                  setShowModelSug(false);
                                }}
                                className="w-full text-right px-3 py-2 hover:bg-muted text-sm flex items-center justify-between gap-2 border-b border-border/50 last:border-0">
                                <span className="font-medium">{m.model}</span>
                                <span className="text-xs text-muted-foreground">{m.brand}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IMEI</Label>
                  <Input placeholder="رقم IMEI" value={form.device_imei} onChange={e => update('device_imei', e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>اللون</Label>
                  <Input placeholder="أسود، أبيض..." value={form.device_color} onChange={e => update('device_color', e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="repair" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>وصف المشكلة *</Label>
                <Textarea placeholder="وصف تفصيلي للمشكلة..." value={form.issue_description} onChange={e => update('issue_description', e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الأولوية</Label>
                  <Select value={form.priority} onValueChange={v => update('priority', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفض</SelectItem>
                      <SelectItem value="normal">عادي</SelectItem>
                      <SelectItem value="high">مرتفع</SelectItem>
                      <SelectItem value="urgent">عاجل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>التكلفة المتوقعة</Label>
                  <Input type="number" placeholder="0" value={form.estimated_cost || ''} onChange={e => update('estimated_cost', parseFloat(e.target.value) || 0)} dir="ltr" />
                </div>
              </div>
              {/* Warranty Days */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  مدة الضمان (بالأيام)
                </Label>
                <div className="flex gap-2">
                  {[0, 7, 14, 30, 60, 90].map(d => (
                    <Button
                      key={d}
                      type="button"
                      variant={form.warranty_days === d ? "default" : "outline"}
                      size="sm"
                      onClick={() => update('warranty_days', d)}
                      className={cn("flex-1", form.warranty_days === d && "bg-primary")}
                    >
                      {d === 0 ? 'بدون' : `${d} يوم`}
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  placeholder="أو أدخل عدد مخصص..."
                  value={form.warranty_days || ''}
                  onChange={e => update('warranty_days', parseInt(e.target.value) || 0)}
                  dir="ltr"
                  className="mt-1"
                />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea placeholder="ملاحظات إضافية..." value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading || !form.customer_name || !form.issue_description}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              إنشاء طلب الإصلاح
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RepairDetailsDialog({
  repair,
  open,
  onOpenChange,
  onStatusChange,
  onUpdate,
  repairParts,
  onUseParts,
  getRepairOrderParts,
  onPrintInvoice,
}: {
  repair: RepairOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: RepairStatus) => Promise<any>;
  onUpdate: (id: string, updates: Partial<RepairOrder>) => Promise<any>;
  repairParts: RepairPart[];
  onUseParts: (repairOrderId: string, items: { partId: string; quantity: number }[]) => Promise<any>;
  getRepairOrderParts: (repairOrderId: string) => Promise<RepairOrderPart[]>;
  onPrintInvoice: (repair: RepairOrder, parts: RepairOrderPart[]) => void;
}) {
  const [diagnosisNotes, setDiagnosisNotes] = useState('');
  const [actualCost, setActualCost] = useState(0);
  const [partsCost, setPartsCost] = useState(0);
  const [saving, setSaving] = useState(false);
  const [usedParts, setUsedParts] = useState<RepairOrderPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedPartQty, setSelectedPartQty] = useState(1);
  const [addingPart, setAddingPart] = useState(false);

  // Load used parts when repair changes
  useEffect(() => {
    if (repair?.id && open) {
      getRepairOrderParts(repair.id).then(setUsedParts);
    }
  }, [repair?.id, open]);

  if (!repair) return null;

  const status = statusConfig[repair.status] || statusConfig.received;
  const nextStatus = statusFlow[statusFlow.indexOf(normalizeStatus(repair.status)) + 1];
  const warranty = getWarrantyRemaining(repair.warranty_ends_at);

  const handleSaveDetails = async () => {
    setSaving(true);
    await onUpdate(repair.id, {
      diagnosis_notes: diagnosisNotes || repair.diagnosis_notes,
      actual_cost: actualCost || repair.actual_cost,
      parts_cost: partsCost || repair.parts_cost,
    } as any);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              تفاصيل طلب الإصلاح
            </span>
            <Badge variant="outline" className={cn("flex items-center gap-1", status.color)}>
              {status.icon} {status.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Repair Number Banner */}
          <div className="flex items-center justify-between bg-primary/5 rounded-xl p-4 border border-primary/20">
            <div>
              <p className="text-xs text-muted-foreground">رقم الإصلاح</p>
              <p className="text-2xl font-bold font-mono text-primary">{repair.repair_number}</p>
            </div>
            {repair.warranty_days > 0 && (
              <div className="text-left">
                <p className="text-xs text-muted-foreground">مدة الضمان</p>
                <p className="text-lg font-bold text-foreground">{repair.warranty_days} يوم</p>
              </div>
            )}
          </div>

          {/* Warranty Status */}
          {repair.warranty_ends_at && (
            <div className={cn(
              "rounded-xl p-4 border flex items-center gap-3",
              warranty?.expired
                ? "bg-gray-500/5 border-gray-500/20"
                : "bg-green-500/5 border-green-500/20"
            )}>
              {warranty?.expired ? (
                <ShieldOff className="w-6 h-6 text-gray-500 shrink-0" />
              ) : (
                <Shield className="w-6 h-6 text-green-600 shrink-0" />
              )}
              <div className="flex-1">
                <p className={cn("font-semibold text-sm", warranty?.expired ? "text-gray-600" : "text-green-700")}>
                  {warranty?.expired ? "انتهت فترة الضمان" : "الجهاز تحت الضمان"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {warranty?.expired
                    ? `انتهى بتاريخ ${format(new Date(repair.warranty_ends_at), 'dd/MM/yyyy')}`
                    : `متبقي: ${warranty?.text} — ينتهي ${format(new Date(repair.warranty_ends_at), 'dd/MM/yyyy')}`
                  }
                </p>
              </div>
              {!warranty?.expired && (
                <div className="flex items-center gap-1 text-green-600">
                  <Timer className="w-4 h-4" />
                  <span className="text-sm font-bold">{warranty?.days || '<1'}d</span>
                </div>
              )}
            </div>
          )}

          {/* Status Progress */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {statusFlow.map((s, i) => {
              const conf = statusConfig[s];
              const currentIdx = statusFlow.indexOf(normalizeStatus(repair.status));
              const isActive = currentIdx >= i || (repair.status === 'warranty_expired' && i <= 5);
              const isCurrent = repair.status === s;
              return (
                <div key={s} className="flex items-center gap-1">
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all",
                    isCurrent ? conf.color : isActive ? "bg-muted text-muted-foreground border-border" : "bg-muted/50 text-muted-foreground/50 border-transparent"
                  )}>
                    {conf.icon}
                    <span className="hidden sm:inline">{conf.label}</span>
                  </div>
                  {i < statusFlow.length - 1 && (
                    <ArrowRight className={cn("w-3 h-3 shrink-0", isActive ? "text-muted-foreground" : "text-muted-foreground/30")} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Customer & Device Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3 bg-muted/30 rounded-lg p-4">
              <h4 className="font-semibold text-sm flex items-center gap-2"><User className="w-4 h-4" /> بيانات العميل</h4>
              <div>
                <p className="text-sm text-muted-foreground">الاسم</p>
                <p className="font-medium text-foreground">{repair.customer_name}</p>
              </div>
              {repair.customer_phone && (
                <div>
                  <p className="text-sm text-muted-foreground">الهاتف</p>
                  <p className="font-medium text-foreground dir-ltr">{repair.customer_phone}</p>
                </div>
              )}
            </div>

            <div className="space-y-3 bg-muted/30 rounded-lg p-4">
              <h4 className="font-semibold text-sm flex items-center gap-2"><Smartphone className="w-4 h-4" /> بيانات الجهاز</h4>
              <div>
                <p className="text-sm text-muted-foreground">الجهاز</p>
                <p className="font-medium text-foreground">{repair.device_brand} {repair.device_model}</p>
              </div>
              {repair.device_imei && (
                <div>
                  <p className="text-sm text-muted-foreground">IMEI</p>
                  <p className="font-mono text-sm text-foreground">{repair.device_imei}</p>
                </div>
              )}
              {repair.device_color && (
                <div>
                  <p className="text-sm text-muted-foreground">اللون</p>
                  <p className="text-foreground">{repair.device_color}</p>
                </div>
              )}
            </div>
          </div>

          {/* Issue */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2">وصف المشكلة</h4>
            <p className="text-sm text-foreground">{repair.issue_description}</p>
          </div>

          {/* Diagnosis & Costs */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ملاحظات الفحص / التشخيص</Label>
              <Textarea
                placeholder="أدخل ملاحظات الفحص..."
                defaultValue={repair.diagnosis_notes || ''}
                onChange={e => setDiagnosisNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تكلفة الإصلاح الفعلية</Label>
                <Input type="number" defaultValue={repair.actual_cost || ''} onChange={e => setActualCost(parseFloat(e.target.value) || 0)} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>تكلفة القطع</Label>
                <Input type="number" defaultValue={repair.parts_cost || ''} onChange={e => setPartsCost(parseFloat(e.target.value) || 0)} dir="ltr" />
              </div>
            </div>
          </div>

          {/* Parts Used Section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Package className="w-4 h-4" /> القطع المستخدمة
            </h4>

            {/* Already used parts */}
            {usedParts.length > 0 && (
              <div className="space-y-2">
                {usedParts.map((up) => (
                  <div key={up.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{(up.repair_part as any)?.name || 'قطعة'}</p>
                        <p className="text-xs text-muted-foreground">SKU: {(up.repair_part as any)?.sku}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">×{up.quantity}</p>
                      <p className="text-xs text-muted-foreground">{(up.unit_cost * up.quantity).toLocaleString()} ر.س</p>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <span>إجمالي تكلفة القطع</span>
                  <span>{usedParts.reduce((s, p) => s + p.unit_cost * p.quantity, 0).toLocaleString()} ر.س</span>
                </div>
              </div>
            )}

            {/* Add parts form */}
            {!['delivered', 'cancelled', 'warranty_expired'].includes(repair.status) && repairParts.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">القطعة</Label>
                  <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="اختر قطعة..." />
                    </SelectTrigger>
                    <SelectContent>
                      {repairParts.filter(p => p.quantity > 0).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.quantity} متوفر) — {p.cost} ر.س
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">الكمية</Label>
                  <Input
                    type="number"
                    min={1}
                    value={selectedPartQty}
                    onChange={e => setSelectedPartQty(parseInt(e.target.value) || 1)}
                    className="h-9 text-sm"
                    dir="ltr"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={!selectedPartId || addingPart}
                  onClick={async () => {
                    if (!selectedPartId) return;
                    setAddingPart(true);
                    const result = await onUseParts(repair.id, [{ partId: selectedPartId, quantity: selectedPartQty }]);
                    if (!result.error) {
                      const updated = await getRepairOrderParts(repair.id);
                      setUsedParts(updated);
                      // Auto-update parts_cost
                      const totalPartsCost = updated.reduce((s, p) => s + p.unit_cost * p.quantity, 0);
                      await onUpdate(repair.id, { parts_cost: totalPartsCost } as any);
                      setSelectedPartId('');
                      setSelectedPartQty(1);
                    }
                    setAddingPart(false);
                  }}
                >
                  {addingPart ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 ml-1" />}
                  سحب
                </Button>
              </div>
            )}

            {repairParts.length === 0 && usedParts.length === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد قطع صيانة في المخزون. أضف قطع من صفحة المخزون أولاً.</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">تاريخ الاستلام</p>
              <p className="font-medium">{format(new Date(repair.received_at), 'dd/MM/yyyy HH:mm')}</p>
            </div>
            {repair.completed_at && (
              <div>
                <p className="text-muted-foreground">تاريخ الإكمال</p>
                <p className="font-medium">{format(new Date(repair.completed_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            )}
            {repair.delivered_at && (
              <div>
                <p className="text-muted-foreground">تاريخ التسليم</p>
                <p className="font-medium">{format(new Date(repair.delivered_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            )}
            {repair.warranty_ends_at && (
              <div>
                <p className="text-muted-foreground">انتهاء الضمان</p>
                <p className="font-medium">{format(new Date(repair.warranty_ends_at), 'dd/MM/yyyy')}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => onPrintInvoice(repair, usedParts)}>
            <Printer className="w-4 h-4 mr-2" />
            طباعة الفاتورة
          </Button>
          <Button variant="outline" onClick={handleSaveDetails} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            حفظ التعديلات
          </Button>
          {nextStatus && !['cancelled', 'warranty_expired'].includes(repair.status) && (
            <Button onClick={() => { onStatusChange(repair.id, nextStatus); onOpenChange(false); }}>
              <ArrowRight className="w-4 h-4 mr-2" />
              نقل إلى: {statusConfig[nextStatus].label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
