import type { AiService, Result } from '../contracts';
import { mockInsights } from '@/mock/fixtures';

/** Mock. See src/mock/README.md. Replace in src/services/index.ts. */
const delay = (ms = 400) => new Promise(r => setTimeout(r, ms));
const ok = <T,>(data: T): Result<T> => ({ status: 'ok', data });

export const mockAiService: AiService = {
  async listInsights() {
    await delay();
    // Empty, not invented. A fabricated "insight" about someone's real shop is
    // worse than an empty state.
    return ok(mockInsights);
  },

  async generateInsights() {
    await delay(900);
    return {
      status: 'error' as const,
      error: {
        code: 'unavailable',
        message: 'لم يُفعَّل مزوّد الذكاء الاصطناعي بعد',
      },
    };
  },

  async getStatus() {
    await delay(150);
    return ok({ configured: false, providerLabel: null, lastRunAt: null });
  },
};
