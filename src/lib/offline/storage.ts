import type { Accessory, Device } from "@/types/database";
import type { OfflineSale } from "./offlineSales";
import { formatOfflineNumber } from "./offlineSales";

// ---------------------------------------------------------------------------
// Queue of offline sales: IndexedDB (durable, survives reloads and crashes).
// ---------------------------------------------------------------------------

export interface QueueStore {
  list(): Promise<OfflineSale[]>;
  put(sale: OfflineSale): Promise<void>;
  remove(clientRef: string): Promise<void>;
}

export function createMemoryQueue(): QueueStore {
  const items = new Map<string, OfflineSale>();
  return {
    list: async () => [...items.values()],
    put: async (s) => void items.set(s.client_ref, s),
    remove: async (ref) => void items.delete(ref),
  };
}

function createIndexedDbQueue(): QueueStore {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("wasel-offline", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("sales", { keyPath: "client_ref" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const run = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction("sales", mode);
        const req = fn(tx.objectStore("sales"));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  };
  return {
    list: () => run("readonly", (s) => s.getAll() as IDBRequest<OfflineSale[]>),
    put: async (sale) => void (await run("readwrite", (s) => s.put(sale))),
    remove: async (ref) => void (await run("readwrite", (s) => s.delete(ref))),
  };
}

export const offlineQueue: QueueStore = typeof indexedDB !== "undefined" ? createIndexedDbQueue() : createMemoryQueue();

// ---------------------------------------------------------------------------
// Small per-branch state in localStorage: the till's identity and offline
// counter, and the last known branch stock and open shift.
// ---------------------------------------------------------------------------

const read = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: offline selling just won't have this */
  }
};

export interface TerminalInfo {
  id: string;
  code: string;
  branch_id: string;
  invoice_prefix: string;
  /** Next offline number to use on this device. */
  next_number: number;
}

const terminalKey = (branchId: string) => `pos_terminal_${branchId}`;
export const loadTerminal = (branchId: string) => read<TerminalInfo>(terminalKey(branchId));
export const saveTerminal = (t: TerminalInfo) => write(terminalKey(t.branch_id), t);

/** Takes the next offline invoice number for this till and persists the counter first. */
export function takeOfflineNumber(branchId: string): { terminal: TerminalInfo; number: string } | null {
  const t = loadTerminal(branchId);
  if (!t) return null;
  const number = formatOfflineNumber(t.invoice_prefix, t.next_number);
  saveTerminal({ ...t, next_number: t.next_number + 1 });
  return { terminal: t, number };
}

export interface StockCache {
  devices: Device[];
  accessories: Accessory[];
  saved_at: string;
}
const stockKey = (branchId: string) => `pos_stock_${branchId}`;
export const loadStock = (branchId: string) => read<StockCache>(stockKey(branchId));
export const saveStock = (branchId: string, stock: Omit<StockCache, "saved_at">) =>
  write(stockKey(branchId), { ...stock, saved_at: new Date().toISOString() });
