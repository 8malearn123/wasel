import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSar } from '@/lib/money';
import { weeklyRevenue, forecastNextWeek, pctChange, type AssistantSale } from '@/lib/assistantMath';

/**
 * Claude Design's dark «توقع الأسبوع القادم» card: the last six weeks of real
 * sales as bars, and next week as their recent average — labelled as such.
 */
export function ForecastCard({ isRTL, sales, loading, onAsk }: {
  isRTL: boolean; sales: AssistantSale[] | null; loading: boolean; onAsk: () => void;
}) {
  const t = isRTL;
  const weeks = weeklyRevenue(sales || []);
  const f = forecastNextWeek(weeks);
  const thisWeek = weeks[weeks.length - 1].revenue;
  const ch = f ? pctChange(f.value, thisWeek) : null;
  const bars = [...weeks.map(w => w.revenue), f?.value ?? 0];
  const max = Math.max(...bars, 1);

  return (
    <section className="hero-card relative overflow-hidden rounded-[24px] p-5 text-white" aria-label={t ? 'توقع الأسبوع القادم' : 'Next week forecast'}>
      <div aria-hidden className="hero-glow pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[#C9C3DD]">{t ? 'توقع الأسبوع القادم' : 'Next week forecast'}</p>
          <span className="text-[11px] rounded-full bg-white/10 px-2 py-0.5 text-[#C9C3DD]">{t ? 'متوسط آخر 4 أسابيع' : 'Last 4 weeks’ average'}</span>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/60" /></div>
        ) : !f ? (
          <p className="py-8 text-sm text-[#C9C3DD]">{t ? 'لا توجد مبيعات كافية في الأسابيع الأخيرة للتقدير.' : 'Not enough recent sales to estimate.'}</p>
        ) : (
          <>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {formatSar(f.value, { decimals: 0 })} <span className="text-base font-medium text-[#C9C3DD]">{t ? 'ر.س' : 'SAR'}</span>
            </p>
            {ch !== null && (
              <p className={cn('text-xs mt-1', ch >= 0 ? 'text-[#4ADE80]' : 'text-[#FB7185]')}>
                {ch >= 0 ? '+' : '−'}{Math.abs(ch).toFixed(1)}% {t ? 'عن آخر 7 أيام' : 'vs the last 7 days'}
              </p>
            )}
            <div className="mt-5 flex items-end gap-2 h-24" aria-hidden>
              {bars.map((v, i) => {
                const next = i === bars.length - 1;
                return (
                  <div key={i} className={cn('flex-1 rounded-t-md',
                    next ? 'bg-gradient-to-t from-[#D43A0B] to-[#FF8A55] ring-1 ring-dashed ring-white/40' : 'bg-white/15')}
                    style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
                );
              })}
            </div>
            <p className="text-[11px] text-[#A9A2C4] mt-2">
              {t ? 'الأعمدة: آخر 6 أسابيع، والبرتقالي هو الأسبوع القادم.' : 'Bars: the last 6 weeks; orange is next week.'}
            </p>
          </>
        )}

        <button type="button" onClick={onAsk} disabled={loading}
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:opacity-95 disabled:opacity-60">
          {t ? 'اسأل عن التوقع' : 'Ask about the forecast'}
        </button>
      </div>
    </section>
  );
}
