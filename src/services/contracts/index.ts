/**
 * ============================================================================
 * API CONTRACTS — the interface between this frontend and the backend
 * ============================================================================
 *
 * Every feature below needs a backend that does not exist yet. Rather than
 * guess at endpoints, each one is expressed as a TypeScript interface: the
 * frontend calls only these methods, and a mock implementation satisfies them
 * today.
 *
 * TO CONNECT A REAL BACKEND
 *   1. Write a class/object implementing the interface, calling whatever the
 *      backend actually exposes.
 *   2. Swap it in `src/services/index.ts`. Nothing else changes.
 *
 * The UI already handles loading, empty, error and permission-denied for every
 * one of these, so a method may reject and the screen stays correct.
 *
 * NOTHING HERE DECIDES BUSINESS RULES. No prices, no durations, no carrier, no
 * device model, no AI provider. Those are the backend's to supply.
 * ============================================================================
 */

/**
 * Every service method resolves to this, so the UI can show a real error.
 *
 * The discriminant is a STRING, not a boolean, on purpose: this project
 * compiles with "strict": false, and TypeScript does not narrow a `true`/`false`
 * discriminant without strictNullChecks — so `if (!result.ok)` would leave the
 * union unnarrowed and every `result.error` would fail to compile.
 */
export type Result<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; error: ServiceError };

export const isOk = <T,>(result: Result<T>): result is { status: 'ok'; data: T } =>
  result.status === 'ok';

export interface ServiceError {
  /** 'unauthorized' renders the permission screen; 'unavailable' the device/offline one */
  code: 'unauthorized' | 'not_found' | 'unavailable' | 'validation' | 'unknown';
  message: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ===========================================================================
 * 1 · ATTENDANCE  (البصمة)
 * ------------------------------------------------------------------------
 * The frontend never talks to a fingerprint device. It shows what the backend
 * reports and asks the backend to record a punch.
 *
 * Lateness, working hours, shifts and grace periods are NOT computed here —
 * `lateMinutes` and `status` arrive already decided by the backend, because the
 * work rules have not been defined and the frontend must not invent them.
 * =========================================================================== */

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'on_leave' | 'holiday';
export type PunchSource = 'device' | 'manual' | 'web';

export interface AttendanceToday {
  employeeId: string;
  employeeName: string;
  date: string;              // ISO date
  checkInAt: string | null;  // ISO datetime
  checkOutAt: string | null;
  /** Minutes worked so far, from the backend's clock — never computed here */
  workedMinutes: number | null;
  /** Null when the backend has no shift rules configured */
  lateMinutes: number | null;
  status: AttendanceStatus;
  lastPunchAt: string | null;
  lastPunchSource: PunchSource | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number | null;
  lateMinutes: number | null;
  status: AttendanceStatus;
  source: PunchSource | null;
  deviceName: string | null;
}

export interface AttendanceQuery {
  employeeId?: string;
  status?: AttendanceStatus;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AttendanceService {
  /** The signed-in user's own day, or a named employee's */
  getToday(employeeId?: string): Promise<Result<AttendanceToday>>;
  /** Records a punch. The backend decides whether it is allowed and deduplicates. */
  checkIn(employeeId: string): Promise<Result<AttendanceToday>>;
  checkOut(employeeId: string): Promise<Result<AttendanceToday>>;
  list(query: AttendanceQuery): Promise<Result<Paged<AttendanceRecord>>>;
}

/* ===========================================================================
 * 2 · SHIPPING  (شركات الشحن + Shipping API)
 * ------------------------------------------------------------------------
 * No carrier is named anywhere in this frontend. A carrier is a row the
 * backend returns.
 *
 * CREDENTIALS NEVER PASS THROUGH HERE. `credentialsSet` is a boolean the
 * backend reports; the key itself is entered and stored server-side.
 * =========================================================================== */

export type CarrierConnectionStatus = 'connected' | 'disconnected' | 'error' | 'not_configured';

export interface ShippingCarrier {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Free text from the backend — express, standard, same-day… not an enum here */
  serviceType: string | null;
  isActive: boolean;
  connectionStatus: CarrierConnectionStatus;
  /** True when the backend holds credentials. The credentials themselves never reach the browser. */
  credentialsSet: boolean;
  lastSyncAt: string | null;
  shipmentCount: number | null;
  createdAt: string;
}

export interface CarrierInput {
  name: string;
  logoUrl?: string | null;
  serviceType?: string | null;
  isActive: boolean;
}

export type ShipmentStatus =
  | 'created' | 'picked_up' | 'in_transit' | 'out_for_delivery'
  | 'delivered' | 'failed' | 'returned' | 'cancelled';

export interface Shipment {
  id: string;
  orderId: string;
  orderNumber: string | null;
  carrierId: string;
  carrierName: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  /** Whatever the carrier charged. The frontend never calculates a shipping price. */
  cost: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingService {
  listCarriers(): Promise<Result<ShippingCarrier[]>>;
  createCarrier(input: CarrierInput): Promise<Result<ShippingCarrier>>;
  updateCarrier(id: string, input: Partial<CarrierInput>): Promise<Result<ShippingCarrier>>;
  setCarrierActive(id: string, isActive: boolean): Promise<Result<ShippingCarrier>>;
  /** Asks the backend to call the carrier and report back. */
  testConnection(id: string): Promise<Result<{ status: CarrierConnectionStatus; message: string; at: string }>>;
  listShipments(query?: { carrierId?: string; status?: ShipmentStatus; page?: number; pageSize?: number }):
    Promise<Result<Paged<Shipment>>>;
  refreshTracking(shipmentId: string): Promise<Result<Shipment>>;
}

/* ===========================================================================
 * 3 · AI  (AI + AI للشحن)
 * ------------------------------------------------------------------------
 * No provider is chosen here and no insight is generated here. The frontend
 * renders what the backend returns and says so when there is nothing.
 * =========================================================================== */

export type InsightSeverity = 'info' | 'opportunity' | 'warning' | 'critical';
export type InsightDomain = 'products' | 'sales' | 'inventory' | 'orders' | 'shipping';

export interface AiInsight {
  id: string;
  domain: InsightDomain;
  severity: InsightSeverity;
  title: string;
  body: string;
  /** What the backend based this on, so a reader can judge it */
  basis: string | null;
  /** 0–1, or null when the backend does not score */
  confidence: number | null;
  generatedAt: string;
  actionLabel: string | null;
  actionHref: string | null;
}

export interface AiService {
  /** Null domain = everything. Returns an empty list when the backend has nothing to say. */
  listInsights(domain?: InsightDomain): Promise<Result<AiInsight[]>>;
  /** Asks the backend to run a fresh analysis. */
  generateInsights(domain?: InsightDomain): Promise<Result<AiInsight[]>>;
  /** Whether an AI provider is configured at all, so the UI can say so plainly. */
  getStatus(): Promise<Result<{ configured: boolean; providerLabel: string | null; lastRunAt: string | null }>>;
}

/* ===========================================================================
 * 4 · DEVICES  (Software + Hardware)
 * ------------------------------------------------------------------------
 * Deliberately device-agnostic: `kind` and `model` are free text from the
 * backend. No vendor, no protocol, no SDK is assumed.
 * =========================================================================== */

export type DeviceConnectionStatus = 'connected' | 'disconnected' | 'error' | 'never_connected';

export interface ConnectedDevice {
  id: string;
  name: string;
  /** Free text — the backend names the category; the frontend does not enumerate hardware */
  kind: string;
  model: string | null;
  branchName: string | null;
  status: DeviceConnectionStatus;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface DeviceInput {
  name: string;
  kind: string;
  model?: string | null;
  branchId?: string | null;
}

export interface DeviceService {
  list(): Promise<Result<ConnectedDevice[]>>;
  create(input: DeviceInput): Promise<Result<ConnectedDevice>>;
  update(id: string, input: Partial<DeviceInput>): Promise<Result<ConnectedDevice>>;
  remove(id: string): Promise<Result<void>>;
  testConnection(id: string): Promise<Result<{ status: DeviceConnectionStatus; message: string; at: string }>>;
}

/* ===========================================================================
 * 5 · BUSINESS POLICY  (سياسة العمل والتعديلات والتسويق)
 * ------------------------------------------------------------------------
 * Every price and duration comes from the backend. The frontend ships with
 * none, and an unconfigured system shows an empty state rather than a number
 * somebody might act on.
 * =========================================================================== */

export interface PolicyItem {
  id: string;
  kind: 'modification' | 'marketing';
  name: string;
  description: string | null;
  /** Null when not set. The UI prints "غير محدد", never a guess. */
  durationLabel: string | null;
  price: number | null;
  currency: string | null;
  isFree: boolean | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface PolicyItemInput {
  kind: 'modification' | 'marketing';
  name: string;
  description?: string | null;
  durationLabel?: string | null;
  price?: number | null;
  isFree?: boolean | null;
  isActive: boolean;
  notes?: string | null;
}

export interface PolicyService {
  list(kind?: 'modification' | 'marketing'): Promise<Result<PolicyItem[]>>;
  create(input: PolicyItemInput): Promise<Result<PolicyItem>>;
  update(id: string, input: Partial<PolicyItemInput>): Promise<Result<PolicyItem>>;
  remove(id: string): Promise<Result<void>>;
}

/* ===========================================================================
 * 6 · SEO  (SEO للمتجر ولكل منتج)
 * ------------------------------------------------------------------------
 * store_settings already holds seo_title / seo_description / seo_keywords /
 * og_image_url / slug, and the Phase 1 migration adds slug and seo fields to
 * products. This contract is what the editor reads and writes; wire it to those
 * columns rather than inventing a store.
 * =========================================================================== */

export interface SeoFields {
  title: string | null;
  description: string | null;
  slug: string | null;
  canonicalUrl: string | null;
  socialTitle: string | null;
  socialDescription: string | null;
  socialImageUrl: string | null;
  /** False asks search engines not to index. */
  indexable: boolean;
}

export interface SeoService {
  getStoreSeo(): Promise<Result<SeoFields>>;
  saveStoreSeo(fields: SeoFields): Promise<Result<SeoFields>>;
  getProductSeo(itemType: string, itemId: string): Promise<Result<SeoFields>>;
  saveProductSeo(itemType: string, itemId: string, fields: SeoFields): Promise<Result<SeoFields>>;
}
