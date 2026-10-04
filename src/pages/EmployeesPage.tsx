import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus, Loader2, Pencil, Archive, Search, Users, ShieldAlert, Link2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/i18n';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmployees, type Employee, type EmployeeInput } from '@/hooks/useEmployees';
import { useBranches, useMerchantUsers } from '@/hooks/useBranches';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, { ar: string; en: string; cls: string }> = {
  active:   { ar: 'على رأس العمل', en: 'Active',   cls: 'bg-success/15 text-success' },
  inactive: { ar: 'موقوف',          en: 'Inactive', cls: 'bg-warning/15 text-warning' },
  archived: { ar: 'مؤرشف',          en: 'Archived', cls: 'bg-muted text-muted-foreground' },
};

const EMPTY: EmployeeInput = {
  full_name: '', employee_number: '', email: '', phone: '',
  job_title: '', department: '', hire_date: '', status: 'active',
  branch_id: null, merchant_user_id: null,
};

export default function EmployeesPage() {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const { can, loading: permsLoading } = usePermissions();
  const [showArchived, setShowArchived] = useState(false);
  const { employees, loading, createEmployee, updateEmployee, archiveEmployee } = useEmployees(showArchived);
  const { branches } = useBranches();
  const { users } = useMerchantUsers();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<EmployeeInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mayView   = can('employees.view');
  const mayCreate = can('employees.create');
  const mayUpdate = can('employees.update');

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => employees.filter(e =>
    !term ||
    e.full_name.toLowerCase().includes(term) ||
    (e.employee_number || '').toLowerCase().includes(term) ||
    (e.job_title || '').toLowerCase().includes(term) ||
    (e.phone || '').includes(term)
  ), [employees, term]);

  // Accounts not already linked to someone else
  const linkableUsers = useMemo(() => {
    const taken = new Set(employees.filter(e => e.id !== editing?.id).map(e => e.merchant_user_id));
    return users.filter(u => !taken.has(u.id));
  }, [users, employees, editing]);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setFormError(null); setCreating(true); };
  const openEdit = (employee: Employee) => {
    setForm({
      full_name: employee.full_name,
      employee_number: employee.employee_number || '',
      email: employee.email || '',
      phone: employee.phone || '',
      job_title: employee.job_title || '',
      department: employee.department || '',
      hire_date: employee.hire_date || '',
      status: employee.status,
      branch_id: employee.branch_id,
      merchant_user_id: employee.merchant_user_id,
    });
    setFormError(null);
    setEditing(employee);
  };

  const close = () => { setCreating(false); setEditing(null); setFormError(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setFormError(t ? 'اسم الموظف مطلوب' : 'The name is required');
      return;
    }

    setSaving(true);
    // Empty strings are not values — they would fail the unique index on
    // employee_number and store blanks for every optional field.
    const payload: EmployeeInput = {
      ...form,
      full_name: form.full_name.trim(),
      employee_number: form.employee_number?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      job_title: form.job_title?.trim() || null,
      department: form.department?.trim() || null,
      hire_date: form.hire_date || null,
    };

    const { error } = editing
      ? await updateEmployee(editing.id, payload)
      : await createEmployee(payload);

    setSaving(false);
    if (!error) close();
  };

  if (permsLoading) {
    return (
      <AppLayout title={t ? 'الموظفون' : 'Employees'}>
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  if (!mayView) {
    return (
      <AppLayout title={t ? 'الموظفون' : 'Employees'}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold mb-1">{t ? 'لا تملك صلاحية عرض الموظفين' : 'You cannot view employees'}</h2>
          <p className="text-muted-foreground max-w-sm">
            {t ? 'اطلب من صاحب المتجر منحك صلاحية «عرض الموظفين».' : 'Ask the owner for the employees.view permission.'}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={t ? 'الموظفون' : 'Employees'}
      subtitle={t ? 'سجل موظفي المتجر وربطهم بحسابات الدخول' : 'Staff records, and the accounts they sign in with'}
    >
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t ? 'ابحث بالاسم أو الرقم أو الوظيفة' : 'Search name, number or job title'}
            className="ps-9"
          />
        </div>

        <Button
          type="button"
          variant={showArchived ? 'secondary' : 'outline'}
          onClick={() => setShowArchived(v => !v)}
        >
          {t ? 'إظهار المؤرشفين' : 'Show archived'}
        </Button>

        {mayCreate && (
          <Button onClick={openCreate} className="ms-auto gap-2">
            <UserPlus className="w-4 h-4" />
            {t ? 'إضافة موظف' : 'Add employee'}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-14 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-semibold mb-1">
            {term
              ? (t ? 'لا نتائج مطابقة' : 'Nothing matches')
              : (t ? 'لم تُضف أي موظف بعد' : 'No employees yet')}
          </h3>
          {!term && mayCreate && (
            <p className="text-muted-foreground">
              {t ? 'أضف موظفيك ليظهروا هنا، واربط كل واحد بحساب دخوله.' : 'Add your staff, and link each to their login.'}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t ? 'الموظف' : 'Employee'}</TableHead>
              <TableHead className="text-center">{t ? 'الرقم' : 'Number'}</TableHead>
              <TableHead className="text-center">{t ? 'الوظيفة' : 'Job title'}</TableHead>
              <TableHead className="text-center">{t ? 'القسم' : 'Department'}</TableHead>
              <TableHead className="text-center">{t ? 'الفرع' : 'Branch'}</TableHead>
              <TableHead className="text-center">{t ? 'حساب الدخول' : 'Login'}</TableHead>
              <TableHead className="text-center">{t ? 'الحالة' : 'Status'}</TableHead>
              {mayUpdate && <TableHead className="text-end">{t ? 'إجراءات' : 'Actions'}</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((employee, i) => {
                const status = STATUS_LABEL[employee.status] || STATUS_LABEL.active;
                const branch = branches.find(b => b.id === employee.branch_id);
                return (
                  <motion.tr
                    key={employee.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 12) * 0.02 }}
                    className={cn('border-b border-border last:border-0', employee.status === 'archived' && 'opacity-60')}
                  >
                    <TableCell className="font-medium">
                      {employee.full_name}
                      {employee.phone && (
                        <span className="block text-xs text-muted-foreground font-mono" dir="ltr">{employee.phone}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{employee.employee_number || '—'}</TableCell>
                    <TableCell className="text-center">{employee.job_title || '—'}</TableCell>
                    <TableCell className="text-center">{employee.department || '—'}</TableCell>
                    <TableCell className="text-center">{branch?.name || '—'}</TableCell>
                    <TableCell className="text-center">
                      {employee.merchant_user_id
                        ? <Link2 className="w-4 h-4 text-success inline" aria-label={t ? 'مرتبط' : 'Linked'} />
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={status.cls}>{t ? status.ar : status.en}</Badge>
                    </TableCell>
                    {mayUpdate && (
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(employee)} title={t ? 'تعديل' : 'Edit'}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {employee.status !== 'archived' && (
                            <Button variant="ghost" size="sm" onClick={() => archiveEmployee(employee.id)} title={t ? 'أرشفة' : 'Archive'}>
                              <Archive className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={creating || !!editing} onOpenChange={open => !open && close()}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? (t ? 'تعديل موظف' : 'Edit employee') : (t ? 'إضافة موظف' : 'Add employee')}</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="full_name">{t ? 'الاسم الكامل' : 'Full name'} *</Label>
                <Input id="full_name" value={form.full_name}
                  onChange={e => { setForm({ ...form, full_name: e.target.value }); setFormError(null); }}
                  aria-invalid={!!formError} required />
                {formError && <p className="text-xs text-destructive mt-1">{formError}</p>}
              </div>

              <div>
                <Label htmlFor="employee_number">{t ? 'رقم الموظف' : 'Employee number'}</Label>
                <Input id="employee_number" value={form.employee_number || ''}
                  onChange={e => setForm({ ...form, employee_number: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phone">{t ? 'الجوال' : 'Phone'}</Label>
                <Input id="phone" dir="ltr" value={form.phone || ''}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="job_title">{t ? 'الوظيفة' : 'Job title'}</Label>
                <Input id="job_title" value={form.job_title || ''}
                  onChange={e => setForm({ ...form, job_title: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="department">{t ? 'القسم' : 'Department'}</Label>
                <Input id="department" value={form.department || ''}
                  onChange={e => setForm({ ...form, department: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="email">{t ? 'البريد' : 'Email'}</Label>
                <Input id="email" type="email" dir="ltr" value={form.email || ''}
                  onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="hire_date">{t ? 'تاريخ المباشرة' : 'Hire date'}</Label>
                <Input id="hire_date" type="date" value={form.hire_date || ''}
                  onChange={e => setForm({ ...form, hire_date: e.target.value })} />
              </div>

              <div>
                <Label>{t ? 'الفرع' : 'Branch'}</Label>
                <Select
                  value={form.branch_id || 'none'}
                  onValueChange={v => setForm({ ...form, branch_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t ? 'بدون فرع' : 'No branch'}</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t ? 'الحالة' : 'Status'}</Label>
                <Select
                  value={form.status || 'active'}
                  onValueChange={v => setForm({ ...form, status: v as Employee['status'] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['active', 'inactive', 'archived'] as const).map(s => (
                      <SelectItem key={s} value={s}>{t ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>{t ? 'حساب الدخول' : 'Login account'}</Label>
                <Select
                  value={form.merchant_user_id || 'none'}
                  onValueChange={v => setForm({ ...form, merchant_user_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t ? 'بدون حساب' : 'No account'}</SelectItem>
                    {linkableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.profile?.full_name || u.user_id.slice(0, 8)} · {u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {t
                    ? 'ليس كل موظف يحتاج حساباً — اتركه فارغاً لمن لا يستخدم النظام.'
                    : 'Not every employee needs a login — leave it empty for those who do not use the system.'}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>{t ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                {editing ? (t ? 'حفظ التعديلات' : 'Save changes') : (t ? 'إضافة' : 'Add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
