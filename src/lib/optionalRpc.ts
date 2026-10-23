import { supabase } from '@/integrations/supabase/client';

/**
 * A database function a migration adds, called before that migration may have
 * been applied.
 *
 * my_permissions() and get_subscription_state() come with migrations
 * 20261004100200 and 20261004090000. Where those are not applied yet PostgREST
 * answers 404 (PGRST202), and every component that mounted usePermissions or
 * useSubscription asked again — a column of 404s in the console on every page.
 * The callers already fall back to the same answer the server would give; this
 * only makes the question once: a missing function is remembered for the
 * session, and calls made at the same moment share one request.
 */

type RpcResult<T> = { data: T | null; error: { message: string; code?: string } | null; missing?: boolean };

const missing = new Set<string>();
const inflight = new Map<string, Promise<RpcResult<unknown>>>();

export const isMissingFunction = (error: { code?: string; message?: string } | null | undefined) =>
  !!error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? ''));

export async function callOptionalRpc<T>(fn: string, key = ''): Promise<RpcResult<T>> {
  if (missing.has(fn)) return { data: null, error: { message: `${fn} is not installed`, code: 'PGRST202' }, missing: true };
  const id = `${fn}:${key}`;
  let p = inflight.get(id);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.rpc(fn as never);
      if (error && isMissingFunction(error)) {
        missing.add(fn);
        console.warn(`[rpc] ${fn}() is not in the database yet — apply its migration. Using the fallback until then.`);
        return { data: null, error, missing: true };
      }
      return { data, error };
    })().finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  return p as Promise<RpcResult<T>>;
}

/** for tests */
export const resetOptionalRpc = () => { missing.clear(); inflight.clear(); };
