import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { MerchantUser } from '@/types/database';

// The section talks to Supabase through these hooks; they are stood in for
// here so the screen itself — what it offers whom — is what is under test.
const saveRole = vi.fn();
const deleteRole = vi.fn();
const assignCustomRole = vi.fn();
const saveSystemRole = vi.fn();
let permissions: string[] = [];
let members: MerchantUser[] = [];
let databaseReady = true;

vi.mock('@/hooks/useBranches', () => ({
  useMerchantUsers: () => ({
    users: members, loading: false, updateUserRole: vi.fn(), updateUserBranch: vi.fn(),
    deactivateUser: vi.fn(), refetch: vi.fn(),
  }),
  useBranches: () => ({ branches: [] }),
}));
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (k: string) => permissions.includes(k), canAny: () => true, loading: false }),
}));
vi.mock('@/hooks/useCustomRoles', () => ({
  useCustomRoles: () => ({
    roles: [{ id: 'r1', name: 'محاسب', description: null, permissions: ['reports.view'], memberCount: 1 }],
    catalog: [
      { key: 'reports.view', module: 'finance', name: 'عرض التقارير المالية', description: null },
      { key: 'invoices.view', module: 'finance', name: 'الاطلاع على الفواتير', description: null },
      { key: 'pos.access', module: 'sales', name: 'نقطة البيع', description: null },
    ],
    loading: false, databaseReady, refresh: vi.fn(), saveRole, deleteRole,
    systemRoles: {}, saveSystemRole,
  }),
  assignCustomRole: (...a: unknown[]) => assignCustomRole(...a),
  assignSystemRole: vi.fn(),
}));
vi.mock('@/i18n', () => ({ useLanguage: () => ({ t: {}, isRTL: true }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn() }, rpc: vi.fn().mockResolvedValue({ data: null }) },
}));

import UsersSection from './UsersSection';

// Radix's checkbox measures itself; jsdom has no ResizeObserver
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const member = (id: string, role: MerchantUser['role'], name: string, customRole?: { id: string; name: string }) => ({
  id, merchant_id: 'm', user_id: 'u' + id, role, is_active: true, created_at: '', updated_at: '',
  profile: { full_name: name }, customRole: customRole ?? null,
}) as unknown as MerchantUser;

describe('custom roles in users & permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    members = [
      member('1', 'owner', 'المالك'),
      member('2', 'custom', 'سارة', { id: 'r1', name: 'محاسب' }),
    ];
  });

  it('the member shows the role by its name; the roles are not listed under the users', () => {
    permissions = ['roles.manage', 'users.view', 'users.update'];
    render(<UsersSection />);
    // the member's badge carries the role's name, and nothing else lists it
    expect(screen.getAllByText('محاسب')).toHaveLength(1);
    expect(screen.queryByTitle('تعديل')).not.toBeInTheDocument();
  });

  it('an admin, who cannot manage roles, is not offered the editor', () => {
    permissions = ['users.view', 'users.update'];
    render(<UsersSection />);
    expect(screen.queryByTitle('تعديل')).not.toBeInTheDocument();
  });

  it('saves a new role with exactly the permissions ticked', async () => {
    permissions = ['roles.manage', 'users.view', 'users.update'];
    saveRole.mockResolvedValue({ id: 'r2' });
    render(<UsersSection />);

    fireEvent.click(screen.getByText('إضافة مستخدم جديد'));
    fireEvent.click(await screen.findByText('إنشاء دور مخصص'));
    const dialogs = await screen.findAllByRole('dialog');
    const dialog = dialogs[dialogs.length - 1];
    fireEvent.change(within(dialog).getByLabelText('اسم الدور'), { target: { value: 'مراجع' } });
    fireEvent.click(within(dialog).getByText('الاطلاع على الفواتير'));
    fireEvent.click(within(dialog).getByText('حفظ الدور'));

    await waitFor(() => expect(saveRole).toHaveBeenCalledWith(null, 'مراجع', '', ['invoices.view']));
  });

  it('refuses to save a role with no permissions', async () => {
    permissions = ['roles.manage'];
    render(<UsersSection />);
    fireEvent.click(screen.getByText('إضافة مستخدم جديد'));
    fireEvent.click(await screen.findByText('إنشاء دور مخصص'));
    const dialogs = await screen.findAllByRole('dialog');
    const dialog = dialogs[dialogs.length - 1];
    fireEvent.change(within(dialog).getByLabelText('اسم الدور'), { target: { value: 'فارغ' } });
    fireEvent.click(within(dialog).getByText('حفظ الدور'));
    expect(await within(dialog).findByText('اختر صلاحية واحدة على الأقل')).toBeInTheDocument();
    expect(saveRole).not.toHaveBeenCalled();
  });

  it('the permissions are listed even before the database has its table', async () => {
    permissions = ['roles.manage'];
    databaseReady = false;
    render(<UsersSection />);
    fireEvent.click(screen.getByText('إضافة مستخدم جديد'));
    fireEvent.click(await screen.findByText('إنشاء دور مخصص'));
    const dialogs = await screen.findAllByRole('dialog');
    const dialog = dialogs[dialogs.length - 1];
    expect(within(dialog).getByText('عرض التقارير المالية')).toBeInTheDocument();
    expect(within(dialog).queryByText(/يحتاج تحديث قاعدة البيانات/)).not.toBeInTheDocument();
    databaseReady = true;
  });


  // the row's ⋯ menu → edit (opened from the keyboard: jsdom has no pointer events)
  const openEdit = async (rowName: string) => {
    const row = screen.getAllByText(rowName).map(e => e.closest('.justify-between.p-4, [class~="p-4"][class~="justify-between"]')).find(Boolean) as HTMLElement;
    const trigger = within(row).getAllByRole('button').pop()!;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Edit|تعديل/ }));
    const dialogs = await screen.findAllByRole('dialog');
    return dialogs[dialogs.length - 1];
  };

  it('editing a custom-role member shows its permissions to tick, and saves them to the role', async () => {
    permissions = ['roles.manage', 'users.view', 'users.update'];
    saveRole.mockResolvedValue({ id: 'r1' });
    render(<UsersSection />);
    const dialog = await openEdit('سارة');
    const reports = within(dialog).getByRole('checkbox', { name: /عرض التقارير المالية/ });
    expect(reports).toHaveAttribute('data-state', 'checked');
    expect(reports).not.toBeDisabled();
    fireEvent.click(within(dialog).getByText('الاطلاع على الفواتير'));
    fireEvent.click(within(dialog).getByText('Save Changes'));
    await waitFor(() => expect(saveRole).toHaveBeenCalledWith('r1', 'محاسب', '', ['reports.view', 'invoices.view']));
  });

  it("the owner changes a cashier's permissions for the whole shop", async () => {
    permissions = ['roles.manage', 'users.view', 'users.update'];
    databaseReady = false;
    saveSystemRole.mockResolvedValue({});
    members = [...members, member('3', 'cashier', 'خالد')];
    render(<UsersSection />);
    const dialog = await openEdit('خالد');
    const pos = within(dialog).getByRole('checkbox', { name: /نقطة البيع/ });
    expect(pos).toHaveAttribute('data-state', 'checked');
    expect(pos).not.toBeDisabled();
    fireEvent.click(within(dialog).getByText('عرض التقارير المالية'));
    fireEvent.click(within(dialog).getByText('Save Changes'));
    // the cashier's own map (as far as the catalog goes) plus the report
    await waitFor(() => expect(saveSystemRole).toHaveBeenCalledWith('cashier', ['pos.access', 'reports.view']));
    databaseReady = true;
  });

  it('putting the defaults back stores nothing for the role', async () => {
    permissions = ['roles.manage', 'users.view', 'users.update'];
    databaseReady = false;
    saveSystemRole.mockResolvedValue({});
    members = [...members, member('3', 'cashier', 'خالد')];
    render(<UsersSection />);
    const dialog = await openEdit('خالد');
    fireEvent.click(within(dialog).getByText('عرض التقارير المالية'));
    fireEvent.click(within(dialog).getByText('الصلاحيات الافتراضية'));
    fireEvent.click(within(dialog).getByText('عرض التقارير المالية'));
    fireEvent.click(within(dialog).getByText('عرض التقارير المالية'));
    fireEvent.click(within(dialog).getByText('Save Changes'));
    await waitFor(() => expect(saveSystemRole).not.toHaveBeenCalled());
    databaseReady = true;
  });

  it('the admin holds every permission and is shown so, locked', async () => {
    permissions = ['roles.manage', 'users.view', 'users.update'];
    members = [...members, member('4', 'admin', 'نورة')];
    render(<UsersSection />);
    const dialog = await openEdit('نورة');
    for (const box of within(dialog).getAllByRole('checkbox')) {
      expect(box).toHaveAttribute('data-state', 'checked');
      expect(box).toBeDisabled();
    }
    expect(within(dialog).getByText('الأدمن يملك كل الصلاحيات.')).toBeInTheDocument();
  });

  it('adding a user: the chosen role shows its permissions, and changes are saved before the user is made', async () => {
    permissions = ['roles.manage', 'users.view', 'users.update'];
    databaseReady = false;
    saveSystemRole.mockResolvedValue({});
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: { access_token: 't' } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, login_code: '12345' }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<UsersSection />);
    fireEvent.click(screen.getByText('إضافة مستخدم جديد'));
    const dialogs = await screen.findAllByRole('dialog');
    const dialog = dialogs[dialogs.length - 1];
    // the default role, cashier: its own permissions, editable for the shop
    const pos = within(dialog).getByRole('checkbox', { name: /نقطة البيع/ });
    expect(pos).toHaveAttribute('data-state', 'checked');
    expect(pos).not.toBeDisabled();
    fireEvent.click(within(dialog).getByText('عرض التقارير المالية'));

    fireEvent.change(within(dialog).getByLabelText('الاسم الكامل'), { target: { value: 'ريم' } });
    fireEvent.change(within(dialog).getByLabelText('البريد الإلكتروني'), { target: { value: 'reem@x.sa' } });
    fireEvent.change(within(dialog).getByLabelText('كلمة المرور'), { target: { value: 'secret1' } });
    fireEvent.submit(within(dialog).getByLabelText('الاسم الكامل').closest('form')!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(saveSystemRole).toHaveBeenCalledWith('cashier', ['pos.access', 'reports.view']);
    expect(saveSystemRole.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    vi.unstubAllGlobals();
    databaseReady = true;
  });
});
