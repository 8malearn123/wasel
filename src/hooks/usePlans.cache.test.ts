import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const calls = vi.fn();
let fail = false;
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => { calls(); return Promise.resolve(fail ? { data: null, error: { message: 'x' } } : { data: [{ id: 'p1', name: 'Basic', is_active: true }], error: null }); } }) }) }) },
}));

import { usePlans, resetPlansCache } from './usePlans';

describe('usePlans', () => {
  beforeEach(() => { calls.mockClear(); fail = false; resetPlansCache(); });

  it('many screens asking at once share one request', async () => {
    const a = renderHook(() => usePlans()); const b = renderHook(() => usePlans()); const c = renderHook(() => usePlans());
    await waitFor(() => expect(c.result.current.loading).toBe(false));
    expect(a.result.current.plans).toHaveLength(1); expect(b.result.current.plans).toHaveLength(1);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('a failed read is not kept: the next one asks again', async () => {
    fail = true;
    const a = renderHook(() => usePlans());
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    fail = false;
    const b = renderHook(() => usePlans());
    await waitFor(() => expect(b.result.current.plans).toHaveLength(1));
    expect(calls).toHaveBeenCalledTimes(2);
  });
});
