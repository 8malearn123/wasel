import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { callOptionalRpc, resetOptionalRpc, isMissingFunction } from './optionalRpc';

describe('callOptionalRpc', () => {
  beforeEach(() => { rpc.mockReset(); resetOptionalRpc(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });

  it('asks about a missing function once per session', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.my_permissions' } });
    const a = await callOptionalRpc('my_permissions', 'u1');
    const b = await callOptionalRpc('my_permissions', 'u1');
    expect(a.missing && b.missing).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('shares one request between callers at the same moment', async () => {
    rpc.mockResolvedValue({ data: ['pos.access'], error: null });
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => callOptionalRpc<string[]>('my_permissions', 'u1')));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect([a.data, b.data, c.data]).toEqual([['pos.access'], ['pos.access'], ['pos.access']]);
  });

  it('does not remember other errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'timeout' } })
       .mockResolvedValueOnce({ data: 1, error: null });
    expect((await callOptionalRpc('get_subscription_state')).missing).toBeFalsy();
    expect((await callOptionalRpc('get_subscription_state')).data).toBe(1);
  });

  it('recognises PostgREST\'s missing-function answer', () => {
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true);
    expect(isMissingFunction({ message: 'permission denied' })).toBe(false);
  });
});
