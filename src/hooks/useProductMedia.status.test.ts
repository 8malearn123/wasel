import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));
const auth = { merchant: { id: 'm1' } };
vi.mock('./useAuth', () => ({ useAuth: () => auth }));

let answer: { data: unknown; error: { message: string; code?: string } | null } = { data: [], error: null };
const upload = vi.fn();
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  for (const k of ['select', 'eq', 'order']) chain[k] = () => chain;
  (chain as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(answer).then(res);
  return { supabase: { from: () => chain, storage: { from: () => ({ upload: (...a: unknown[]) => upload(...a) }) } } };
});

import { useProductMedia, MEDIA_MISSING } from './useProductMedia';

describe('useProductMedia when the server cannot answer', () => {
  beforeEach(() => { toastError.mockClear(); upload.mockClear(); });

  it('a missing table is «not enabled yet», not «no photos» — and nothing is uploaded', async () => {
    answer = { data: null, error: { message: "Could not find the table 'public.product_media' in the schema cache", code: 'PGRST205' } };
    const { result } = renderHook(() => useProductMedia('device', 'd1'));
    await waitFor(() => expect(result.current.status).toBe('missing'));
    await act(async () => { await result.current.upload(new File(['x'], 'a.jpg', { type: 'image/jpeg' })); });
    expect(toastError).toHaveBeenCalledWith(MEDIA_MISSING);
    expect(upload).not.toHaveBeenCalled();
  });

  it('any other failure reads as a failed load', async () => {
    answer = { data: null, error: { message: 'boom', code: 'XX000' } };
    const { result } = renderHook(() => useProductMedia('device', 'd1'));
    await waitFor(() => expect(result.current.status).toBe('failed'));
  });

  it('a normal answer is ok', async () => {
    answer = { data: [], error: null };
    const { result } = renderHook(() => useProductMedia('device', 'd1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBe('ok');
  });
});
