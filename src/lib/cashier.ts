/**
 * A cashier is a cashier whatever the shop did to the role: when the owner
 * changes the cashier role's permissions, the app presents the member as a
 * custom role marked `system: 'cashier'` (see withStoredCustomRole in
 * useAuth). Checking `role === 'cashier'` alone missed those cashiers, so
 * they saw every invoice, the delete button and pages meant for owners.
 */
export function isCashierMember(member: { role?: string | null; customRole?: { system?: string } | null } | null | undefined): boolean {
  return member?.role === 'cashier' || member?.customRole?.system === 'cashier';
}
