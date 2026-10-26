import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const warning = vi.fn();
vi.mock('sonner', () => ({ toast: { warning: (...a: unknown[]) => warning(...a) } }));
const lang = { isRTL: true };
vi.mock('@/i18n', () => ({ useLanguage: () => lang }));

import { DeniedRedirect, type DenialReason } from './DeniedRedirect';

function Landing() {
  const { pathname } = useLocation();
  return <span data-testid="landed">{pathname}</span>;
}

const visit = (reason: DenialReason, to: string) => render(
  <MemoryRouter initialEntries={['/reports']}>
    <Routes>
      <Route path="/reports" element={<DeniedRedirect to={to} reason={reason} />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  </MemoryRouter>,
);

describe('DeniedRedirect', () => {
  beforeEach(() => { warning.mockClear(); lang.isRTL = true; });

  it.each([
    ['plan', '/subscription', 'هذه الصفحة غير متاحة في باقتك الحالية'],
    ['permission', '/', 'ليست لديك صلاحية لفتح هذه الصفحة'],
    ['cashier', '/pos', 'هذه الصفحة غير متاحة لحساب الكاشير'],
  ] as const)('%s: moves to %s and says why', (reason, to, title) => {
    visit(reason, to);
    expect(screen.getByTestId('landed').textContent).toBe(to);
    expect(warning).toHaveBeenCalledWith(title, expect.objectContaining({ id: `denied-${reason}`, description: expect.any(String) }));
  });

  it('speaks English to an English reader', () => {
    lang.isRTL = false;
    visit('cashier', '/pos');
    expect(warning).toHaveBeenCalledWith('This page is not available to cashier accounts', expect.anything());
  });
});
