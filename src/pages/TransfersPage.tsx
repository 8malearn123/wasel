import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeftRight, 
  Plus, 
  Loader2,
  Check,
  X,
  Truck,
  Package,
  Smartphone,
  ChevronDown,
  ScanLine
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/i18n";
import { useTransfers } from "@/hooks/useTransfers";
import { useDevices, useAccessories } from "@/hooks/useInventory";
import { useAuth } from "@/hooks/useAuth";
import type { TransferStatus } from "@/types/database";

const statusLabels: Record<TransferStatus, { ar: string; en: string }> = {
  pending: { ar: "بانتظار الموافقة", en: "Pending" },
  approved: { ar: "معتمد", en: "Approved" },
  dispatched: { ar: "بالطريق", en: "In transit" },
  received: { ar: "تم الاستلام", en: "Received" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

const statusColors: Record<TransferStatus, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-info/10 text-info border-info/20",
  dispatched: "bg-primary/10 text-primary border-primary/20",
  received: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20"
};

export default function TransfersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { t, isRTL } = useLanguage();
  const { branches } = useAuth();
  const { transfers, loading, createTransfer, updateTransferStatus } = useTransfers();
  const { devices } = useDevices();
  const { accessories } = useAccessories();

  const pendingCount = transfers.filter(t => t.status === 'pending').length;
  const inTransitCount = transfers.filter(t => t.status === 'dispatched').length;
  const receivedCount = transfers.filter(t => t.status === 'received').length;
  // Only one transfer's items are unfolded at a time
  const [openItems, setOpenItems] = useState<string | null>(null);

  return (
    <AppLayout title={t.transfers.title} subtitle={t.transfers.subtitle}>
      {/* A single line of counts instead of three cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 rounded-xl bg-card border border-border shadow-sm grid grid-cols-3 divide-x divide-border rtl:divide-x-reverse"
      >
        {[
          { count: pendingCount, label: isRTL ? "بانتظار الموافقة" : "Pending approval", tone: "text-warning" },
          { count: inTransitCount, label: isRTL ? "بالطريق" : "In transit", tone: "text-primary" },
          { count: receivedCount, label: isRTL ? "تم الاستلام" : "Received", tone: "text-success" },
        ].map(stat => (
          <div key={stat.label} className="px-4 text-center">
            <p className={cn("text-2xl font-bold", stat.tone)}>{stat.count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Actions */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-foreground">{isRTL ? "طلبات التحويل" : "Transfer requests"}</h2>
        <Button 
          className="gap-2 bg-gradient-primary hover:opacity-90"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" />
          {isRTL ? "تحويل جديد" : "New transfer"}
        </Button>
      </div>

      {/* Transfers List */}
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
        ) : transfers.length === 0 ? (
          <div className="text-center py-20">
            <ArrowLeftRight className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{isRTL ? "لا توجد تحويلات بعد" : "No transfers yet"}</p>
            <Button 
              className="mt-4"
              onClick={() => setShowCreate(true)}
            >
              {isRTL ? "أنشئ أول تحويل" : "Create your first transfer"}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transfers.map((transfer, index) => {
              const items = transfer.items || [];
              const itemNames = items.map(item =>
                item.device_id
                  ? item.device?.model || (isRTL ? "جهاز" : "Device")
                  : `${item.accessory?.name || (isRTL ? "إكسسوار" : "Accessory")} ×${item.quantity}`
              );
              const isOpen = openItems === transfer.id;

              return (
                <motion.div
                  key={transfer.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index, 10) * 0.03 }}
                  className="p-4 hover:bg-muted/20"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground font-mono text-sm">{transfer.transfer_number}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {transfer.from_branch?.name} ← {transfer.to_branch?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(transfer.created_at).toLocaleDateString(isRTL ? "ar-SA" : "en-GB")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border",
                        statusColors[transfer.status]
                      )}>
                        {isRTL ? statusLabels[transfer.status].ar : statusLabels[transfer.status].en}
                      </span>

                      {/* One step at a time: whatever this transfer is waiting for */}
                      {transfer.status === 'pending' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-success border-success/20 hover:bg-success/10"
                            onClick={() => updateTransferStatus(transfer.id, 'approved')}
                          >
                            <Check className="w-4 h-4 me-1" /> {isRTL ? "اعتماد" : "Approve"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title={isRTL ? "إلغاء التحويل" : "Cancel transfer"}
                            onClick={() => updateTransferStatus(transfer.id, 'cancelled')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {transfer.status === 'approved' && (
                        <Button size="sm" onClick={() => updateTransferStatus(transfer.id, 'dispatched')}>
                          <Truck className="w-4 h-4 me-1" /> {isRTL ? "إرسال" : "Dispatch"}
                        </Button>
                      )}
                      {transfer.status === 'dispatched' && (
                        <Button
                          size="sm"
                          className="bg-success hover:bg-success/90"
                          onClick={() => updateTransferStatus(transfer.id, 'received')}
                        >
                          <Check className="w-4 h-4 me-1" /> {isRTL ? "تأكيد الاستلام" : "Receive"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* The contents stay folded away — a line of text, not a wall of chips */}
                  {items.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setOpenItems(isOpen ? null : transfer.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
                        <span>
                          {isRTL ? `${items.length} صنف` : `${items.length} items`}
                          {" · "}
                          {itemNames.slice(0, 2).join(isRTL ? "، " : ", ")}
                          {items.length > 2 && (isRTL ? ` و${items.length - 2} غيرها` : ` and ${items.length - 2} more`)}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {items.map(item => (
                            <span 
                              key={item.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs"
                            >
                              {item.device_id ? (
                                <><Smartphone className="w-3 h-3" /> {item.device?.model}</>
                              ) : (
                                <><Package className="w-3 h-3" /> {item.accessory?.name} ×{item.quantity}</>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Create Transfer Dialog */}
      <CreateTransferDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        branches={branches}
        devices={devices.filter(d => d.status === 'available')}
        accessories={accessories}
        onCreate={createTransfer}
      />
    </AppLayout>
  );
}

function CreateTransferDialog({
  open,
  onOpenChange,
  branches,
  devices,
  accessories,
  onCreate
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string }[];
  devices: { id: string; model: string; imei: string; branch_id?: string }[];
  accessories: { id: string; name: string; sku: string; branch_id?: string; quantity: number }[];
  onCreate: (fromBranchId: string, toBranchId: string, items: any[], notes?: string) => Promise<any>;
}) {
  const { isRTL } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [fromBranch, setFromBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedAccessories, setSelectedAccessories] = useState<{ id: string; quantity: number }[]>([]);

  const availableDevices = devices.filter(d => d.branch_id === fromBranch);
  const availableAccessories = accessories.filter(a => a.branch_id === fromBranch && a.quantity > 0);

  // مسح الباركود / IMEI / رقم المنتج لإضافته للتحويل مباشرة
  const [scan, setScan] = useState('');
  const handleScan = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    if (!fromBranch) { toast.error('اختر الفرع المصدر أولاً'); return; }

    const dev = availableDevices.find(d => (d.imei || '').toLowerCase() === code.toLowerCase());
    if (dev) {
      if (selectedDevices.includes(dev.id)) toast.info(`${dev.model} مضاف مسبقاً`);
      else { setSelectedDevices(prev => [...prev, dev.id]); toast.success(`تمت إضافة ${dev.model}`); }
      setScan('');
      return;
    }

    const acc = availableAccessories.find(a => (a.sku || '').toLowerCase() === code.toLowerCase());
    if (acc) {
      setSelectedAccessories(prev => {
        const cur = prev.find(s => s.id === acc.id);
        if (cur) {
          if (cur.quantity >= acc.quantity) { toast.error(`الكمية المتاحة من ${acc.name} هي ${acc.quantity} فقط`); return prev; }
          toast.success(`${acc.name} — الكمية ${cur.quantity + 1}`);
          return prev.map(s => s.id === acc.id ? { ...s, quantity: s.quantity + 1 } : s);
        }
        toast.success(`تمت إضافة ${acc.name}`);
        return [...prev, { id: acc.id, quantity: 1 }];
      });
      setScan('');
      return;
    }

    toast.error('ما لقينا منتج بهذا الرقم في الفرع المصدر');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromBranch || !toBranch || fromBranch === toBranch) return;
    if (selectedDevices.length === 0 && selectedAccessories.length === 0) return;

    setLoading(true);
    
    const items = [
      ...selectedDevices.map(id => ({ type: 'device' as const, id, quantity: 1 })),
      ...selectedAccessories.map(({ id, quantity }) => ({ type: 'accessory' as const, id, quantity }))
    ];

    await onCreate(fromBranch, toBranch, items, notes || undefined);
    
    setLoading(false);
    onOpenChange(false);
    setFromBranch('');
    setToBranch('');
    setNotes('');
    setSelectedDevices([]);
    setSelectedAccessories([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isRTL ? "تحويل مخزون جديد" : "New stock transfer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? "من فرع *" : "From branch *"}</Label>
                <Select value={fromBranch} onValueChange={setFromBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر الفرع المصدر" : "Select source"} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "إلى فرع *" : "To branch *"}</Label>
                <Select value={toBranch} onValueChange={setToBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر الفرع المستلم" : "Select destination"} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.filter(b => b.id !== fromBranch).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {fromBranch && (
              <>
                {/* مسح الباركود / IMEI */}
                <div className="space-y-2">
                  <Label>مسح الباركود أو رقم المنتج</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                      <Input
                        value={scan}
                        onChange={(e) => setScan(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleScan(scan); }
                        }}
                        placeholder="امسح الباركود أو اكتب IMEI / SKU ثم Enter"
                        className="pr-9 font-mono"
                        autoFocus
                      />
                    </div>
                    <Button type="button" variant="outline" onClick={() => handleScan(scan)}>إضافة</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground"> قارئ الباركود يضيف المنتج تلقائياً · الأجهزة بالـ IMEI والإكسسوارات بالـ SKU
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{isRTL ? "الأجهزة" : "Devices"}</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {availableDevices.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">{isRTL ? "لا توجد أجهزة متاحة في هذا الفرع" : "No devices available"}</p>
                    ) : (
                      availableDevices.map(d => (
                        <label key={d.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedDevices.includes(d.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDevices([...selectedDevices, d.id]);
                              } else {
                                setSelectedDevices(selectedDevices.filter(id => id !== d.id));
                              }
                            }}
                          />
                          <Smartphone className="w-4 h-4 text-primary" />
                          <span className="text-sm">{d.model}</span>
                          <code className="text-xs text-muted-foreground">{d.imei}</code>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{isRTL ? "الإكسسوارات" : "Accessories"}</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {availableAccessories.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">{isRTL ? "لا توجد إكسسوارات متاحة في هذا الفرع" : "No accessories available"}</p>
                    ) : (
                      availableAccessories.map(a => {
                        const selected = selectedAccessories.find(s => s.id === a.id);
                        return (
                          <div key={a.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                            <input
                              type="checkbox"
                              checked={!!selected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAccessories([...selectedAccessories, { id: a.id, quantity: 1 }]);
                                } else {
                                  setSelectedAccessories(selectedAccessories.filter(s => s.id !== a.id));
                                }
                              }}
                            />
                            <Package className="w-4 h-4 text-accent" />
                            <span className="text-sm flex-1">{a.name}</span>
                            {selected && (
                              <Input
                                type="number"
                                min={1}
                                max={a.quantity}
                                value={selected.quantity}
                                onChange={(e) => {
                                  const qty = parseInt(e.target.value) || 1;
                                  setSelectedAccessories(selectedAccessories.map(s => 
                                    s.id === a.id ? { ...s, quantity: Math.min(qty, a.quantity) } : s
                                  ));
                                }}
                                className="w-16 h-7 text-sm"
                              />
                            )}
                            <span className="text-xs text-muted-foreground">{isRTL ? `متاح ${a.quantity}` : `${a.quantity} avail`}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isRTL ? "ملاحظات اختيارية..." : "Optional notes..."}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !fromBranch || !toBranch || (selectedDevices.length === 0 && selectedAccessories.length === 0)}
            >
              {loading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {isRTL ? "إنشاء التحويل" : "Create transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
