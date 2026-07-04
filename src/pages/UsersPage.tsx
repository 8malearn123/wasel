import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  Loader2,
  MoreHorizontal,
  Edit,
  UserX,
  Shield,
  Building2,
  Crown,
  ShieldCheck,
  Store,
  Wallet,
  KeyRound,
  UserPlus,
  Copy,
  Check
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useMerchantUsers, useBranches } from "@/hooks/useBranches";
import type { MerchantUser, UserRole } from "@/types/database";

const roleIcons: Record<UserRole, React.ReactNode> = {
  owner: <Crown className="w-4 h-4" />,
  admin: <ShieldCheck className="w-4 h-4" />,
  branch_manager: <Store className="w-4 h-4" />,
  cashier: <Wallet className="w-4 h-4" />,
  inventory_manager: <Building2 className="w-4 h-4" />
};

const roleColors: Record<UserRole, string> = {
  owner: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  admin: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  branch_manager: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  cashier: "bg-green-500/10 text-green-600 border-green-500/20",
  inventory_manager: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20"
};

const roleLabels: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  branch_manager: "Branch Manager",
  cashier: "Cashier",
  inventory_manager: "Inventory Manager"
};

export default function UsersPage() {
  const [editing, setEditing] = useState<MerchantUser | null>(null);
  const [resettingUser, setResettingUser] = useState<MerchantUser | null>(null);
  const [regeneratingCode, setRegeneratingCode] = useState<MerchantUser | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const { t } = useLanguage();
  const { users, loading, updateUserRole, updateUserBranch, deactivateUser, refetch } = useMerchantUsers();
  const { branches } = useBranches();

  const activeUsers = users.filter(u => u.is_active);
  const roleCounts = activeUsers.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AppLayout title={t.users.title} subtitle={t.users.subtitle}>
      {/* Add User Button */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowAddUser(true)} className="bg-primary">
          <UserPlus className="w-4 h-4 mr-2" />
          إضافة مستخدم جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeUsers.length}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
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
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{roleCounts['owner'] || 0}</p>
              <p className="text-sm text-muted-foreground">Owners</p>
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
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{roleCounts['admin'] || 0}</p>
              <p className="text-sm text-muted-foreground">Admins</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{roleCounts['cashier'] || 0}</p>
              <p className="text-sm text-muted-foreground">Cashiers</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Users List */}
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
        ) : activeUsers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activeUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="p-4 hover:bg-muted/20 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {user.profile?.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {user.profile?.full_name || 'Unknown User'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                        roleColors[user.role]
                      )}>
                        {roleIcons[user.role]}
                        {roleLabels[user.role]}
                      </span>
                      {user.branch && (
                        <span className="text-xs text-muted-foreground">
                          @ {user.branch.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(user)}>
                      <Edit className="w-4 h-4 mr-2" /> تعديل الصلاحية
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRegeneratingCode(user)}>
                      <KeyRound className="w-4 h-4 mr-2" /> تعيين كود دخول جديد
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setResettingUser(user)}>
                      <Shield className="w-4 h-4 mr-2" /> إعادة تعيين كلمة المرور
                    </DropdownMenuItem>
                    {user.role !== 'owner' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deactivateUser(user.id)}
                        >
                          <UserX className="w-4 h-4 mr-2" /> تعطيل
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Edit User Dialog */}
      <EditUserDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        user={editing}
        branches={branches}
        onSaveRole={updateUserRole}
        onSaveBranch={updateUserBranch}
      />

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={!!resettingUser}
        onOpenChange={(open) => !open && setResettingUser(null)}
        user={resettingUser}
      />

      {/* Regenerate Login Code Dialog */}
      <RegenerateCodeDialog
        open={!!regeneratingCode}
        onOpenChange={(open) => !open && setRegeneratingCode(null)}
        user={regeneratingCode}
        onSuccess={refetch}
      />

      {/* Add User Dialog */}
      <AddUserDialog
        open={showAddUser}
        onOpenChange={setShowAddUser}
        branches={branches}
        onSuccess={refetch}
      />
    </AppLayout>
  );
}

function EditUserDialog({
  open,
  onOpenChange,
  user,
  branches,
  onSaveRole,
  onSaveBranch
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: MerchantUser | null;
  branches: { id: string; name: string }[];
  onSaveRole: (userId: string, role: UserRole) => Promise<any>;
  onSaveBranch: (userId: string, branchId: string | null) => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole>(user?.role || 'cashier');
  const [branchId, setBranchId] = useState(user?.branch_id || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    if (role !== user.role) {
      await onSaveRole(user.id, role);
    }
    if (branchId !== user.branch_id) {
      await onSaveBranch(user.id, branchId === 'all' ? null : branchId || null);
    }
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>User</Label>
              <p className="text-sm text-muted-foreground">
                {user?.profile?.full_name || 'Unknown User'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={user?.role === 'owner'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="branch_manager">Branch Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="inventory_manager">Inventory Manager</SelectItem>
                </SelectContent>
              </Select>
              {user?.role === 'owner' && (
                <p className="text-xs text-muted-foreground">Owner role cannot be changed</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Assigned Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: MerchantUser | null;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            user_id: user.user_id,
            new_password: newPassword,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'حدث خطأ');
        return;
      }

      toast.success('تم تغيير كلمة المرور بنجاح');
      setNewPassword('');
      setConfirmPassword('');
      onOpenChange(false);
    } catch (err) {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            إعادة تعيين كلمة المرور
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label>المستخدم</Label>
              <p className="text-sm text-muted-foreground">
                {user?.profile?.full_name || 'مستخدم غير معروف'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              تغيير كلمة المرور
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RegenerateCodeDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: MerchantUser | null;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [codeMode, setCodeMode] = useState<'auto' | 'custom'>('auto');
  const [copied, setCopied] = useState(false);

  const generateCode = () => {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  };

  const handleSaveCode = async (code: string) => {
    if (!user) return;
    if (code.length !== 5 || !/^\d{5}$/.test(code)) {
      toast.error('الكود يجب أن يكون 5 أرقام');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('merchant_users')
        .update({ login_code: code })
        .eq('id', user.id);

      if (error) {
        toast.error('حدث خطأ في تعيين الكود');
        return;
      }

      setNewCode(code);
      onSuccess();
      toast.success('تم تعيين كود الدخول الجديد');
    } catch {
      toast.error('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewCode(null);
    setCustomCode('');
    setCodeMode('auto');
    setCopied(false);
    onOpenChange(false);
  };

  const copyCode = () => {
    if (!newCode) return;
    navigator.clipboard.writeText(newCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            تعيين كود دخول جديد
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <Label>المستخدم</Label>
            <p className="text-sm text-muted-foreground">
              {user?.profile?.full_name || 'مستخدم غير معروف'}
            </p>
          </div>

          {user?.login_code && !newCode && (
            <div className="bg-muted/50 rounded-lg p-3 border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">الكود الحالي</p>
              <p className="text-xl font-mono font-bold text-foreground tracking-[0.3em]">{user.login_code}</p>
            </div>
          )}

          {newCode ? (
            <div className="bg-primary/5 rounded-lg p-4 border-2 border-primary/20 text-center">
              <p className="text-sm text-muted-foreground mb-2">كود الدخول الجديد</p>
              <p className="text-3xl font-mono font-bold text-primary tracking-[0.3em]">{newCode}</p>
              <p className="text-xs text-muted-foreground mt-2">أرسل هذا الكود للموظف</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCodeMode('auto')}
                  className={cn(
                    "p-3 rounded-xl border-2 text-center transition-all",
                    codeMode === 'auto'
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <KeyRound className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">كود تلقائي</p>
                  <p className="text-xs opacity-70">النظام يختار رقم</p>
                </button>
                <button
                  type="button"
                  onClick={() => setCodeMode('custom')}
                  className={cn(
                    "p-3 rounded-xl border-2 text-center transition-all",
                    codeMode === 'custom'
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <Edit className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-sm font-medium">كود مخصص</p>
                  <p className="text-xs opacity-70">أنت تختار الرقم</p>
                </button>
              </div>

              {codeMode === 'custom' && (
                <div className="space-y-2">
                  <Label>أدخل الكود (5 أرقام)</Label>
                  <Input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="مثال: 12345"
                    className="text-center text-2xl font-mono tracking-[0.4em] h-14"
                    dir="ltr"
                    maxLength={5}
                    inputMode="numeric"
                  />
                  {customCode && customCode.length < 5 && (
                    <p className="text-xs text-amber-500 text-center">يجب إدخال 5 أرقام</p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                الكود القديم لن يعمل بعد التعيين
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {newCode ? (
            <>
              <Button variant="outline" onClick={copyCode}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'تم النسخ' : 'نسخ الكود'}
              </Button>
              <Button onClick={handleClose}>إغلاق</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>إلغاء</Button>
              <Button
                onClick={() => handleSaveCode(codeMode === 'auto' ? generateCode() : customCode)}
                disabled={loading || (codeMode === 'custom' && customCode.length !== 5)}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {codeMode === 'auto' ? 'توليد كود' : 'حفظ الكود'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddUserDialog({
  open,
  onOpenChange,
  branches,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string }[];
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('cashier');
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string; name: string; loginCode?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !fullName || !password) {
      setError('جميع الحقول مطلوبة');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            role,
            branch_id: branchId && branchId !== 'all' ? branchId : null,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'حدث خطأ');
        return;
      }

      setCreatedUser({ email, password, name: fullName, loginCode: result.login_code });
      onSuccess();
      toast.success('تم إنشاء المستخدم بنجاح');
    } catch (err) {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setFullName('');
    setPassword('');
    setRole('cashier');
    setBranchId('');
    setError('');
    setCreatedUser(null);
    setCopied(false);
    onOpenChange(false);
  };

  const copyCredentials = () => {
    if (!createdUser) return;
    const text = `بيانات الدخول:\nالاسم: ${createdUser.name}\n${createdUser.loginCode ? `كود الدخول: ${createdUser.loginCode}\n` : ''}البريد: ${createdUser.email}\nكلمة المرور: ${createdUser.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdUser) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              تم إنشاء المستخدم بنجاح
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              احفظ بيانات الدخول التالية وأرسلها للمستخدم:
            </p>
            {createdUser.loginCode && (
              <div className="bg-primary/5 rounded-lg p-4 border-2 border-primary/20 text-center">
                <p className="text-sm text-muted-foreground mb-2">كود الدخول السريع</p>
                <p className="text-3xl font-mono font-bold text-primary tracking-[0.3em]">{createdUser.loginCode}</p>
                <p className="text-xs text-muted-foreground mt-2">يقدر الموظف يسجل دخول بهذا الكود فقط</p>
              </div>
            )}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 border border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">الاسم:</span>
                <span className="font-medium text-foreground">{createdUser.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">البريد:</span>
                <span className="font-medium text-foreground dir-ltr">{createdUser.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">كلمة المرور:</span>
                <span className="font-mono font-bold text-foreground">{createdUser.password}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copyCredentials}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'تم النسخ' : 'نسخ البيانات'}
            </Button>
            <Button onClick={handleClose}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            إضافة مستخدم جديد
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="addFullName">الاسم الكامل</Label>
              <Input
                id="addFullName"
                placeholder="اسم المستخدم"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addEmail">البريد الإلكتروني</Label>
              <Input
                id="addEmail"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addPassword">كلمة المرور</Label>
              <div className="flex gap-2">
                <Input
                  id="addPassword"
                  type="text"
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  dir="ltr"
                  className="font-mono"
                />
                <Button type="button" variant="outline" size="sm" onClick={generatePassword} className="shrink-0">
                  توليد
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>الصلاحية</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="branch_manager">مدير فرع</SelectItem>
                  <SelectItem value="cashier">كاشير</SelectItem>
                  <SelectItem value="inventory_manager">مدير مخزون</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              إنشاء المستخدم
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
