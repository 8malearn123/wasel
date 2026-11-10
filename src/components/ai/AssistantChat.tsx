import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, PackageSearch, TrendingUp, Trophy, Send, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSar } from '@/lib/money';
import { weeklyRevenue, forecastNextWeek, pctChange, topItems, matchQuestion, type AssistantSale, type QuestionKey } from '@/lib/assistantMath';
import type { ReorderLine } from '@/hooks/useAssistantData';

/**
 * Claude Design's «مساعد واصل» conversation. Its ready questions are answered
 * from the shop's own figures, worked out here; a free question that none of
 * them covers is told plainly that it needs the AI provider, which is not
 * switched on — nothing is invented.
 */

interface Question { key: QuestionKey; ar: string; en: string; subAr: string; subEn: string; icon: LucideIcon; tone: string; tile: string; needs: 'sales' | 'stock' }

const QUESTIONS: Question[] = [
  { key: 'summary', ar: 'لخّص أداء المبيعات هذا الأسبوع', en: 'Summarise this week’s sales', subAr: 'مقارنة بالأسبوع الماضي', subEn: 'Against last week', icon: BarChart3, tone: 'tone-peach', tile: 'text-[#C2410C]', needs: 'sales' },
  { key: 'reorder', ar: 'أي المنتجات تحتاج إعادة طلب؟', en: 'What needs reordering?', subAr: 'حسب حد التنبيه لكل صنف', subEn: 'By each item’s alert level', icon: PackageSearch, tone: 'tone-violet', tile: 'text-[#5A48B5]', needs: 'stock' },
  { key: 'forecast', ar: 'توقع مبيعات الأسبوع القادم', en: 'Forecast next week’s sales', subAr: 'متوسط آخر 4 أسابيع', subEn: 'Average of the last 4 weeks', icon: TrendingUp, tone: 'tone-rose', tile: 'text-[#BE2D4F]', needs: 'sales' },
  { key: 'top', ar: 'ما الأكثر مبيعاً هذا الأسبوع؟', en: 'What sold best this week?', subAr: 'بعدد القطع المباعة', subEn: 'By units sold', icon: Trophy, tone: 'tone-peach', tile: 'text-[#C2410C]', needs: 'sales' },
];

interface Message { id: number; from: 'me' | 'assistant'; lines: string[] }

export function AssistantChat({
  isRTL, name, sales, reorder, canSales, canStock, loading, error, ask, onAsked,
}: {
  isRTL: boolean; name: string;
  sales: AssistantSale[] | null; reorder: ReorderLine[] | null;
  canSales: boolean; canStock: boolean; loading: boolean; error: boolean;
  /** a question asked from elsewhere on the page (the forecast card) */
  ask: QuestionKey | null; onAsked: () => void;
}) {
  const t = isRTL;
  const cur = t ? 'ر.س' : 'SAR';
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const shown = QUESTIONS.filter(q => (q.needs === 'sales' ? canSales : canStock));

  const answer = (key: QuestionKey): string[] => {
    if (error) return [t ? 'تعذّر قراءة بيانات المتجر الآن. حاول مرة أخرى بعد قليل.' : 'The shop’s data could not be read just now. Try again shortly.'];
    const q = QUESTIONS.find(x => x.key === key)!;
    if ((q.needs === 'sales' && !canSales) || (q.needs === 'stock' && !canStock)) {
      return [t ? 'صلاحيات حسابك لا تشمل هذه البيانات.' : 'Your role does not include this data.'];
    }
    if (key === 'reorder') {
      const list = reorder || [];
      if (list.length === 0) return [t ? 'لا يوجد صنف عند حد التنبيه أو تحته الآن. المخزون في وضع جيد.' : 'No item is at or under its alert level right now.'];
      return [
        t ? `${list.length} صنف عند حد التنبيه أو تحته:` : `${list.length} items are at or under their alert level:`,
        ...list.slice(0, 6).map(r => t
          ? `• ${r.name} — المتوفر ${r.quantity} (حد التنبيه ${r.min_quantity})`
          : `• ${r.name} — ${r.quantity} left (alert at ${r.min_quantity})`),
        ...(list.length > 6 ? [t ? `و${list.length - 6} أصناف أخرى في صفحة المخزون.` : `and ${list.length - 6} more on the stock page.`] : []),
      ];
    }
    const all = sales || [];
    const weeks = weeklyRevenue(all);
    const thisWeek = weeks[weeks.length - 1];
    const lastWeek = weeks[weeks.length - 2];
    if (key === 'summary') {
      if (thisWeek.count === 0) return [t ? 'لا توجد مبيعات في آخر 7 أيام.' : 'No sales in the last 7 days.'];
      const ch = pctChange(thisWeek.revenue, lastWeek.revenue);
      return [
        t ? `مبيعات آخر 7 أيام: ${formatSar(thisWeek.revenue)} ${cur} من ${thisWeek.count} فاتورة.` : `Last 7 days: ${formatSar(thisWeek.revenue)} ${cur} from ${thisWeek.count} invoices.`,
        t ? `متوسط الفاتورة: ${formatSar(thisWeek.revenue / thisWeek.count)} ${cur}.` : `Average invoice: ${formatSar(thisWeek.revenue / thisWeek.count)} ${cur}.`,
        ch === null
          ? (t ? 'لا توجد مبيعات في الأسبوع الذي قبله للمقارنة.' : 'Nothing in the week before to compare with.')
          : (t ? `${ch >= 0 ? 'أعلى' : 'أقل'} بنسبة ${Math.abs(ch).toFixed(1)}% من الأسبوع الذي قبله (${formatSar(lastWeek.revenue)} ${cur}).`
            : `${Math.abs(ch).toFixed(1)}% ${ch >= 0 ? 'up on' : 'down on'} the week before (${formatSar(lastWeek.revenue)} ${cur}).`),
      ];
    }
    if (key === 'forecast') {
      const f = forecastNextWeek(weeks);
      if (!f) return [t ? 'لا توجد مبيعات كافية في الأسابيع الأخيرة لتقدير الأسبوع القادم.' : 'Not enough recent sales to estimate next week.'];
      return [
        t ? `التقدير للأسبوع القادم: نحو ${formatSar(f.value, { decimals: 0 })} ${cur}.` : `Next week: about ${formatSar(f.value, { decimals: 0 })} ${cur}.`,
        t ? `مبني على ${f.basisWeeks === 1 ? 'آخر أسبوع فيه مبيعات' : f.basisWeeks === 2 ? 'متوسط آخر أسبوعين فيهما مبيعات' : `متوسط آخر ${f.basisWeeks} أسابيع فيها مبيعات`} — تقدير حسابي وليس وعداً.`
          : `${f.basisWeeks === 1 ? 'The last week with sales' : `The average of the last ${f.basisWeeks} weeks with sales`} — arithmetic, not a promise.`,
      ];
    }
    const cutoff = Date.now() - 7 * 864e5;
    const top = topItems(all.filter(s => new Date(s.sale_date).getTime() >= cutoff), 5);
    if (top.length === 0) return [t ? 'لا توجد مبيعات في آخر 7 أيام.' : 'No sales in the last 7 days.'];
    return [
      t ? 'الأكثر مبيعاً في آخر 7 أيام:' : 'Best sellers, last 7 days:',
      ...top.map((p, i) => t ? `${i + 1}. ${p.name} — ${p.units} قطعة · ${formatSar(p.revenue)} ${cur}` : `${i + 1}. ${p.name} — ${p.units} units · ${formatSar(p.revenue)} ${cur}`),
    ];
  };

  const post = (question: string, key: QuestionKey | null) => {
    const lines = key ? answer(key) : [t
      ? 'الأسئلة الحرة تحتاج تفعيل مزوّد الذكاء الاصطناعي، وهو غير مفعّل بعد. جرّب أحد الأسئلة الجاهزة — إجاباتها محسوبة من بيانات متجرك.'
      : 'Free questions need the AI provider, which is not switched on yet. Try one of the ready questions — they are worked out from your shop’s data.'];
    setMessages(m => [...m, { id: m.length * 2, from: 'me', lines: [question] }, { id: m.length * 2 + 1, from: 'assistant', lines }]);
  };

  const pick = (key: QuestionKey) => {
    const q = QUESTIONS.find(x => x.key === key)!;
    post(t ? q.ar : q.en, key);
  };

  useEffect(() => {
    if (ask && !loading) { pick(ask); onAsked(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, loading]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || loading) return;
    post(q, matchQuestion(q));
    setText('');
  };

  return (
    <section className="bg-card rounded-[24px] border shadow-md p-5 flex flex-col min-h-[560px]" aria-label={t ? 'مساعد واصل' : 'Wasel assistant'}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-primary" aria-hidden />
            {t ? 'مساعد واصل' : 'Wasel assistant'}
          </h3>
          <p className="text-xs text-muted-foreground">{messages.length ? (t ? 'المحادثة الحالية' : 'This conversation') : (t ? 'محادثة جديدة' : 'New conversation')}</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={() => setMessages([])} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            {t ? 'محادثة جديدة' : 'New chat'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-8 pb-4">
            <div className="relative mb-4">
              <img src="/brand/app-icon.svg" alt="" className="w-16 h-16 rounded-[20px] shadow-lg" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-[4px] bg-primary" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {t ? `كيف أقدر أساعدك اليوم${name ? ` يا ${name}` : ''}؟` : `How can I help today${name ? `, ${name}` : ''}?`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              {t ? 'اسأل عن مبيعاتك ومخزونك — أجاوب من بيانات متجرك الفعلية.' : 'Ask about your sales and stock — answers come from your shop’s real data.'}
            </p>
            {shown.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {shown.map(q => (
                  <button key={q.key} type="button" disabled={loading} onClick={() => pick(q.key)}
                    className={cn('flex items-center gap-3 rounded-2xl border p-3 text-start transition-transform hover:-translate-y-0.5 disabled:opacity-60', q.tone)}>
                    <span className={cn('w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0', q.tile)}>
                      <q.icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground">{t ? q.ar : q.en}</span>
                      <span className="block text-xs text-muted-foreground">{t ? q.subAr : q.subEn}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {messages.map(m => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={cn('flex', m.from === 'me' ? 'justify-start' : 'justify-end')}>
                <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                  m.from === 'me' ? 'bg-foreground text-background' : 'bg-muted/60 text-foreground border')}>
                  {m.lines.map((l, i) => <p key={i} className={cn(i > 0 && 'mt-1')}>{l}</p>)}
                </div>
              </motion.div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 flex items-center gap-2 rounded-2xl border bg-muted/40 p-2">
        <input value={text} aria-label={t ? "سؤالك" : "Your question"} onChange={e => setText(e.target.value)}
          placeholder={t ? 'اسأل عن مبيعاتك، مخزونك، منتجاتك...' : 'Ask about your sales, stock, products…'}
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground" />
        <button type="submit" disabled={!text.trim() || loading} aria-label={t ? 'إرسال' : 'Send'}
          className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 rtl:-scale-x-100" />}
        </button>
      </form>
      <p className="text-[11px] text-muted-foreground text-center mt-2">
        {t ? 'الإجابات محسوبة من بيانات متجرك؛ راجع الأرقام المهمة قبل أي قرار.' : 'Answers are worked out from your shop’s data; check key figures before deciding.'}
      </p>
    </section>
  );
}
