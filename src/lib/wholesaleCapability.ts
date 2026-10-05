import type { Plan } from '@/hooks/usePlans';

/**
 * Buying wholesale and supplying wholesale are two different capabilities.
 *
 * Until now the whole of /wholesale sat behind one flag, `has_wholesale`, so a
 * PRO merchant could not even open the marketplace. The plans are:
 *
 *   PRO  — may BUY from other shops. May not supply.
 *   MAX  — may buy AND supply (list stock, take incoming orders, extend credit).
 *
 * `has_wholesale` is therefore read as "may supply". Buying is available to any
 * merchant with a live subscription, which is what PRO needs.
 *
 * This file only decides what to SHOW. The matching server rule lives in
 * can_supply_wholesale() and the wholesale_listings / wholesale_orders policies
 * — a merchant who calls the API directly is refused there.
 */

export type WholesaleCapability = 'buy' | 'supply';

/** Plan names known to include supplying, for when the plans row cannot be read */
const SUPPLY_PLAN_NAMES = new Set(['Distributor']);

export interface WholesaleAccess {
  canBuy: boolean;
  canSupply: boolean;
}

export function wholesaleAccess(
  planName: string | null | undefined,
  plan?: Plan | null,
): WholesaleAccess {
  // The plans row is authoritative: adding a plan that supplies is a column
  // edit, not a code change.
  const canSupply = plan
    ? Boolean(plan.has_wholesale)
    : SUPPLY_PLAN_NAMES.has(planName || '');

  // Supplying implies buying. Any subscribed merchant may buy.
  return { canBuy: true, canSupply };
}

export function allowsWholesale(
  capability: WholesaleCapability,
  planName: string | null | undefined,
  plan?: Plan | null,
): boolean {
  const access = wholesaleAccess(planName, plan);
  return capability === 'supply' ? access.canSupply : access.canBuy;
}
