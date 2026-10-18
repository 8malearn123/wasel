// IDs of the rows created by supabase/tests/support/legacy_seed.sql.

export const MERCHANT = "11111111-1111-1111-1111-111111111111";
export const OTHER_MERCHANT = "22222222-2222-2222-2222-222222222222";

export const BRANCH_MAIN = "b1000000-0000-0000-0000-000000000001";
export const BRANCH_MALL = "b1000000-0000-0000-0000-000000000002";

export const OWNER = "a1000000-0000-0000-0000-000000000001";
/** Cashier bound to BRANCH_MAIN. */
export const CASHIER = "a1000000-0000-0000-0000-000000000002";
/** Owner of OTHER_MERCHANT. */
export const OTHER_OWNER = "a1000000-0000-0000-0000-000000000003";

export const STORE_SLUG = "demo";

/** All at BRANCH_MAIN unless noted. Prices are VAT-inclusive. */
export const DEVICES = {
  /** iPhone 13, 1150 */
  iphone13: { id: "d0000000-0000-0000-0000-000000000001", imei: "356000000000011", price: 1150 },
  /** iPhone 15 Pro, 4600 */
  iphone15: { id: "d0000000-0000-0000-0000-000000000002", imei: "356000000000029", price: 4600 },
  /** Galaxy S24 at BRANCH_MALL, 3000 */
  galaxyMall: { id: "d0000000-0000-0000-0000-000000000003", imei: "356000000000037", price: 3000 },
  /** Pixel 8, 2300 */
  pixel: { id: "d0000000-0000-0000-0000-000000000004", imei: "356000000000045", price: 2300 },
  /** iPhone 12, already sold by legacy sale S1 */
  soldIphone12: { id: "d0000000-0000-0000-0000-000000000005", imei: "356000000000052", price: 1150 },
} as const;

export const ACCESSORIES = {
  /** USB-C charger, 115, qty 5 */
  charger: { id: "ac000000-0000-0000-0000-000000000001", price: 115, quantity: 5 },
  /** Screen guard, 57.5, qty 1 */
  guard: { id: "ac000000-0000-0000-0000-000000000002", price: 57.5, quantity: 1 },
} as const;

/** Customer 'Sara', phone 0551234567. */
export const SARA = "c0000000-0000-0000-0000-000000000001";

export const LEGACY_SALES = {
  /** Written by the buggy formula: stored 1322.50 for a 1150 phone, paid cash. */
  inflatedCash: "51000000-0000-0000-0000-000000000001",
  /** Correct VAT-inclusive row; shares its invoice number with inflatedCash. */
  correctCard: "51000000-0000-0000-0000-000000000002",
  /** Buggy formula with a 30 discount, paid 'mixed'. */
  inflatedMixed: "51000000-0000-0000-0000-000000000003",
} as const;

export const device = (id: string) => ({ type: "device", id });
export const accessory = (id: string, quantity = 1) => ({ type: "accessory", id, quantity });
export const pay = (method: string, amount: number, reference?: string) => ({ method, amount, reference });
