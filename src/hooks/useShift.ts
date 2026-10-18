import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { isNetworkError } from '@/lib/offline/offlineSales';

export type ShiftStatus = 'open' | 'pending_approval' | 'closed';
export type CashMovementType = 'cash_in' | 'cash_out' | 'expense';

/** shift_report() result. expected_cash / difference are null for cashiers until a manager approves (blind count). */
export interface ShiftReport {
  shift: {
    id: string;
    shift_no: number;
    branch_id: string;
    branch_name: string;
    status: ShiftStatus;
    opening_cash: number;
    opening_notes: string | null;
    opened_by_name: string | null;
    opened_at: string;
    counted_cash: number | null;
    closing_notes: string | null;
    closed_by_name: string | null;
    closed_at: string | null;
    expected_cash: number | null;
    difference: number | null;
    approved_by_name: string | null;
    approved_at: string | null;
    approval_notes: string | null;
  };
  sales: { count: number; total: number; by_method: { method: string; amount: number }[] };
  cash: { opening: number; sales: number; cash_in: number; cash_out: number; expenses: number; expected: number | null };
  movements: { id: string; type: CashMovementType; amount: number; reason: string; created_by_name: string | null; created_at: string }[];
  can_approve: boolean;
}

/** One row of list_shifts(). */
export interface ShiftSummary {
  id: string;
  shift_no: number;
  branch_id: string;
  branch_name: string;
  status: ShiftStatus;
  opening_cash: number;
  opened_at: string;
  opened_by_name: string | null;
  closed_at: string | null;
  closed_by_name: string | null;
  counted_cash: number | null;
  expected_cash: number | null;
  difference: number | null;
  approved_at: string | null;
  approved_by_name: string | null;
  sales_total: number;
}

export const CASH_MOVEMENT_LABELS: Record<CashMovementType, { ar: string; en: string }> = {
  cash_in: { ar: 'إيداع في الدرج', en: 'Cash in' },
  cash_out: { ar: 'سحب من الدرج', en: 'Cash out' },
  expense: { ar: 'مصروف', en: 'Expense' },
};

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, { ar: string; en: string }> = {
  open: { ar: 'مفتوحة', en: 'Open' },
  pending_approval: { ar: 'بانتظار اعتماد المدير', en: 'Awaiting approval' },
  closed: { ar: 'معتمدة', en: 'Approved' },
};

/** The current branch's open shift, and the actions on it. Every POS sale needs an open shift. */
export function useShift() {
  const { currentBranch } = useAuth();
  const [shift, setShift] = useState<ShiftReport | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentBranch) {
      setShift(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('current_shift', { _branch_id: currentBranch.id });
    if (error) {
      // Offline: keep the shift we know about, so the till can keep selling offline.
      if (!isNetworkError(error)) toast.error(error.message);
      setLoading(false);
      return;
    }
    setShift((data as unknown as ShiftReport | null) ?? null);
    setLoading(false);
  }, [currentBranch]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const openShift = async (openingCash: number, notes?: string) => {
    if (!currentBranch) return null;
    const { data, error } = await supabase.rpc('open_shift', {
      _branch_id: currentBranch.id,
      _opening_cash: openingCash,
      _notes: notes || undefined,
    });
    if (error) {
      toast.error(error.message);
      await refresh();
      return null;
    }
    const report = data as unknown as ShiftReport;
    setShift(report);
    return report;
  };

  const recordMovement = async (type: CashMovementType, amount: number, reason: string) => {
    if (!shift) return null;
    const { data, error } = await supabase.rpc('record_cash_movement', {
      _shift_id: shift.shift.id,
      _type: type,
      _amount: amount,
      _reason: reason,
    });
    if (error) {
      toast.error(error.message);
      return null;
    }
    const report = data as unknown as ShiftReport;
    setShift(report);
    return report;
  };

  /**
   * Submits the counted total; the shift then waits for a manager. The hook keeps the
   * closed shift until refresh() so the caller can show the result first.
   */
  const closeShift = async (countedCash: number, notes?: string) => {
    if (!shift) return null;
    const { data, error } = await supabase.rpc('close_shift', {
      _shift_id: shift.shift.id,
      _counted_cash: countedCash,
      _notes: notes || undefined,
    });
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data as unknown as ShiftReport;
  };

  return { shift, loading, refresh, openShift, recordMovement, closeShift };
}

/** Shift history and manager approval (shifts page). */
export function useShiftsList(status?: ShiftStatus) {
  const [shifts, setShifts] = useState<ShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_shifts', { _status: status, _limit: 200 });
    if (error) toast.error(error.message);
    setShifts((data as unknown as ShiftSummary[]) || []);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getReport = async (shiftId: string) => {
    const { data, error } = await supabase.rpc('shift_report', { _shift_id: shiftId });
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data as unknown as ShiftReport;
  };

  const approveShift = async (shiftId: string, notes?: string) => {
    const { data, error } = await supabase.rpc('approve_shift', { _shift_id: shiftId, _notes: notes || undefined });
    if (error) {
      toast.error(error.message);
      return null;
    }
    toast.success('تم اعتماد الوردية');
    await refresh();
    return data as unknown as ShiftReport;
  };

  return { shifts, loading, refresh, getReport, approveShift };
}
