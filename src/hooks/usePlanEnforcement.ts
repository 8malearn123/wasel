import { useAuth } from './useAuth';
import { usePlans, Plan } from './usePlans';

export function usePlanEnforcement() {
  const { subscription, branches } = useAuth();
  const { plans } = usePlans();

  const currentPlan: Plan | undefined = plans.find(p => p.id === subscription?.plan_id);
  const activeBranches = branches.filter(b => b.is_active);

  const canAddBranch = activeBranches.length < (subscription?.max_branches || 1);
  
  const hasOnlineStore = currentPlan?.has_online_store ?? false;
  const hasAdvancedReports = currentPlan?.advanced_reports ?? false;
  const hasPrioritySupport = currentPlan?.priority_support ?? false;
  const hasWholesale = (currentPlan as any)?.has_wholesale ?? false;

  const branchUsage = {
    current: activeBranches.length,
    limit: subscription?.max_branches || 1,
    percentage: Math.round((activeBranches.length / (subscription?.max_branches || 1)) * 100),
  };

  const userUsage = {
    limit: subscription?.max_users || 3,
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
