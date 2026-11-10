import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

let rpcResult: { data: unknown; error: { message: string; code?: string } | null; missing?: boolean };
vi.mock('@/lib/optionalRpc', () => ({ callOptionalRpc: async () => rpcResult }));
let member: Record<string, unknown>;
const user = { id: 'u1' };
vi.mock('./useAuth', () => ({ useAuth: () => ({ user, merchantUser: member, memberLoading: false }) }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

import { usePermissions } from './usePermissions';

const custom = { role: 'custom', customRole: { permissions: ['products.view', 'invoices.view'] } };

describe('permissions when my_permissions() cannot answer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a server or connection failure grants a custom role nothing', async () => {
    member = custom;
    rpcResult = { data: null, error: { message: 'TypeError: Failed to fetch' } };
    const { result } = renderHook(() => usePermissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.can('invoices.view')).toBe(false);
    expect(result.current.can('products.view')).toBe(false);
  });

  it('a cashier keeps only the base cashier map on failure — never reports', async () => {
    member = { role: 'cashier' };
    rpcResult = { data: null, error: { message: 'Internal Server Error', code: '500' } };
    const { result } = renderHook(() => usePermissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.can('pos.access')).toBe(true);
    expect(result.current.can('reports.view')).toBe(false);
    expect(result.current.can('invoices.view')).toBe(false);
  });

  it('a function that is not installed (404) uses the role\'s own permissions', async () => {
    member = custom;
    rpcResult = { data: null, error: { message: 'Could not find the function', code: 'PGRST202' }, missing: true };
    const { result } = renderHook(() => usePermissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.can('invoices.view')).toBe(true);
    expect(result.current.can('reports.view')).toBe(false);
  });
});
