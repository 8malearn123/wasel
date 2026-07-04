import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ClipboardCheck,
  Plus,
  Search,
  Loader2,
  Eye,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Package,
  Smartphone,
  Wrench,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Save,
  Hash,
  Calendar,
  Building2,
  Printer,
  ScanBarcode,
  CalendarPlus,
  Clock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { cn } from "@/lib/utils";
import { useStocktake, Stocktake, StocktakeItem, StocktakeItemType } from "@/hooks/useStocktake";
import { useBranches } from "@/hooks/useBranches";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "جاري الجرد", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  completed: { label: "مكتمل", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  cancelled: { label: "ملغي", color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const itemTypeConfig: Record<StocktakeItemType, { label: string; icon: React.ElementType; color: string }> = {
  device: { label: "أجهزة", icon: Smartphone, color: "text-primary bg-primary/10" },
  accessory: { label: "إكسسوارات", icon: Package, color: "text-accent bg-accent/10" },
  repair_part: { label: "قطع صيانة", icon: Wrench, color: "text-amber-600 bg-amber-500/10" },
};

// ============ Schedule storage helpers ============
interface ScheduledStocktake {
  id: string;
  branchId: string;
  branchName: string;
  itemTypes: StocktakeItemType[];
  frequency: 'weekly' | 'monthly' | 'quarterly';
  nextDate: string;
  notes: string;
  createdAt: string;
}

function getSchedules(): ScheduledStocktake[] {
  try {
    return JSON.parse(localStorage.getItem('stocktake_schedules') || '[]');
  } catch { return []; }
}

function saveSchedules(s: ScheduledStocktake[]) {
  localStorage.setItem('stocktake_schedules', JSON.stringify(s));
}

// ============ Print helpers ============
function printStocktakeReport(stocktake: Stocktake, items: StocktakeItem[]) {
  const counted = items.filter(i => i.counted_quantity !== null);
  const discrepancies = counted.filter(i => (i.counted_quantity! - i.system_quantity) !== 0);
  const surplus = discrepancies.filter(i => (i.counted_quantity! - i.system_quantity) > 0);
  const shortage = discrepancies.filter(i => (i.counted_quantity! - i.system_quantity) < 0);

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير جرد - ${stocktake.stocktake_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; font-size: 12px; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 15px; }
  .header h1 { font-size: 20px; margin-bottom: 5px; }
  .header p { color: #666; font-size: 11px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 6px; }
  .info-item { display: flex; gap: 6px; }
  .info-label { font-weight: bold; color: #555; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
  .summary-card { text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 6px; }
  .summary-card .num { font-size: 22px; font-weight: bold; }
  .summary-card .label { font-size: 10px; color: #666; }
  .surplus { color: #16a34a; }
  .shortage { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  th { background: #333; color: white; padding: 8px 6px; font-size: 11px; text-align: right; }
  td { padding: 6px; border-bottom: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) { background: #fafafa; }
  .disc-row { background: #fef3c7 !important; }
  .text-center { text-align: center; }
  .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; color: #999; font-size: 10px; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
<div class="header">
  <h1>تقرير الجرد</h1>
  <p>${stocktake.stocktake_number} | ${format(new Date(stocktake.started_at), 'dd MMMM yyyy - HH:mm', { locale: ar })}</p>
</div>

<div class="info-grid">
  <div class="info-item"><span class="info-label">رقم الجرد:</span><span>${stocktake.stocktake_number}</span></div>
  <div class="info-item"><span class="info-label">الحالة:</span><span>${statusConfig[stocktake.status]?.label || stocktake.status}</span></div>
  <div class="info-item"><span class="info-label">الفرع:</span><span>${stocktake.branch?.name || 'جميع الفروع'}</span></div>
  <div class="info-item"><span class="info-label">تاريخ الطباعة:</span><span>${format(new Date(), 'dd/MM/yyyy HH:mm')}</span></div>
  ${stocktake.notes ? `<div class="info-item" style="grid-column:span 2"><span class="info-label">ملاحظات:</span><span>${stocktake.notes}</span></div>` : ''}
</div>

<div class="summary">
  <div class="summary-card"><div class="num">${items.length}</div><div class="label">إجمالي العناصر</div></div>
  <div class="summary-card"><div class="num">${counted.length}</div><div class="label">تم جردها</div></div>
  <div class="summary-card"><div class="num surplus">${surplus.length}</div><div class="label">فائض</div></div>
  <div class="summary-card"><div class="num shortage">${shortage.length}</div><div class="label">نقص</div></div>
</div>

${discrepancies.length > 0 ? `
<h3 style="margin-bottom:8px;color:#b45309;">⚠ التباينات المكتشفة (${discrepancies.length})</h3>
<table>
  <thead><tr><th>العنصر</th><th>SKU</th><th>النوع</th><th class="text-center">النظام</th><th class="text-center">الفعلي</th><th class="text-center">الفرق</th></tr></thead>
  <tbody>${discrepancies.map(d => {
    const diff = d.counted_quantity! - d.system_quantity;
    return `<tr class="disc-row"><td>${d.item_name}</td><td>${d.item_sku || '-'}</td><td>${itemTypeConfig[d.item_type]?.label || d.item_type}</td><td class="text-center">${d.system_quantity}</td><td class="text-center">${d.counted_quantity}</td><td class="text-center ${diff > 0 ? 'surplus' : 'shortage'}" style="font-weight:bold">${diff > 0 ? '+' : ''}${diff}</td></tr>`;
  }).join('')}</tbody>
</table>` : ''}

<h3 style="margin-bottom:8px;">جميع العناصر</h3>
<table>
  <thead><tr><th>#</th><th>العنصر</th><th>SKU</th><th>النوع</th><th class="text-center">النظام</th><th class="text-center">الفعلي</th><th class="text-center">الفرق</th></tr></thead>
  <tbody>${items.map((item, idx) => {
    const diff = item.counted_quantity !== null ? item.counted_quantity - item.system_quantity : null;
    const cls = diff !== null && diff !== 0 ? 'disc-row' : '';
    return `<tr class="${cls}"><td>${idx + 1}</td><td>${item.item_name}</td><td>${item.item_sku || '-'}</td><td>${itemTypeConfig[item.item_type]?.label || item.item_type}</td><td class="text-center">${item.system_quantity}</td><td class="text-center">${item.counted_quantity ?? '—'}</td><td class="text-center ${diff !== null ? (diff > 0 ? 'surplus' : diff < 0 ? 'shortage' : '') : ''}" style="font-weight:bold">${diff !== null ? (diff > 0 ? '+' + diff : diff) : '—'}</td></tr>`;
  }).join('')}</tbody>
</table>

<div class="footer">
  تم الطباعة بواسطة النظام | ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

// ============ Main Page ============
export default function StocktakePage() {
  const { stocktakes, loading, createStocktake, getStocktakeItems, updateItemCount, finalizeStocktake, cancelStocktake } = useStocktake();
  const { branches } = useBranches();
  const [showCreate, setShowCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [activeStocktake, setActiveStocktake] = useState<Stocktake | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = stocktakes.filter(s => {
    const matchSearch = !searchQuery || s.stocktake_number.includes(searchQuery);
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount = stocktakes.filter(s => s.status === 'in_progress').length;
  const completedCount = stocktakes.filter(s => s.status === 'completed').length;
  const totalDiscrepancies = stocktakes.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.discrepancy_count, 0);

  return (
    <AppLayout title="الجرد" subtitle="جرد المخزون ومطابقة الكميات">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stocktakes.length}</p>
              <p className="text-sm text-muted-foreground">إجمالي عمليات الجرد</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-sm text-muted-foreground">جرد نشط</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{completedCount}</p>
              <p className="text-sm text-muted-foreground">مكتمل</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalDiscrepancies}</p>
              <p className="text-sm text-muted-foreground">إجمالي التباينات</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="ابحث برقم الجرد..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(statusConfig).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setShowSchedule(true)}>
          <CalendarPlus className="w-4 h-4 mr-2" />
          جدولة جرد
        </Button>
        <Button onClick={() => setShowCreate(true)} className="bg-primary shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          جرد جديد
        </Button>
      </div>

      {/* Stocktakes List */}
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
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد عمليات جرد بعد</p>
            <Button onClick={() => setShowCreate(true)} className="mt-4" variant="outline">
              <Plus className="w-4 h-4 mr-2" /> إنشاء أول عملية جرد
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((stocktake, index) => {
              const st = statusConfig[stocktake.status] || statusConfig.draft;
              const progress = stocktake.total_items > 0
                ? Math.round((stocktake.counted_items / stocktake.total_items) * 100)
                : 0;

              return (
                <motion.div
                  key={stocktake.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/20">
                        <Hash className="w-3.5 h-3.5 text-primary mb-0.5" />
                        <span className="text-xs font-bold text-primary leading-none">
                          {stocktake.stocktake_number.replace('STK-', '').slice(-4)}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{stocktake.stocktake_number}</span>
                          {stocktake.branch?.name && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {stocktake.branch.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(stocktake.item_types || []).map((type: StocktakeItemType) => {
                            const cfg = itemTypeConfig[type];
                            if (!cfg) return null;
                            const Icon = cfg.icon;
                            return (
                              <span key={type} className={cn("text-xs px-2 py-0.5 rounded-full flex items-center gap-1", cfg.color)}>
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                            );
                          })}
                        </div>

                        {stocktake.status === 'in_progress' && stocktake.total_items > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        )}

                        {stocktake.status === 'completed' && (
                          <div className="flex items-center gap-3 mt-1 text-sm">
                            <span className="text-muted-foreground">{stocktake.counted_items}/{stocktake.total_items} عنصر</span>
                            {stocktake.discrepancy_count > 0 && (
                              <span className="text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {stocktake.discrepancy_count} تباين
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-left hidden sm:block">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(stocktake.started_at), 'dd MMM yyyy', { locale: ar })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{stocktake.total_items} عنصر</p>
                      </div>

                      <Badge variant="outline" className={cn("shrink-0", st.color)}>
                        {st.label}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setActiveStocktake(stocktake)}>
                            <Eye className="w-4 h-4 mr-2" />
                            {stocktake.status === 'in_progress' ? 'متابعة الجرد' : 'عرض التفاصيل'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={async () => {
                            const items = await getStocktakeItems(stocktake.id);
                            printStocktakeReport(stocktake, items);
                          }}>
                            <Printer className="w-4 h-4 mr-2" />
                            طباعة التقرير
                          </DropdownMenuItem>
                          {stocktake.status === 'in_progress' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => cancelStocktake(stocktake.id)}>
                                <XCircle className="w-4 h-4 mr-2" /> إلغاء الجرد
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      <CreateStocktakeDialog open={showCreate} onOpenChange={setShowCreate} branches={branches} onCreate={createStocktake} />
      <ScheduleDialog open={showSchedule} onOpenChange={setShowSchedule} branches={branches} />

      {activeStocktake && (
        <StocktakeDetailDialog
          stocktake={activeStocktake}
          open={!!activeStocktake}
          onOpenChange={(open) => !open && setActiveStocktake(null)}
          getItems={getStocktakeItems}
          updateCount={updateItemCount}
          onFinalize={finalizeStocktake}
          onRefresh={async () => {
            const { data } = await (await import('@/integrations/supabase/client')).supabase
              .from('stocktakes')
              .select('*, branch:branches(name)')
              .eq('id', activeStocktake.id)
              .single();
            if (data) setActiveStocktake(data as unknown as Stocktake);
          }}
        />
      )}
    </AppLayout>
  );
}

// ============ Create Stocktake Dialog ============
function CreateStocktakeDialog({ open, onOpenChange, branches, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  branches: { id: string; name: string }[];
  onCreate: (opts: any) => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);
  const [branchId, setBranchId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<StocktakeItemType[]>(['device', 'accessory', 'repair_part']);

  const toggleType = (type: StocktakeItemType) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleCreate = async () => {
    if (selectedTypes.length === 0) return;
    setLoading(true);
    await onCreate({ branch_id: branchId || undefined, item_types: selectedTypes, notes: notes || undefined });
    setLoading(false);
    setBranchId(""); setNotes(""); setSelectedTypes(['device', 'accessory', 'repair_part']);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء عملية جرد جديدة</DialogTitle>
          <DialogDescription>اختر الفرع ونوع المخزون المراد جرده</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>الفرع (اختياري)</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="جميع الفروع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>نوع المخزون</Label>
            <div className="mt-2 space-y-2">
              {(Object.entries(itemTypeConfig) as [StocktakeItemType, typeof itemTypeConfig.device][]).map(([type, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <label key={type} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                    <Checkbox checked={selectedTypes.includes(type)} onCheckedChange={() => toggleType(type)} />
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", cfg.color)}><Icon className="w-4 h-4" /></div>
                    <span className="font-medium text-foreground">{cfg.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات اختيارية..." className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleCreate} disabled={loading || selectedTypes.length === 0}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            بدء الجرد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Schedule Dialog ============
function ScheduleDialog({ open, onOpenChange, branches }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  branches: { id: string; name: string }[];
}) {
  const [schedules, setSchedules] = useState<ScheduledStocktake[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [nextDate, setNextDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<StocktakeItemType[]>(['device', 'accessory', 'repair_part']);

  useEffect(() => { if (open) setSchedules(getSchedules()); }, [open]);

  const freqLabels: Record<string, string> = { weekly: 'أسبوعي', monthly: 'شهري', quarterly: 'ربع سنوي' };

  const addSchedule = () => {
    const branch = branches.find(b => b.id === branchId);
    const newSchedule: ScheduledStocktake = {
      id: crypto.randomUUID(),
      branchId: branchId || '',
      branchName: branch?.name || 'جميع الفروع',
      itemTypes: selectedTypes,
      frequency, nextDate, notes,
      createdAt: new Date().toISOString(),
    };
    const updated = [...schedules, newSchedule];
    setSchedules(updated);
    saveSchedules(updated);
    setShowAdd(false);
    setBranchId(""); setNotes(""); setSelectedTypes(['device', 'accessory', 'repair_part']);
    toast.success('تمت جدولة الجرد بنجاح');
  };

  const removeSchedule = (id: string) => {
    const updated = schedules.filter(s => s.id !== id);
    setSchedules(updated);
    saveSchedules(updated);
    toast.success('تم حذف الجدولة');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-primary" />
            جدولة الجرد الدوري
          </DialogTitle>
          <DialogDescription>أنشئ جدولة دورية للتذكير بعمليات الجرد</DialogDescription>
        </DialogHeader>

        {!showAdd ? (
          <div className="space-y-3 py-2">
            {schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>لا توجد جدولات بعد</p>
              </div>
            ) : (
              schedules.map(s => (
                <div key={s.id} className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{freqLabels[s.frequency]}</Badge>
                      <span className="text-sm font-medium text-foreground">{s.branchName}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {s.itemTypes.map(t => {
                        const cfg = itemTypeConfig[t];
                        return cfg ? <span key={t} className={cn("text-xs px-1.5 py-0.5 rounded-full", cfg.color)}>{cfg.label}</span> : null;
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      الموعد القادم: {format(new Date(s.nextDate), 'dd MMM yyyy', { locale: ar })}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" onClick={() => removeSchedule(s.id)}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
            <Button onClick={() => setShowAdd(true)} variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" /> إضافة جدولة جديدة
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label>الفرع</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="جميع الفروع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>التكرار</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">أسبوعي</SelectItem>
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="quarterly">ربع سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>تاريخ الجرد القادم</Label>
              <Input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>نوع المخزون</Label>
              <div className="mt-2 flex gap-2 flex-wrap">
                {(Object.entries(itemTypeConfig) as [StocktakeItemType, typeof itemTypeConfig.device][]).map(([type, cfg]) => (
                  <label key={type} className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm",
                    selectedTypes.includes(type) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                  )}>
                    <Checkbox checked={selectedTypes.includes(type)} onCheckedChange={() => setSelectedTypes(p => p.includes(type) ? p.filter(t => t !== type) : [...p, type])} />
                    {cfg.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات اختيارية..." className="mt-1" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>رجوع</Button>
              <Button onClick={addSchedule} disabled={selectedTypes.length === 0}>
                <CalendarPlus className="w-4 h-4 mr-2" /> حفظ الجدولة
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ Stocktake Detail / Counting Dialog ============
function StocktakeDetailDialog({ stocktake, open, onOpenChange, getItems, updateCount, onFinalize, onRefresh }: {
  stocktake: Stocktake; open: boolean; onOpenChange: (v: boolean) => void;
  getItems: (id: string) => Promise<StocktakeItem[]>;
  updateCount: (itemId: string, qty: number, notes?: string) => Promise<boolean>;
  onFinalize: (id: string, adjust: boolean) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}) {
  const [items, setItems] = useState<StocktakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterView, setFilterView] = useState<string>("all");
  const [showFinalize, setShowFinalize] = useState(false);
  const [adjustInventory, setAdjustInventory] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [scannerMode, setScannerMode] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const scannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open && stocktake) loadItems(); }, [open, stocktake.id]);
  useEffect(() => { if (scannerMode && scannerRef.current) scannerRef.current.focus(); }, [scannerMode]);

  const loadItems = async () => {
    setLoading(true);
    const data = await getItems(stocktake.id);
    setItems(data);
    setLoading(false);
  };

  const handleCountChange = (itemId: string, value: string) => {
    const num = value === '' ? null : parseInt(value);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, counted_quantity: num as any } : i));
  };

  const handleSave = async (item: StocktakeItem) => {
    if (item.counted_quantity === null) return;
    setSavingId(item.id);
    await updateCount(item.id, item.counted_quantity, item.notes || undefined);
    setSavingId(null);
  };

  const handleSaveAll = async () => {
    const unsaved = items.filter(i => i.counted_quantity !== null);
    for (const item of unsaved) {
      await updateCount(item.id, item.counted_quantity!, item.notes || undefined);
    }
    await loadItems();
  };

  const handleFinalize = async () => {
    await onFinalize(stocktake.id, adjustInventory);
    setShowFinalize(false);
    await onRefresh();
    await loadItems();
  };

  // Barcode scan handler
  const handleScan = async (code: string) => {
    const found = items.find(i =>
      i.item_sku?.toLowerCase() === code.toLowerCase() ||
      i.item_name.toLowerCase().includes(code.toLowerCase())
    );
    if (found) {
      const newQty = (found.counted_quantity ?? 0) + 1;
      setItems(prev => prev.map(i => i.id === found.id ? { ...i, counted_quantity: newQty } : i));
      await updateCount(found.id, newQty);
      toast.success(`✅ ${found.item_name} — الكمية: ${newQty}`);
    } else {
      toast.error(`❌ لم يتم العثور على عنصر بالرمز: ${code}`);
    }
    setScannerInput("");
    scannerRef.current?.focus();
  };

  const filteredItems = items.filter(i => {
    const matchSearch = !searchQ ||
      i.item_name.toLowerCase().includes(searchQ.toLowerCase()) ||
      i.item_sku?.toLowerCase().includes(searchQ.toLowerCase());
    const matchType = filterType === "all" || i.item_type === filterType;
    const matchView = filterView === "all" ||
      (filterView === "uncounted" && i.counted_quantity === null) ||
      (filterView === "discrepancies" && i.counted_quantity !== null && (i.counted_quantity - i.system_quantity) !== 0);
    return matchSearch && matchType && matchView;
  });

  const totalItems = items.length;
  const countedItems = items.filter(i => i.counted_quantity !== null).length;
  const discrepancies = items.filter(i => i.counted_quantity !== null && (i.counted_quantity - i.system_quantity) !== 0);
  const surplusCount = discrepancies.filter(i => (i.counted_quantity! - i.system_quantity) > 0).length;
  const shortageCount = discrepancies.filter(i => (i.counted_quantity! - i.system_quantity) < 0).length;
  const isEditable = stocktake.status === 'in_progress';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{stocktake.stocktake_number}</span>
              <Badge variant="outline" className={statusConfig[stocktake.status]?.color}>
                {statusConfig[stocktake.status]?.label}
              </Badge>
            </DialogTitle>
            <DialogDescription className="flex items-center gap-4 flex-wrap">
              {stocktake.branch?.name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {stocktake.branch.name}</span>}
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(stocktake.started_at), 'dd MMM yyyy HH:mm', { locale: ar })}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3 py-3">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xl font-bold text-foreground">{totalItems}</p>
              <p className="text-xs text-muted-foreground">إجمالي العناصر</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 text-center">
              <p className="text-xl font-bold text-primary">{countedItems}</p>
              <p className="text-xs text-muted-foreground">تم جردها</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/5 text-center">
              <p className="text-xl font-bold text-green-600">{surplusCount}</p>
              <p className="text-xs text-muted-foreground">فائض</p>
            </div>
            <div className="p-3 rounded-lg bg-destructive/5 text-center">
              <p className="text-xl font-bold text-destructive">{shortageCount}</p>
              <p className="text-xs text-muted-foreground">نقص</p>
            </div>
          </div>

          {/* Progress */}
          {isEditable && totalItems > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.round((countedItems / totalItems) * 100)}%` }} />
              </div>
              <span className="text-sm font-medium text-muted-foreground">{Math.round((countedItems / totalItems) * 100)}%</span>
            </div>
          )}

          {/* Barcode Scanner */}
          {isEditable && scannerMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
              <form onSubmit={(e) => { e.preventDefault(); if (scannerInput.trim()) handleScan(scannerInput.trim()); }} className="flex gap-2">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                  <Input
                    ref={scannerRef}
                    value={scannerInput}
                    onChange={(e) => setScannerInput(e.target.value)}
                    placeholder="امسح الباركود أو أدخل SKU / IMEI..."
                    className="pr-11 h-11 text-base"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="h-11 px-5">
                  <Search className="w-4 h-4 mr-1" /> بحث
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                امسح الباركود وسيتم إضافة +1 للكمية الفعلية تلقائياً
              </p>
            </motion.div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ابحث بالاسم أو SKU..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pr-10 h-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="النوع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {Object.entries(itemTypeConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterView} onValueChange={setFilterView}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="uncounted">لم يُجرد</SelectItem>
                <SelectItem value="discrepancies">تباينات فقط</SelectItem>
              </SelectContent>
            </Select>
            {isEditable && (
              <Button variant={scannerMode ? "default" : "outline"} size="sm" className="h-9" onClick={() => setScannerMode(!scannerMode)}>
                <ScanBarcode className="w-4 h-4 mr-1" />
                باركود
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-9" onClick={() => printStocktakeReport(stocktake, items)}>
              <Printer className="w-4 h-4 mr-1" />
              طباعة
            </Button>
          </div>

          {/* Items Table */}
          <div className="flex-1 overflow-y-auto border border-border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">لا توجد عناصر مطابقة</div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/30 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">العنصر</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">النوع</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-center w-24">النظام</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-center w-32">الفعلي</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-center w-24">الفرق</th>
                    {isEditable && <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-center w-16"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item) => {
                    const cfg = itemTypeConfig[item.item_type];
                    const Icon = cfg?.icon || Package;
                    const disc = item.counted_quantity !== null ? (item.counted_quantity - item.system_quantity) : null;
                    const hasDisc = disc !== null && disc !== 0;

                    return (
                      <tr key={item.id} className={cn("hover:bg-muted/20", hasDisc && "bg-amber-500/5")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", cfg?.color)}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{item.item_name}</p>
                              {item.item_sku && <p className="text-xs text-muted-foreground font-mono">{item.item_sku}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", cfg?.color)}>{cfg?.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-foreground">{item.system_quantity}</td>
                        <td className="px-4 py-3 text-center">
                          {isEditable ? (
                            <Input type="number" min={0} value={item.counted_quantity ?? ''} onChange={(e) => handleCountChange(item.id, e.target.value)} className="w-20 mx-auto text-center h-8" placeholder="—" />
                          ) : (
                            <span className="font-semibold">{item.counted_quantity ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {disc !== null ? (
                            <span className={cn("font-bold text-sm flex items-center justify-center gap-1",
                              disc > 0 && "text-green-600", disc < 0 && "text-destructive", disc === 0 && "text-muted-foreground"
                            )}>
                              {disc > 0 && <TrendingUp className="w-3.5 h-3.5" />}
                              {disc < 0 && <TrendingDown className="w-3.5 h-3.5" />}
                              {disc === 0 && <CheckCircle2 className="w-3.5 h-3.5" />}
                              {disc > 0 ? `+${disc}` : disc}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        {isEditable && (
                          <td className="px-4 py-3 text-center">
                            {item.counted_quantity !== null && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSave(item)} disabled={savingId === item.id}>
                                {savingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-primary" />}
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Actions */}
          {isEditable && (
            <DialogFooter className="flex-row gap-2 justify-between sm:justify-between">
              <Button variant="outline" onClick={handleSaveAll}>
                <Save className="w-4 h-4 mr-2" /> حفظ الكل
              </Button>
              <Button onClick={() => setShowFinalize(true)} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4 mr-2" /> إنهاء الجرد
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Finalize Confirmation */}
      <Dialog open={showFinalize} onOpenChange={setShowFinalize}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنهاء عملية الجرد</DialogTitle>
            <DialogDescription>
              تم جرد {countedItems} من {totalItems} عنصر.
              {discrepancies.length > 0 && ` تم اكتشاف ${discrepancies.length} تباين.`}
            </DialogDescription>
          </DialogHeader>
          {discrepancies.length > 0 && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm font-medium text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> تباينات تم اكتشافها
                </p>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {discrepancies.map(d => (
                    <div key={d.id} className="text-xs flex justify-between text-foreground">
                      <span>{d.item_name}</span>
                      <span className={cn("font-mono font-bold",
                        (d.counted_quantity! - d.system_quantity) > 0 ? "text-green-600" : "text-destructive"
                      )}>
                        {(d.counted_quantity! - d.system_quantity) > 0 ? '+' : ''}{d.counted_quantity! - d.system_quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                <Checkbox checked={adjustInventory} onCheckedChange={(v) => setAdjustInventory(!!v)} />
                <div>
                  <p className="font-medium text-foreground text-sm">تعديل المخزون تلقائياً</p>
                  <p className="text-xs text-muted-foreground">سيتم تحديث الكميات في النظام لتتطابق مع الجرد الفعلي</p>
                </div>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalize(false)}>إلغاء</Button>
            <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4 mr-2" /> تأكيد الإنهاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
