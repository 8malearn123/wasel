import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LegacyRedirect } from './LegacyRedirect';

function Landing() {
  const { pathname, search } = useLocation();
  return <span data-testid="landed">{pathname + search}</span>;
}

// Every path the consolidation moved, as the app routes it
const MOVED: Array<[from: string, to: string, tab: string, sub?: string]> = [
  ['/inventory', '/products', 'inventory'],
  ['/stocktake', '/products', 'stocktake'],
  ['/transfers', '/products', 'transfers'],
  ['/suppliers', '/products', 'suppliers'],
  ['/purchases', '/products', 'suppliers', 'orders'],
  ['/labels', '/products', 'labels'],
  ['/online-orders', '/sales', 'orders'],
  ['/repairs', '/sales', 'repairs'],
  ['/daily-closings', '/sales', 'closings'],
  ['/online-store', '/sales', 'store'],
  ['/store-seo', '/sales', 'seo'],
  ['/customers', '/sales', 'customers'],
  ['/marketing', '/sales', 'marketing'],
  ['/wholesale', '/sales', 'wholesale'],
  ['/employees', '/team', 'employees'],
  ['/attendance', '/team', 'attendance'],
  ['/devices', '/team', 'devices'],
  ['/hr', '/team', 'payroll'],
  ['/users', '/team', 'users'],
  ['/notifications', '/settings', 'notifications'],
  ['/business-policy', '/settings', 'policy'],
  ['/branches', '/settings', 'branches'],
  ['/support', '/settings', 'support'],
];

function at(url: string, from: string, to: string, tab: string, sub?: string) {
  const view = render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={from} element={<LegacyRedirect to={to} tab={tab} sub={sub} />} />
        <Route path={to} element={<Landing />} />
      </Routes>
    </MemoryRouter>,
  );
  const landed = view.getByTestId('landed').textContent!;
  view.unmount();
  return landed;
}

describe('LegacyRedirect', () => {
  it('lands every old path on its section and leaf', () => {
    for (const [from, to, tab, sub] of MOVED) {
      const landed = at(from, from, to, tab, sub);
      const params = new URLSearchParams(landed.split('?')[1] ?? '');
      expect(landed.split('?')[0], from).toBe(to);
      expect(params.get('tab'), from).toBe(tab);
      expect(params.get('sub'), from).toBe(sub ?? null);
    }
  });

  it('keeps the query a global-search result depends on', () => {
    // How GlobalSearch used to open an item it found by IMEI
    const landed = at(
      '/inventory?tab=devices&q=355%2F123&open=abc',
      '/inventory', '/products', 'inventory',
    );
    const params = new URLSearchParams(landed.split('?')[1]);
    expect(params.get('tab')).toBe('inventory');
    // the page's own tab moved to ?sub=, since ?tab= now names the section
    expect(params.get('sub')).toBe('devices');
    expect(params.get('q')).toBe('355/123');
    expect(params.get('open')).toBe('abc');
  });

  it('carries an old inner tab through to ?sub=', () => {
    const landed = at('/suppliers?tab=orders', '/suppliers', '/products', 'suppliers');
    const params = new URLSearchParams(landed.split('?')[1]);
    expect(params.get('tab')).toBe('suppliers');
    expect(params.get('sub')).toBe('orders');
  });

  it('prefers an explicit sub over whatever the old url asked for', () => {
    // /purchases was the orders tab of the suppliers screen, always
    const landed = at('/purchases?tab=suppliers', '/purchases', '/products', 'suppliers', 'orders');
    expect(new URLSearchParams(landed.split('?')[1]).get('sub')).toBe('orders');
  });

  it('replaces rather than pushes, so Back leaves the app', () => {
    const before = window.history.length;
    at('/inventory', '/inventory', '/products', 'inventory');
    expect(window.history.length).toBe(before);
  });
});
