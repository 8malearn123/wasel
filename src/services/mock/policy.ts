import type { PolicyService, PolicyItem, PolicyItemInput, Result } from '../contracts';
import { mockPolicyItems } from '@/mock/fixtures';

/** Mock. See src/mock/README.md. Replace in src/services/index.ts. */
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));
const ok = <T,>(data: T): Result<T> => ({ status: 'ok', data });

let items = [...mockPolicyItems];

export const mockPolicyService: PolicyService = {
  async list(kind) {
    await delay();
    return ok(kind ? items.filter(i => i.kind === kind) : items);
  },

  async create(input: PolicyItemInput) {
    await delay();
    if (!input.name?.trim()) {
      return { status: 'error' as const, error: { code: 'validation', message: 'الاسم مطلوب' } };
    }
    const item: PolicyItem = {
      id: `mock-policy-${Date.now()}`,
      kind: input.kind,
      name: input.name.trim(),
      description: input.description ?? null,
      // Whatever the user typed, and nothing more. No default price, no
      // default duration — those are the business's to decide.
      durationLabel: input.durationLabel ?? null,
      price: input.price ?? null,
      currency: input.price != null ? 'SAR' : null,
      isFree: input.isFree ?? null,
      isActive: input.isActive,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    items = [item, ...items];
    return ok(item);
  },

  async update(id, input) {
    await delay();
    const found = items.find(i => i.id === id);
    if (!found) return { status: 'error' as const, error: { code: 'not_found', message: 'العنصر غير موجود' } };
    const updated = { ...found, ...input } as PolicyItem;
    items = items.map(i => (i.id === id ? updated : i));
    return ok(updated);
  },

  async remove(id) {
    await delay();
    items = items.filter(i => i.id !== id);
    return ok(undefined);
  },
};
