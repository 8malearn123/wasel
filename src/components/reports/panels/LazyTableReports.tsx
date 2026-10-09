import { useMemo } from 'react';
import { useCustomers } from '@/hooks/useCustomers';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useRepairPartsReport } from '@/hooks/useRepairPartsReport';
import { useLanguage } from '@/i18n';
import { customersReport, suppliersReport } from '@/lib/reportDefinitions';
import { ReportTable } from '../ReportTable';
import { ReportPanel } from '../ReportShell';
import { PartsPanel } from './PartsPanel';

/**
 * The reports whose rows nothing else on the page already loads.
 *
 * Their hooks live in these small components rather than in ReportsPage so
 * that opening the sales report does not also fetch the customer list, the
 * supplier list and the repair-part ledger. The panel — and so the hook — is
 * only mounted when its own report is selected.
 */

export function CustomersTableReport() {
  const { isRTL } = useLanguage();
  const { customers, loading, error, refetch } = useCustomers();
  return (
    <ReportTable
      definition={customersReport}
      rows={customers}
      loading={loading}
      error={error}
      onRetry={refetch}
      emptyText={isRTL ? 'لا يوجد عملاء مسجّلون' : 'No customers yet'}
    />
  );
}

export function SuppliersTableReport() {
  const { isRTL } = useLanguage();
  const { suppliers, loading, error, refetch } = useSuppliers();
  return (
    <ReportTable
      definition={suppliersReport}
      rows={suppliers}
      loading={loading}
      error={error?.message ?? null}
      onRetry={refetch}
      emptyText={isRTL ? 'لا يوجد موردون مسجّلون' : 'No suppliers yet'}
    />
  );
}

export function RepairPartsReport({ onExport }: { onExport: (rows: ReturnType<ReturnType<typeof useRepairPartsReport>['getConsumptionByPart']>) => void }) {
  const { loading, error, refetch, getConsumptionByPart, getDailyUsage, getSummary } =
    useRepairPartsReport();

  // Each walks the whole part ledger, and each is a useCallback on the hook —
  // so the dependency is the function, not the hook's result object, which is
  // a fresh literal on every render and would defeat the memo entirely.
  const consumption = useMemo(() => getConsumptionByPart(), [getConsumptionByPart]);
  const dailyUsage = useMemo(() => getDailyUsage(14), [getDailyUsage]);
  const summary = useMemo(() => getSummary(), [getSummary]);

  return (
    <ReportPanel loading={loading} error={error} onRetry={refetch}>
      <PartsPanel
        consumption={consumption}
        dailyUsage={dailyUsage}
        summary={summary}
        onExport={() => onExport(consumption)}
      />
    </ReportPanel>
  );
}
