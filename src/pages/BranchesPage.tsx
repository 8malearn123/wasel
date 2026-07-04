import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Building2, 
  Plus, 
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Phone,
  MapPin,
  Warehouse,
  Smartphone,
  Package,
  AlertTriangle,
  Send,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/i18n";
import { useBranches } from "@/hooks/useBranches";
import { useBranchRequests } from "@/hooks/useBranchRequests";
import { useAuth } from "@/hooks/useAuth";
import { useDevices, useAccessories } from "@/hooks/useInventory";
import type { Branch } from "@/types/database";
import { cn } from "@/lib/utils";

const requestStatusBadge = (status: string) => {
  const map: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    pending_review: { label: 'قيد المراجعة', icon: Clock, className: 'bg-warning/15 text-warning' },
    pending_payment: { label: 'بانتظار الدفع', icon: AlertTriangle, className: 'bg-primary/15 text-primary' },
    activated: { label: 'مفعّل', icon: CheckCircle, className: 'bg-success/15 text-success' },
    rejected: { label: 'مرفوض', icon: XCircle, className: 'bg-destructive/15 text-destructive' },
  };
  const s = map[status] || { label: status, icon: Clock, className: 'bg-muted text-muted-foreground' };
  const Icon = s.icon;
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${s.className}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
};

export default function BranchesPage() {
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const { t, isRTL } = useLanguage();
  const { branches, loading, updateBranch, deleteBranch } = useBranches();
  const { requests, loading: requestsLoading, submitRequest } = useBranchRequests();
  const { subscription, merchantUser } = useAuth();
  const { devices } = useDevices();
  const { accessories } = useAccessories();

  const activeBranches = branches.filter(b => b.is_active);
  const warehouseCount = activeBranches.filter(b => b.is_warehouse).length;
  const branchLimit = subscription?.max_branches || 1;
  const isAtLimit = activeBranches.length >= branchLimit;
  const isOwner = merchantUser?.role === 'owner';

  return (
    <AppLayout title={t.branches.title} subtitle={t.branches.subtitle}>
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {activeBranches.length}
                <span className="text-sm text-muted-foreground">/{branchLimit}</span>
              </p>
              <p className="text-sm text-muted-foreground">الفروع النشطة</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{warehouseCount}</p>
              <p className="text-sm text-muted-foreground">المستودعات</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeBranches.length - warehouseCount}</p>
              <p className="text-sm text-muted-foreground">متاجر البيع</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {requests.filter(r => r.status === 'pending_review' || r.status === 'pending_payment').length}
              </p>
              <p className="text-sm text-muted-foreground">طلبات معلقة</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Limit Warning */}
      {isAtLimit && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">تم الوصول للحد الأقصى للفروع</p>
            <p className="text-sm text-muted-foreground">
              باقتك الحالية تسمح بـ {branchLimit} فرع فقط. يمكنك طلب إضافة فرع جديد أو ترقية باقتك.
            </p>
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex justify-end mb-6">
        {isOwner && (
          <Button 
            className="gap-2 bg-gradient-primary hover:opacity-90"
            onClick={() => setShowRequestDialog(true)}
          >
            <Send className="w-4 h-4" />
            طلب إضافة فرع جديد
          </Button>
        )}
      </div>

      {/* Branch Requests */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-foreground mb-3">طلبات الفروع</h3>
          <div className="space-y-2">
            {requests.map((req) => (
              <motion.div key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{req.branch_name}</p>
                  <p className="text-sm text-muted-foreground">{req.city || '—'} • {new Date(req.created_at).toLocaleDateString('ar-SA')}</p>
                  {req.admin_notes && req.status === 'rejected' && (
                    <p className="text-sm text-destructive mt-1">سبب الرفض: {req.admin_notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {req.invoice_amount && (
                    <span className="text-sm font-medium text-foreground">{req.invoice_amount} ر.س</span>
                  )}
                  {requestStatusBadge(req.status)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Branches Grid */}
      <h3 className="font-semibold text-foreground mb-3">الفروع النشطة</h3>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : activeBranches.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-card rounded-xl border border-border">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد فروع</p>
          </div>
        ) : (
          activeBranches.map((branch, index) => {
            const branchDevices = devices.filter(d => d.branch_id === branch.id && d.status === 'available');
            const branchAccessories = accessories.filter(a => a.branch_id === branch.id);
            const totalAccessoryQty = branchAccessories.reduce((sum, a) => sum + a.quantity, 0);

            return (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      branch.is_warehouse ? 'bg-accent/10' : 'bg-primary/10'
                    }`}>
                      {branch.is_warehouse ? (
                        <Warehouse className="w-6 h-6 text-accent" />
                      ) : (
                        <Building2 className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{branch.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        branch.is_warehouse 
                          ? 'bg-accent/10 text-accent' 
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {branch.is_warehouse ? 'مستودع' : 'متجر'}
                      </span>
                    </div>
                  </div>
                  {isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(branch)}>
                          <Edit className="w-4 h-4 mr-2" /> تعديل
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteBranch(branch.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> إزالة
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {branch.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {branch.address}
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {branch.phone}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      <span className="font-semibold">{branchDevices.length}</span> أجهزة
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-accent" />
                    <span className="text-sm">
                      <span className="font-semibold">{totalAccessoryQty}</span> إكسسوارات
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* Branch Request Dialog */}
      <BranchRequestDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
        onSubmit={submitRequest}
      />

      {/* Edit Dialog */}
      {editing && (
        <BranchEditDialog
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          branch={editing}
          onSave={async (data) => {
            await updateBranch(editing.id, data);
          }}
        />
      )}
    </AppLayout>
  );
}

function BranchRequestDialog({
  open, onOpenChange, onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, city: string, notes: string) => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await onSubmit(name, city, notes);
    setLoading(false);
    if (!result?.error) {
      onOpenChange(false);
      setName(''); setCity(''); setNotes('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>طلب إضافة فرع جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branchName">اسم الفرع *</Label>
              <Input id="branchName" value={name} onChange={(e) => setName(e.target.value)} placeholder="فرع الرياض" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">المدينة</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="الرياض" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تفاصيل إضافية عن الفرع..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BranchEditDialog({
  open, onOpenChange, branch, onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch;
  onSave: (data: Partial<Branch>) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: branch.name,
    address: branch.address || '',
    phone: branch.phone || '',
    is_warehouse: branch.is_warehouse,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({
      name: formData.name,
      address: formData.address || null,
      phone: formData.phone || null,
      is_warehouse: formData.is_warehouse,
    });
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل الفرع</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">اسم الفرع *</Label>
              <Input id="editName" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAddress">العنوان</Label>
              <Input id="editAddress" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">الهاتف</Label>
              <Input id="editPhone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="editWarehouse" className="cursor-pointer">مستودع</Label>
                <p className="text-sm text-muted-foreground">هذا الموقع مستودع وليس متجر بيع</p>
              </div>
              <Switch id="editWarehouse" checked={formData.is_warehouse} onCheckedChange={(checked) => setFormData({ ...formData, is_warehouse: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
