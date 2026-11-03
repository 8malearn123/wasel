import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const warning = vi.fn();
vi.mock('sonner', () => ({ toast: { warning: (...a: unknown[]) => warning(...a) } }));
vi.mock('@/i18n', () => ({ useLanguage: () => ({ isRTL: true }) }));
const admin = { status: 'loading' as string, retryCheck: vi.fn() };
vi.mock('@/hooks/usePlatformAdmin', () => ({ usePlatformAdmin: () => admin }));

import { AdminRoute } from './AdminRoute';

function Landing() {
  const { pathname } = useLocation();
  return <span data-testid="landed">{pathname}</span>;
}
const visit = () => render(
  <MemoryRouter initialEntries={['/admin/companies']}>
    <Routes>
      <Route path="/admin/companies" element={<AdminRoute><p>platform content</p></AdminRoute>} />
      <Route path="*" element={<Landing />} />
    </Routes>
  </MemoryRouter>,
);

describe('AdminRoute', () => {
  beforeEach(() => { warning.mockClear(); admin.retryCheck.mockClear(); });

  it('waits while the check runs — no redirect on a reload', () => {
    admin.status = 'loading'; visit();
    expect(screen.queryByTestId('landed')).toBeNull();
    expect(screen.queryByText('platform content')).toBeNull();
  });

  it('a signed-out visitor goes to the platform login', () => {
    admin.status = 'signed_out'; visit();
    expect(screen.getByTestId('landed').textContent).toBe('/admin/login');
  });

  it('a shop account is sent to its shop and told why', () => {
    admin.status = 'not_admin'; visit();
    expect(screen.getByTestId('landed').textContent).toBe('/');
    expect(warning).toHaveBeenCalledWith('هذه الصفحة لمدير المنصة فقط', expect.anything());
  });

  it('a failed check is not «not an admin»: it says so and offers a retry', () => {
    admin.status = 'error'; visit();
    expect(screen.queryByTestId('landed')).toBeNull();
    expect(screen.getByText('تعذّر التحقق من صلاحية مدير المنصة')).toBeInTheDocument();
    fireEvent.click(screen.getByText('إعادة المحاولة'));
    expect(admin.retryCheck).toHaveBeenCalled();
  });

  it('an administrator sees the page', () => {
    admin.status = 'admin'; visit();
    expect(screen.getByText('platform content')).toBeInTheDocument();
  });
});
