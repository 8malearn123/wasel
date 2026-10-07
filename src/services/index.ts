/**
 * ============================================================================
 * SERVICE REGISTRY — the single place a mock becomes a real backend
 * ============================================================================
 *
 * Each service below is an interface from ./contracts. Today every one is
 * satisfied by a mock from src/mock. To go live, replace the right-hand side
 * with an implementation of the same interface. Nothing in src/pages or
 * src/components changes.
 *
 *   export const shippingService: ShippingService = new SupabaseShippingService();
 *
 * `usingMock` drives the "بيانات تجريبية" banner, so a screen on mock data
 * always says so. Set a service's entry to a real implementation and remove it
 * from MOCKED, and the banner disappears for that screen only.
 * ============================================================================
 */
import type {
  AttendanceService, ShippingService, AiService, DeviceService,
  PolicyService, SeoService,
} from './contracts';
import { mockAttendanceService } from './mock/attendance';
import { mockShippingService } from './mock/shipping';
import { mockAiService } from './mock/ai';
import { mockDeviceService } from './mock/devices';
import { mockPolicyService } from './mock/policy';
import { supabaseSeoService } from './seo';

export const attendanceService: AttendanceService = mockAttendanceService;
export const shippingService: ShippingService = mockShippingService;
export const aiService: AiService = mockAiService;
export const deviceService: DeviceService = mockDeviceService;
export const policyService: PolicyService = mockPolicyService;
/** Real: store SEO already lives in store_settings. Product SEO waits on its columns. */
export const seoService: SeoService = supabaseSeoService;

export type ServiceName = 'attendance' | 'shipping' | 'ai' | 'devices' | 'policy' | 'seo';

/** Which services are still mocked. Remove a name when it goes live. */
const MOCKED: ReadonlySet<ServiceName> = new Set<ServiceName>([
  'attendance', 'shipping', 'ai', 'devices', 'policy',
]);

export const usingMock = (name: ServiceName) => MOCKED.has(name);

export * from './contracts';
