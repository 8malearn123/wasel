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
  Smartphone
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
import { useLanguage } from "@/i18n";
import { useTransfers } from "@/hooks/useTransfers";
import { useDevices, useAccessories } from "@/hooks/useInventory";
import { useAuth } from "@/hooks/useAuth";
import type { TransferStatus } from "@/types/database";

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

  return (
    <AppLayout title={t.transfers.title} subtitle={t.transfers.subtitle}>
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending Approval</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{inTransitCount}</p>
              <p className="text-sm text-muted-foreground">In Transit</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Check className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{transfers.filter(t => t.status === 'received').length}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-foreground">Transfer Requests</h2>
        <Button 
          className="gap-2 bg-gradient-primary hover:opacity-90"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" />
          New Transfer
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
            <p className="text-muted-foreground">No transfers yet</p>
            <Button 
              className="mt-4"
              onClick={() => setShowCreate(true)}
            >
              Create your first transfer
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transfers.map((transfer, index) => (
              <motion.div
                key={transfer.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="p-4 hover:bg-muted/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ArrowLeftRight className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{transfer.transfer_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {transfer.from_branch?.name} → {transfer.to_branch?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(transfer.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border",
                      statusColors[transfer.status]
                    )}>
                      {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                    </span>

                    {/* Actions based on status */}
                    {transfer.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-success border-success/20 hover:bg-success/10"
                          onClick={() => updateTransferStatus(transfer.id, 'approved')}
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-destructive border-destructive/20 hover:bg-destructive/10"
                          onClick={() => updateTransferStatus(transfer.id, 'cancelled')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {transfer.status === 'approved' && (
                      <Button 
                        size="sm"
                        onClick={() => updateTransferStatus(transfer.id, 'dispatched')}
                      >
                        <Truck className="w-4 h-4 mr-1" /> Dispatch
                      </Button>
                    )}
                    {transfer.status === 'dispatched' && (
                      <Button 
                        size="sm"
                        className="bg-success hover:bg-success/90"
                        onClick={() => updateTransferStatus(transfer.id, 'received')}
                      >
                        <Check className="w-4 h-4 mr-1" /> Receive
                      </Button>
                    )}
                  </div>
                </div>

                {/* Items */}
                {transfer.items && transfer.items.length > 0 && (
                  <div className="mt-3 pl-16 flex flex-wrap gap-2">
                    {transfer.items.map(item => (
                      <span 
                        key={item.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs"
                      >
                        {item.device_id ? (
                          <><Smartphone className="w-3 h-3" /> {item.device?.model}</>
                        ) : (
                          <><Package className="w-3 h-3" /> {item.accessory?.name} x{item.quantity}</>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
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
  const [loading, setLoading] = useState(false);
  const [fromBranch, setFromBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedAccessories, setSelectedAccessories] = useState<{ id: string; quantity: number }[]>([]);

  const availableDevices = devices.filter(d => d.branch_id === fromBranch);
  const availableAccessories = accessories.filter(a => a.branch_id === fromBranch && a.quantity > 0);

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
          <DialogTitle>Create Stock Transfer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Branch *</Label>
                <Select value={fromBranch} onValueChange={setFromBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Branch *</Label>
                <Select value={toBranch} onValueChange={setToBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
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
                <div className="space-y-2">
                  <Label>Select Devices</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {availableDevices.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">No devices available</p>
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
                  <Label>Select Accessories</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {availableAccessories.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">No accessories available</p>
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
                            <span className="text-xs text-muted-foreground">({a.quantity} avail)</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !fromBranch || !toBranch || (selectedDevices.length === 0 && selectedAccessories.length === 0)}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Transfer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
