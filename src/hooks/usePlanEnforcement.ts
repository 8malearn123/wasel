import { useAuth } from './useAuth';
import { useCurrentPlan } from './useCurrentPlan';

export function usePlanEnforcement() {
  const { branches } = useAuth();
  const { row, branchLimit, userLimit } = useCurrentPlan();

  const currentPlan = row ?? undefined;
  const activeBranches = branches.filter(b => b.is_active);

  const canAddBranch = activeBranches.length < branchLimit;

  const hasOnlineStore = currentPlan?.has_online_store ?? false;
  const hasAdvancedReports = currentPlan?.advanced_reports ?? false;
  const hasPrioritySupport = currentPlan?.priority_support ?? false;
  const hasWholesale = currentPlan?.has_wholesale ?? false;

  const branchUsage = {
    current: activeBranches.length,
    limit: branchLimit,
    percentage: Math.round((activeBranches.length / branchLimit) * 100),
  };

  const userUsage = {
    limit: userLimit,
  };

  return {
    currentPlan,
    canAddBranch,
    hasOnlineStore,
    hasAdvancedReports,
    hasPrioritySupport,
    hasWholesale,
    branchUsage,
    userUsage,
  };
}
