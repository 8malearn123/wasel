import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Employee {
  id: string;
  merchant_id: string;
  branch_id: string | null;
  merchant_user_id: string | null;
  employee_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  hire_date: string | null;
  status: 'active' | 'inactive' | 'archived';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeInput = Partial<Omit<Employee, 'id' | 'merchant_id' | 'created_at' | 'updated_at'>> & {
  full_name: string;
};

// The database raises these; the user should read a sentence, not an error code.
const ERRORS: Record<string, string> = {
  employees_full_name_not_blank: 'اسم الموظف مطلوب',
  employees_number_per_merchant: 'رقم الموظف مستخدم من قبل',
  employees_one_per_account: 'هذا الحساب مرتبط بموظف آخر',
  account_belongs_to_another_merchant: 'الحساب المختار لا يتبع متجرك',
  branch_belongs_to_another_merchant: 'الفرع المختار لا يتبع متجرك',
  'row-level security': 'ليست لديك صلاحية لهذا الإجراء',
};

const messageFor = (raw: string) => {
  const key = Object.keys(ERRORS).find(k => raw.includes(k));
  return key ? ERRORS[key] : raw;
};

export function useEmployees(includeArchived = false) {
  const { merchant } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    if (!merchant) { setEmployees([]); setLoading(false); return; }
    setLoading(true);
    setError(null);

    let query = supabase
      .from('employees' as never)
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('full_name');

    if (!includeArchived) query = query.neq('status', 'archived');

    const { data, error: queryError } = await query;

    if (queryError) {
      // An empty list is also what someone without employees.view sees — RLS
      // filters rather than errors — so this only fires on a real failure.
      setError(messageFor(queryError.message));
      setEmployees([]);
    } else {
      setEmployees((data || []) as unknown as Employee[]);
    }
    setLoading(false);
  }, [merchant, includeArchived]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const createEmployee = async (input: EmployeeInput) => {
    if (!merchant) return { error: new Error('no_merchant') };

    const { error: insertError } = await supabase
      .from('employees' as never)
      .insert({ ...input, merchant_id: merchant.id } as never);

    if (insertError) {
      toast.error(messageFor(insertError.message));
      return { error: new Error(insertError.message) };
    }
    toast.success('تمت إضافة الموظف');
    await fetchEmployees();
    return { error: null };
  };

  const updateEmployee = async (id: string, updates: Partial<EmployeeInput>) => {
    const { error: updateError } = await supabase
      .from('employees' as never)
      .update(updates as never)
      .eq('id', id);

    if (updateError) {
      toast.error(messageFor(updateError.message));
      return { error: new Error(updateError.message) };
    }
    toast.success('تم حفظ التعديلات');
    await fetchEmployees();
    return { error: null };
  };

  /** Archive rather than delete: the record is referenced by what the person did. */
  const archiveEmployee = (id: string) => updateEmployee(id, { status: 'archived' });

  return { employees, loading, error, createEmployee, updateEmployee, archiveEmployee, refetch: fetchEmployees };
}
