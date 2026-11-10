import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, BarChart3, ShoppingBag, Package, UserPlus, Target, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardExtras } from "@/hooks/useDashboardExtras";

/**
 * Claude Design's dashboard cards. Each one shows a figure the system really
 * has (useDashboardExtras / useDashboardData), says so when it could not load,
 * and links only to a screen that exists.
 */
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const compact = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : fmt(n);

function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block rounded-lg bg-muted animate-pulse", className)} role="status" aria-label="جارٍ التحميل" />;
}

function Change({ pct, label, onDark }: { pct: number | null; label: string; onDark?: boolean }) {
  if (pct === null) return <span className={cn("text-xs", onDark ? "text-[#1C1733]/70" : "text-muted-foreground")}>{label}</span>;
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold",
        onDark ? "bg-[#1C1733]/15 text-[#1C1733]" : up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")} dir="ltr">
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{up ? "+" : ""}{pct.toFixed(1)}%
      </span>
      <span className={onDark ? "text-[#1C1733]/75" : "text-muted-foreground"}>{label}</span>
    </span>
  );
}

/** «إيرادات الشهر حتى اليوم» — the orange card with a bar per day */
export function MonthToDateCard({ extras, loading, canOpenReports, className }: {
  extras: DashboardExtras | null; loading: boolean; canOpenReports: boolean; className?: string;
}) {
  const month = new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "long" });
  const max = Math.max(1, ...(extras?.monthDays.map(d => d.revenue) ?? [1]));
  const body = (
    <>
      <div aria-hidden="true" className="absolute -top-10 -left-10 w-40 h-40 rounded-[40px] bg-white/[0.12] rotate-[18deg]" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[#1C1733]/80">إيرادات {month} حتى اليوم</p>
          <div className="mt-2.5">
            {loading ? <Skeleton className="h-8 w-28 bg-white/30" /> : !extras ? (
              <p className="text-sm font-medium">تعذّر تحميل القيمة</p>
            ) : (
              <p className="flex items-baseline gap-1.5 leading-none">
                <span className="text-[34px] font-bold tabular-nums">{fmt(extras.monthRevenue)}</span>
                <span className="text-sm font-semibold">ر.س</span>
              </p>
            )}
          </div>
        </div>
        <span className="w-11 h-11 rounded-[14px] bg-[#1C1733] text-[#FF7A45] flex items-center justify-center shrink-0"><BarChart3 className="w-5 h-5" /></span>
      </div>
      <div className="relative flex items-end gap-1 h-16" aria-hidden="true">
        {(extras?.monthDays ?? []).map(d => (
          <span key={d.day} className="flex-1 rounded-md bg-[#1C1733]/80 min-h-[3px]" style={{ height: `${Math.max(5, (d.revenue / max) * 100)}%`, opacity: d.revenue > 0 ? 0.85 : 0.25 }} />
        ))}
      </div>
      {extras && (
        <div className="relative">
          <Change pct={extras.monthChange} onDark
            label={extras.monthChange === null ? "لا مبيعات في نفس الفترة من الشهر الماضي" : "عن نفس الفترة من الشهر الماضي"} />
        </div>
      )}
    </>
  );
  const cls = cn("month-card relative overflow-hidden rounded-[28px] p-5 sm:p-[22px] flex flex-col gap-3.5 min-w-0 text-[#1C1733]", className);
  return canOpenReports
    ? <Link to="/reports?tab=sales" className={cn(cls, "hover:-translate-y-0.5 transition-transform")}>{body}</Link>
    : <section className={cls}>{body}</section>;
}

function Tile({ icon: Icon, title, value, foot, to, loading }: {
  icon: typeof ShoppingBag; title: string; value: string; foot?: React.ReactNode; to?: string; loading: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">{title}</p>
        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-text flex items-center justify-center"><Icon className="w-[18px] h-[18px]" /></span>
      </div>
      {loading ? <Skeleton className="h-7 w-20" /> : <p className="text-[28px] font-bold tabular-nums leading-none text-foreground">{value}</p>}
      <div className="min-h-[18px] text-xs text-muted-foreground">{!loading && foot}</div>
    </>
  );
  const cls = "bg-card rounded-[22px] border shadow-md p-4 flex flex-col gap-3 min-w-0";
  return to ? <Link to={to} className={cn(cls, "hover:-translate-y-0.5 hover:shadow-lg transition-all")}>{inner}</Link> : <section className={cls}>{inner}</section>;
}

/** today's orders · active products · new customers this week */
export function DashboardTiles({ extras, loading, todaySales, className }: {
  extras: DashboardExtras | null; loading: boolean; todaySales: number; className?: string;
}) {
  const online = extras?.online;
  const customers = extras?.customers;
  const custChange = customers && customers.lastWeek > 0 ? ((customers.thisWeek - customers.lastWeek) / customers.lastWeek) * 100 : null;
  return (
    <div className={cn("grid gap-5 sm:grid-cols-3", className)}>
      <Tile icon={ShoppingBag} loading={loading} title="طلبات اليوم"
        value={fmt(todaySales + (online?.todayCount ?? 0))}
        foot={online ? (online.awaiting > 0 ? `${online.awaiting} طلب متجر بانتظار التجهيز` : `${todaySales} في الفروع · ${online.todayCount} من المتجر`) : `${todaySales} فاتورة في الفروع`}
        to={online ? "/sales?tab=orders" : undefined} />
      <Tile icon={Package} loading={loading} title="منتجات نشطة"
        value={extras ? fmt(extras.stock.devices + extras.stock.accessoryLines) : "—"}
        foot={extras ? (extras.stock.lowStock > 0 ? <span className="text-warning font-semibold">{extras.stock.lowStock} منخفضة المخزون</span> : "لا أصناف منخفضة") : undefined}
        to="/products?tab=inventory" />
      {customers ? (
        <Tile icon={UserPlus} loading={loading} title="عملاء جدد هذا الأسبوع"
          value={fmt(customers.thisWeek)}
          foot={<Change pct={custChange} label={custChange === null ? "لا عملاء جدد الأسبوع الماضي للمقارنة" : "عن الأسبوع الماضي"} />}
          to="/sales?tab=customers" />
      ) : (
        <Tile icon={Boxes} loading={loading} title="أصناف نفدت"
          value={extras ? fmt(extras.stock.outOfStock) : "—"}
          foot="إكسسوارات كميتها صفر" to="/products?tab=inventory" />
      )}
    </div>
  );
}

const DONUT_COLORS = ["#F04E1A", "#1C1733", "#5A48B5", "#FF8A55", "#17804A", "#C9C3DD"];

/** «تحليل المبيعات بالفئة» — the last 30 days, before VAT */
export function CategoryDonut({ extras, loading, className }: { extras: DashboardExtras | null; loading: boolean; className?: string }) {
  const rows = extras?.categories ?? [];
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((t, r) => t + r.revenue, 0);
  const slices = rest > 0 ? [...top, { category: "أخرى", revenue: rest }] : top;
  const total = slices.reduce((t, r) => t + r.revenue, 0);
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <section className={cn("bg-card rounded-[24px] border shadow-md p-5 flex flex-col gap-4 min-w-0", className)}>
      <div>
        <h3 className="font-bold text-foreground">تحليل المبيعات بالفئة</h3>
        <p className="text-xs text-muted-foreground mt-0.5">آخر 30 يوماً · قبل الضريبة</p>
      </div>
      {loading ? <Skeleton className="h-40 w-full" /> : total <= 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">لا مبيعات في آخر 30 يوماً</p>
      ) : (
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5">
          <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0 -rotate-90" role="img" aria-label="توزيع المبيعات على الفئات">
            <circle cx="70" cy="70" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="18" />
            {slices.map((s, i) => {
              const len = (s.revenue / total) * C;
              const el = <circle key={s.category} cx="70" cy="70" r={R} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
              offset += len;
              return el;
            })}
          </svg>
          <ul className="flex-1 w-full space-y-2">
            {slices.map((s, i) => (
              <li key={s.category} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="flex-1 truncate text-foreground">{s.category}</span>
                <span className="tabular-nums text-muted-foreground text-xs">{Math.round((s.revenue / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** «المنتجات والمخزون» — value, for sale, low, out, and the mix of lines */
export function StockSummaryCard({ extras, loading, className }: { extras: DashboardExtras | null; loading: boolean; className?: string }) {
  const s = extras?.stock;
  const mix = s ? [
    { label: "أجهزة", n: s.devices, color: "#F04E1A" },
    { label: "إكسسوارات", n: s.accessoryLines, color: "#1C1733" },
    ...(s.parts !== null ? [{ label: "قطع صيانة", n: s.parts, color: "#5A48B5" }] : []),
  ] : [];
  const mixTotal = mix.reduce((t, m) => t + m.n, 0);
  return (
    <section className={cn("bg-card rounded-[24px] border shadow-md p-5 flex flex-col gap-4 min-w-0", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">المنتجات والمخزون</h3>
        <Link to="/products?tab=inventory" className="text-xs font-semibold text-primary-text hover:underline">التفاصيل</Link>
      </div>
      {loading ? <Skeleton className="h-36 w-full" /> : !s ? (
        <p className="text-sm text-muted-foreground">تعذّر تحميل بيانات المخزون</p>
      ) : (
        <>
          <div>
            <p className="text-xs text-muted-foreground">قيمة المخزون بسعر البيع</p>
            <p className="mt-1 flex items-baseline gap-1.5"><span className="text-[28px] font-bold tabular-nums leading-none">{compact(s.retailValue)}</span><span className="text-sm text-muted-foreground">ر.س</span></p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "أجهزة متاحة", v: s.devicesForSale, cls: "" },
              { label: "منخفض المخزون", v: s.lowStock, cls: s.lowStock > 0 ? "text-warning" : "" },
              { label: "نفد من المخزون", v: s.outOfStock, cls: s.outOfStock > 0 ? "text-destructive" : "" },
            ].map(x => (
              <div key={x.label} className="rounded-2xl bg-muted/60 p-3 min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">{x.label}</p>
                <p className={cn("mt-1 text-lg font-bold tabular-nums", x.cls)}>{fmt(x.v)}</p>
              </div>
            ))}
          </div>
          {mixTotal > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">تركيبة الأصناف ({fmt(mixTotal)} صنفاً)</p>
              <div className="flex h-2.5 rounded-full overflow-hidden" aria-hidden="true">
                {mix.map(m => <span key={m.label} style={{ width: `${(m.n / mixTotal) * 100}%`, background: m.color }} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {mix.map(m => <span key={m.label} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: m.color }} />{m.label} {fmt(m.n)}</span>)}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** «هدف الشهر» — the shop's monthly target from HR settings, against the month so far */
export function MonthlyTargetCard({ extras, loading, target, canEditTarget, className }: {
  extras: DashboardExtras | null; loading: boolean; target: number; canEditTarget: boolean; className?: string;
}) {
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  const month = now.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "long" });
  const done = extras?.monthRevenue ?? 0;
  const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;
  const pace = (day / days) * 100;
  const perDay = target > done ? (target - done) / Math.max(1, days - day + 1) : 0;
  const R = 44, C = 2 * Math.PI * R;
  return (
    <section className={cn("bg-card rounded-[24px] border shadow-md p-5 flex flex-col gap-4 min-w-0", className)}>
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-text flex items-center justify-center"><Target className="w-[18px] h-[18px]" /></span>
        <h3 className="font-bold text-foreground">هدف {month}</h3>
      </div>
      {loading ? <Skeleton className="h-32 w-full" /> : target <= 0 ? (
        <div className="text-sm text-muted-foreground space-y-2">
          <p>لم يُحدَّد هدف شهري للمتجر بعد.</p>
          {canEditTarget && <Link to="/team?tab=payroll" className="text-primary-text font-semibold hover:underline">حدّده من الموارد البشرية</Link>}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 110 110" className="w-24 h-24 -rotate-90 shrink-0" role="img" aria-label={`أُنجز ${Math.round(pct)}٪ من الهدف`}>
              <circle cx="55" cy="55" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
              <circle cx="55" cy="55" r={R} fill="none" stroke="#F04E1A" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} />
            </svg>
            <div>
              <p className="text-3xl font-bold tabular-nums">{Math.round(pct)}%</p>
              <p className="text-xs text-muted-foreground">من {compact(target)} ر.س</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            اليوم {day} من {days} · المتوقع {Math.round(pace)}%.
            {perDay > 0 ? <> تحتاج <span className="font-semibold text-foreground">{fmt(perDay)} ر.س</span> يومياً لبلوغ الهدف.</> : <span className="text-success font-semibold"> بلغت الهدف.</span>}
          </p>
        </>
      )}
    </section>
  );
}
