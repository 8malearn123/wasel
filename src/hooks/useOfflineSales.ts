import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { PaymentLine } from '@/lib/payments';
import {
  buildOfflineSale, isNetworkError, syncQueue,
  type OfflineCartLine, type OfflineSale, type SyncOutcome,
} from '@/lib/offline/offlineSales';
import { loadTerminal, offlineQueue, saveTerminal, takeOfflineNumber } from '@/lib/offline/storage';

interface TerminalState {
  id: string;
  code: string;
  branch_id: string;
  invoice_prefix: string;
  last_offline_number: number;
}

const PROBE_INTERVAL_MS = 15_000;
const SYNC_INTERVAL_MS = 60_000;

/**
 * Offline selling for the POS: registers this device as a till (once per branch, while
 * online), records sales locally when the connection is down, and replays them through
 * sync_offline_sale() when it's back. Sales the server refuses go to the managers'
 * review list (offline_sale_conflicts).
 */
export function useOfflineSales({ onSynced }: { onSynced?: () => void } = {}) {
  const { currentBranch } = useAuth();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [terminalReady, setTerminalReady] = useState(() => !!(currentBranch && loadTerminal(currentBranch.id)));
  const syncingRef = useRef(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const refreshPending = useCallback(async () => {
    try {
      setPending((await offlineQueue.list()).length);
    } catch {
      /* IndexedDB unavailable */
    }
  }, []);

  /** Registers this device as a till for the branch, or resumes its offline series. */
  const ensureTerminal = useCallback(async () => {
    if (!currentBranch) return;
    const local = loadTerminal(currentBranch.id);
    const { data, error } = local
      ? await supabase.rpc('terminal_state', { _terminal_id: local.id })
      : await supabase.rpc('register_terminal', { _branch_id: currentBranch.id });

    if (error) {
      if (isNetworkError(error)) return;
      if (local && error.hint === 'TERMINAL_NOT_FOUND') {
        localStorage.removeItem(`pos_terminal_${currentBranch.id}`);
        return ensureTerminal();
      }
      console.error('Terminal registration failed:', error);
      return;
    }
    const t = data as unknown as TerminalState;
    saveTerminal({
      id: t.id,
      code: t.code,
      branch_id: t.branch_id,
      invoice_prefix: t.invoice_prefix,
      // Never reuse a number the server already has, nor one this device already printed.
      next_number: Math.max(local?.next_number ?? 1, t.last_offline_number + 1),
    });
    setTerminalReady(true);
  }, [currentBranch]);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    const queued = await offlineQueue.list().catch(() => [] as OfflineSale[]);
    if (queued.length === 0) {
      setPending(0);
      return;
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      const report = await syncQueue(
        queued,
        async (sale): Promise<SyncOutcome> => {
          const { data, error } = await supabase.rpc('sync_offline_sale', {
            _terminal_id: sale.terminal_id,
            _client_ref: sale.client_ref,
            _invoice_number: sale.invoice_number,
            _sold_at: sale.sold_at,
            _items: sale.items,
            _payments: sale.payments as unknown as Json,
            _customer_name: sale.customer_name,
            _customer_phone: sale.customer_phone,
            _offline_total: sale.total_amount,
          });
          if (error) throw error;
          return data as unknown as SyncOutcome;
        },
        (ref) => offlineQueue.remove(ref),
      );

      if (report.synced > 0) toast.success(`تمت مزامنة ${report.synced} عملية بيع تمت بدون إنترنت`);
      if (report.conflicts.length > 0) {
        toast.warning(`${report.conflicts.length} عملية بيع تحتاج مراجعة المدير`, {
          description: report.conflicts.map((c) => `${c.invoice_number}: ${c.reason ?? ''}`).join('\n'),
          duration: 15_000,
        });
      }
      if (report.interrupted) setOnline(false);
      if (report.synced > 0 || report.conflicts.length > 0) onSyncedRef.current?.();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshPending();
    }
  }, [refreshPending]);

  /** Called when a request failed for lack of connection. */
  const markOffline = useCallback(() => setOnline(false), []);

  // Browser connectivity events.
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // navigator.onLine can say "online" while the internet is actually down (Wi-Fi up,
  // line down), so while offline we probe the server until it answers.
  useEffect(() => {
    if (online) return;
    const id = setInterval(async () => {
      const { error } = await supabase.from('branches').select('id').limit(1);
      if (!error || !isNetworkError(error)) setOnline(true);
    }, PROBE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [online]);

  // Back online (or on load): make sure this till is registered and flush the queue.
  useEffect(() => {
    refreshPending();
    if (!online) return;
    ensureTerminal().then(syncNow);
  }, [online, ensureTerminal, syncNow, refreshPending]);

  useEffect(() => {
    if (!online || pending === 0) return;
    const id = setInterval(syncNow, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [online, pending, syncNow]);

  /** Records a sale on this device. Throws with a message for the cashier when it can't. */
  const recordSale = useCallback(
    async (input: {
      clientRef: string;
      cart: OfflineCartLine[];
      payments: PaymentLine[];
      discount: number;
      vatEnabled: boolean;
      customerName?: string;
      customerPhone?: string;
    }) => {
      if (!currentBranch) throw new Error('لا يوجد فرع محدد');
      if (!loadTerminal(currentBranch.id)) {
        throw new Error('هذا الجهاز غير مسجّل كصندوق بعد؛ يلزم اتصال بالإنترنت مرة واحدة');
      }
      // Validate before consuming a number from the till's series.
      buildOfflineSale({ ...input, terminalId: 'check', branchId: currentBranch.id, invoiceNumber: 'check' });
      const taken = takeOfflineNumber(currentBranch.id)!;
      const sale = buildOfflineSale({
        ...input,
        terminalId: taken.terminal.id,
        branchId: currentBranch.id,
        invoiceNumber: taken.number,
      });
      await offlineQueue.put(sale);
      await refreshPending();
      return sale;
    },
    [currentBranch, refreshPending],
  );

  return { online, pending, syncing, terminalReady, markOffline, syncNow, recordSale };
}
