import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { MerchantUser } from '@/types/database';

// The section talks to Supabase through these hooks; they are stood in for
// here so the screen itself — what it offers whom — is what is under test.
const saveRole = vi.fn();
const deleteRole = vi.fn();
const assignCustomRole = vi.fn();
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

  it('the owner manages roles; the member shows the role by its name', () => {
    permissions = ['roles.manage', 'users.view', 'users.update'];
    render(<UsersSection />);
    expect(screen.getByText('الأدوار المخصصة')).toBeInTheDocument();
    // the role's row and the member's badge both carry its name
    expect(screen.getAllByText('محاسب').length).toBeGreaterThanOrEqual(2);
  });

  it('an admin, who cannot manage roles, is not offered the editor', () => {
    permissions = ['users.view', 'users.update'];
    render(<UsersSection />);
    expect(screen.queryByText('الأدوار المخصصة')).not.toBeInTheDocument();
  });

  it('saves a new role with exactly the permissions ticked', async () => {
    permissions = ['roles.manage', 'users.view', 'users.update'];
    saveRole.mockResolvedValue({ id: 'r2' });
    render(<UsersSection />);

    fireEvent.click(screen.getByText('دور جديد'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('اسم الدور'), { target: { value: 'مراجع' } });
    fireEvent.click(within(dialog).getByText('الاطلاع على الفواتير'));
    fireEvent.click(within(dialog).getByText('حفظ الدور'));

    await waitFor(() => expect(saveRole).toHaveBeenCalledWith(null, 'مراجع', '', ['invoices.view']));
  });

  it('refuses to save a role with no permissions', async () => {
    permissions = ['roles.manage'];
    render(<UsersSection />);
    fireEvent.click(screen.getByText('دور جديد'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('اسم الدور'), { target: { value: 'فارغ' } });
    fireEvent.click(within(dialog).getByText('حفظ الدور'));
    expect(await within(dialog).findByText('اختر صلاحية واحدة على الأقل')).toBeInTheDocument();
    expect(saveRole).not.toHaveBeenCalled();
  });

  it('before the database update the permissions are still listed, with a notice', async () => {
    permissions = ['roles.manage'];
    databaseReady = false;
    render(<UsersSection />);
    fireEvent.click(screen.getByText('دور جديد'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('عرض التقارير المالية')).toBeInTheDocument();
    expect(within(dialog).getByText(/يحتاج تحديث قاعدة البيانات/)).toBeInTheDocument();
    databaseReady = true;
  });

  it('a role still held by someone cannot be deleted from the list', () => {
    permissions = ['roles.manage'];
    render(<UsersSection />);
    expect(screen.getByTitle('مسند لمستخدمين — غيّر أدوارهم أولًا')).toBeDisabled();
  });
});
