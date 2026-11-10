import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// the permissions call stays pending until the test lets it answer
let answer: (v: unknown) => void = () => {};
vi.mock('@/lib/optionalRpc', () => ({
  callOptionalRpc: () => new Promise(r => { answer = r; }),
}));
const auth: { user: unknown; merchantUser: unknown; memberLoading: boolean } = { user: { id: 'u1' }, merchantUser: null, memberLoading: true };
vi.mock('./useAuth', () => ({ useAuth: () => auth }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

import { usePermissions } from './usePermissions';

describe('a custom role is never «loaded with nothing» before its list arrives', () => {
  it('stays loading from the moment the member arrives until the list is read', async () => {
    // every render is recorded: a guard acts on the frame it sees
    const frames: { loading: boolean; closings: boolean }[] = [];
    const { result, rerender } = renderHook(() => {
      const p = usePermissions();
      frames.push({ loading: p.loading, closings: p.can('closings.manage') });
      return p;
    });
    // the member is read; the permissions call has not answered yet
    auth.merchantUser = { id: 'm1', role: 'custom', customRole: { permissions: ['closings.manage'] } };
    auth.memberLoading = false;
    frames.length = 0;
    rerender();
    // no frame may say «settled, and not allowed» before the list is read
    expect(frames.some(f => !f.loading && !f.closings)).toBe(false);
    expect(result.current.loading).toBe(true);
    await act(async () => { answer({ data: null, error: { message: 'x', code: 'PGRST202' }, missing: true }); });
    expect(result.current.loading).toBe(false);
    expect(result.current.can('closings.manage')).toBe(true);
  });
});
