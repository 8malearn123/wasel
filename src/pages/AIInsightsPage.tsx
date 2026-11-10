import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Loader2, TrendingDown, TrendingUp, AlertTriangle, Info,
  Package, ShoppingCart, Boxes, Truck, RefreshCw,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import { toast } from 'sonner';
import {
  aiService, usingMock, isOk,
  type AiInsight, type InsightDomain, type InsightSeverity,
} from '@/services';
import {
  LoadingState, ErrorState, UnavailableState, MockDataBanner,
} from '@/components/common/StateViews';
import { friendlyError } from '@/lib/errors';
import { useAssistantData } from '@/hooks/useAssistantData';
import { useWhoAmI } from '@/hooks/useSignOut';
import { AssistantChat } from '@/components/ai/AssistantChat';
import type { QuestionKey } from '@/lib/assistantMath';
import { ForecastCard } from '@/components/ai/ForecastCard';

// Claude Design's note cards, one tone per kind of note
const SEVERITY: Record<InsightSeverity, { cls: string; icon: typeof Info; ar: string; en: string }> = {
  info:        { cls: 'tone-violet', icon: Info,          ar: 'معلومة',  en: 'Info' },
  opportunity: { cls: 'tone-peach',  icon: TrendingUp,    ar: 'فرصة',    en: 'Opportunity' },
  warning:     { cls: 'tone-peach',  icon: TrendingDown,  ar: 'تحذير',   en: 'Warning' },
  critical:    { cls: 'tone-rose',   icon: AlertTriangle, ar: 'حرج',     en: 'Critical' },
};

const DOMAINS: { key: InsightDomain | 'all'; ar: string; en: string; icon: typeof Package }[] = [
  { key: 'all',       ar: 'الكل',      en: 'All',       icon: Sparkles },
  { key: 'products',  ar: 'المنتجات',  en: 'Products',  icon: Package },
  { key: 'sales',     ar: 'المبيعات',  en: 'Sales',     icon: ShoppingCart },
  { key: 'inventory', ar: 'المخزون',   en: 'Inventory', icon: Boxes },
  { key: 'orders',    ar: 'الطلبات',   en: 'Orders',    icon: ShoppingCart },
  { key: 'shipping',  ar: 'الشحن',     en: 'Shipping',  icon: Truck },
];

export default function AIInsightsPage() {
  const { isRTL } = useLanguage();
  const t = isRTL;

  const [domain, setDomain] = useState<InsightDomain | 'all'>('all');
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [configured, setConfigured] = useState(false);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const data = useAssistantData();
  const { displayName } = useWhoAmI(isRTL);
  const firstName = displayName.split(/\s+/)[0] || '';
  const [ask, setAsk] = useState<QuestionKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const status = await aiService.getStatus();
    if (isOk(status)) {
      setConfigured(status.data.configured);
      setProviderLabel(status.data.providerLabel);
      setLastRunAt(status.data.lastRunAt);
    }

    const result = await aiService.listInsights(domain === 'all' ? undefined : domain);
    if (!isOk(result)) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    setInsights(result.data);
    setLoading(false);
  }, [domain]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    const result = await aiService.generateInsights(domain === 'all' ? undefined : domain);
    setGenerating(false);
    if (!isOk(result)) { toast.error(friendlyError(result.error)); return; }
    setInsights(result.data);
    toast.success(t ? 'تم تحديث التحليلات' : 'Insights refreshed');
  };

  return (
    <AppLayout
      title={t ? 'المساعد الذكي' : 'AI assistant'}
      subtitle={t ? 'اسأل عن بياناتك، واحصل على إجابات وتوصيات فورية' : 'Ask about your data and get answers and pointers'}
    >

      {/* Claude Design: the conversation beside the forecast and today's notes */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 min-w-0">
          <AssistantChat
            isRTL={isRTL} name={firstName}
            sales={data.sales} reorder={data.reorder}
            canSales={data.canSales} canStock={data.canStock}
            loading={data.loading} error={data.error}
            ask={ask} onAsked={() => setAsk(null)}
          />
        </div>

        <div className="space-y-5 min-w-0">
          {data.canSales && (
            <ForecastCard isRTL={isRTL} sales={data.sales} loading={data.loading} onAsk={() => setAsk('forecast')} />
          )}

          <section className="bg-card rounded-[24px] border shadow-md p-5" aria-label={t ? 'ملاحظات اليوم' : 'Today’s notes'}>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-primary" aria-hidden />
              {t ? 'ملاحظات اليوم' : 'Today’s notes'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">{t ? 'مبنية على بيانات متجرك' : 'Drawn from your shop’s data'}</p>
            {/* the notes alone come from the AI service; the conversation and forecast are real figures */}
            {usingMock('ai') && <MockDataBanner what={t ? 'خدمة الذكاء الاصطناعي' : 'the AI service'} />}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
                {DOMAINS.map(item => (
                  <button key={item.key} type="button" onClick={() => setDomain(item.key)}
                    aria-pressed={domain === item.key}
                    className={cn('px-2 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                      domain === item.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                    <item.icon className="w-3.5 h-3.5" />
                    {t ? item.ar : item.en}
                  </button>
                ))}
              </div>

              <Button onClick={generate} disabled={generating || !configured} size="sm" className="gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t ? 'توليد التحليلات' : 'Generate insights'}
              </Button>
            </div>

            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : !configured ? (
              // Honest about why the page is empty, rather than inventing an insight
              // about somebody's real shop.
              <UnavailableState
                title={t ? 'لم يُفعَّل الذكاء الاصطناعي بعد' : 'AI is not switched on yet'}
                message={t
                  ? 'هذه الواجهة جاهزة وتعرض ما يرسله الخادم فور تفعيل مزوّد الذكاء الاصطناعي. لن تُعرض أي نتيجة غير مبنية على بياناتك الفعلية.'
                  : 'This screen is ready and will show whatever the backend returns once an AI provider is switched on. Nothing is shown that is not drawn from your real data.'}
              />
            ) : insights.length === 0 ? (
              <UnavailableState
                title={t ? 'لا توجد ملاحظات حالياً' : 'No insights right now'}
                message={t
                  ? 'لم يجد التحليل ما يستحق الانتباه في هذه الفترة.'
                  : 'The analysis found nothing worth flagging for this period.'}
              />
            ) : (
              <div className="grid gap-3">
                {insights.map((insight, index) => {
                  const meta = SEVERITY[insight.severity];
                  const Icon = meta.icon;
                  return (
                    <motion.div key={insight.id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index, 8) * 0.04 }}
                      className={cn('rounded-[18px] border p-4', meta.cls)}>
                      <div className="flex items-start gap-2 mb-2">
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="font-semibold text-foreground flex-1">{insight.title}</p>
                        <Badge variant="outline" className="text-[10px]">{t ? meta.ar : meta.en}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.body}</p>

                      {/* Where it came from, so a reader can judge it rather than trust it */}
                      {insight.basis && (
                        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/60">
                          {t ? 'مبني على: ' : 'Based on: '}{insight.basis}
                          {insight.confidence !== null && ` · ${Math.round(insight.confidence * 100)}%`}
                        </p>
                      )}

                      {insight.actionLabel && insight.actionHref && (
                        <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                          <a href={insight.actionHref}>{insight.actionLabel}</a>
                        </Button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {(providerLabel || lastRunAt) && (
              <p className="text-xs text-muted-foreground mt-4">
                {providerLabel && `${t ? 'المزوّد: ' : 'Provider: '}${providerLabel}`}
                {providerLabel && lastRunAt && ' · '}
                {lastRunAt && `${t ? 'آخر تحليل: ' : 'Last run: '}${new Date(lastRunAt).toLocaleString(t ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB')}`}
              </p>
            )}

          </section>
        </div>
      </div>
    </AppLayout>
  );
}
