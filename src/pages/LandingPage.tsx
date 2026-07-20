import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Smartphone, ShoppingCart, Package, Ticket, Store, BarChart3,
  Building2, Check, Zap, ArrowLeft, ArrowRight, ShieldCheck, Clock,
  Sun, Moon, Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";
import { useTheme } from "@/hooks/useTheme";

const FEATURES = [
  { icon: ShoppingCart, ar: { t: "نقطة بيع سريعة", d: "بيع بالباركود أو IMEI مع فواتير ضريبية مبسطة ورمز QR لهيئة الزكاة" }, en: { t: "Fast Point of Sale", d: "Sell by barcode or IMEI with simplified tax invoices and ZATCA QR codes" } },
  { icon: Package, ar: { t: "إدارة مخزون ذكية", d: "تتبع الأجهزة برقم IMEI والإكسسوارات بالكميات مع تنبيهات النفاد" }, en: { t: "Smart Inventory", d: "Track devices by IMEI and accessories by quantity, with low-stock alerts" } },
  { icon: Ticket, ar: { t: "كوبونات وعروض", d: "كوبونات خصم وحملات تسويقية ونظام نقاط ولاء يرجّع عملاءك" }, en: { t: "Coupons & Campaigns", d: "Discount coupons, marketing campaigns, and a loyalty points program" } },
  { icon: Store, ar: { t: "متجر إلكتروني", d: "متجرك الخاص على الإنترنت بهويتك وألوانك مع سلة وطلبات أونلاين" }, en: { t: "Online Store", d: "Your own branded web store with cart and online orders" } },
  { icon: BarChart3, ar: { t: "تقارير وأرباح", d: "مبيعات وأرباح يومية وشهرية ولوحة تحكم مباشرة لكل فروعك" }, en: { t: "Reports & Profits", d: "Daily and monthly sales, profits, and a live dashboard for all branches" } },
  { icon: Building2, ar: { t: "فروع متعددة", d: "أدر عدة فروع ومستودعات بتحويلات مخزون موثقة بينها" }, en: { t: "Multi-Branch", d: "Manage branches and warehouses with documented stock transfers" } },
];

const PLANS = [
  { price: 99, popular: false, ar: { n: "باقة لايت", p: ["فرع واحد ومستخدمون بلا حدود", "نقطة بيع ومخزون كامل", "فواتير ضريبية برمز QR"] }, en: { n: "Lite Plan", p: ["1 branch, unlimited users", "Full POS and inventory", "Tax invoices with QR codes"] } },
  { price: 399, popular: true, ar: { n: "باقة برو", p: ["فرع واحد ومستخدمون بلا حدود", "متجر إلكتروني وتقارير متقدمة", "كوبونات ونقاط ولاء ودعم 24/7"] }, en: { n: "Pro Plan", p: ["1 branch, unlimited users", "Online store & advanced reports", "Coupons, loyalty & 24/7 support"] } },
  { price: 499, popular: false, ar: { n: "باقة ماكس", p: ["فرع واحد ومستخدمون بلا حدود", "أسعار جملة ودفع آجل", "مدير حساب مخصص ولوحة موزع"] }, en: { n: "Max Plan", p: ["1 branch, unlimited users", "Wholesale prices, credit terms", "Dedicated account manager"] } },
];

export default function LandingPage() {
  const { language, setLanguage, isRTL } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const ar = language === "ar";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/brand/app-icon.svg" alt="وصل" className="w-9 h-9 rounded-xl" />
            <div>
              <img src="/brand/wordmark-ink.svg" alt="وصل" className="h-4 w-auto dark:hidden" />
              <img src="/brand/wordmark-white.svg" alt="وصل" className="h-4 w-auto hidden dark:block" />
              <p className="text-[11px] text-muted-foreground mt-0.5">{ar ? "نظام محلات الجوالات" : "Phone Shop System"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={isDark ? (ar ? "الوضع الفاتح" : "Light mode") : (ar ? "الوضع الداكن" : "Dark mode")}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            {/* Language toggle */}
            <Button
              variant="ghost"
              className="gap-1.5 px-2.5"
              onClick={() => setLanguage(ar ? "en" : "ar")}
              title={ar ? "English" : "العربية"}
            >
              <Languages className="w-5 h-5" />
              <span className="text-xs font-bold">{ar ? "EN" : "ع"}</span>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/auth">{ar ? "تسجيل الدخول" : "Sign in"}</Link>
            </Button>
            <Button asChild className="bg-gradient-primary hover:opacity-90">
              <Link to="/auth">{ar ? "ابدأ مجاناً" : "Start free"}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-40 -right-24 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              {ar ? "تجربة مجانية 14 يوماً — بدون بطاقة ائتمانية" : "14-day free trial — no credit card required"}
            </span>
            <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              {ar ? "نظام متكامل لإدارة" : "The all-in-one system for"}
              <span className="text-gradient block mt-2">{ar ? "محلات الجوالات" : "phone shops"}</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              {ar
                ? "نقطة بيع، مخزون بالـ IMEI، متجر إلكتروني، وتقارير أرباح — كل ما يحتاجه محلك في منصة واحدة سهلة وسريعة."
                : "POS, IMEI inventory, an online store, and profit reports — everything your shop needs in one fast, simple platform."}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button asChild size="lg" className="bg-gradient-primary hover:opacity-90 shadow-glow h-12 px-8 text-base">
                <Link to="/auth">
                  {ar ? "ابدأ تجربتك المجانية" : "Start your free trial"}
                  <Arrow className={isRTL ? "w-4 h-4 mr-2" : "w-4 h-4 ml-2"} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                <Link to="/auth">{ar ? "جرّب حساب الديمو" : "Try the demo"}</Link>
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-success" /> {ar ? "فواتير متوافقة مع هيئة الزكاة" : "ZATCA-compliant invoices"}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-success" /> {ar ? "جاهز خلال دقائق" : "Ready in minutes"}</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-success" /> {ar ? "دعم عربي كامل" : "Full Arabic support"}</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">{ar ? "كل أدوات محلك في مكان واحد" : "All your shop's tools in one place"}</h2>
          <p className="text-muted-foreground">{ar ? "صُمم خصيصاً لمحلات بيع الجوالات والإكسسوارات" : "Built specifically for phone and accessory shops"}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const c = ar ? f.ar : f.en;
            return (
              <motion.div
                key={c.t}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-glow transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold mb-1.5">{c.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.d}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">{ar ? "باقات تناسب كل الأحجام" : "Plans for every size"}</h2>
          <p className="text-muted-foreground">{ar ? "ابدأ صغيراً وكبّر متى ما احتجت — الأسعار شهرية" : "Start small and grow anytime — prices are monthly"}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => {
            const c = ar ? p.ar : p.en;
            return (
              <motion.div
                key={c.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`relative p-6 rounded-2xl border-2 bg-card ${p.popular ? "border-primary shadow-glow" : "border-border"}`}
              >
                {p.popular && (
                  <span className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {ar ? "الأكثر طلباً" : "Most popular"}
                  </span>
                )}
                <h3 className="font-bold text-lg text-center">{c.n}</h3>
                <p className="text-center my-4">
                  <span className="text-4xl font-extrabold">{p.price}</span>
                  <span className="text-muted-foreground text-sm"> {ar ? "ر.س/شهر" : "SAR/mo"}</span>
                </p>
                <ul className="space-y-2.5 mb-6">
                  {c.p.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Button asChild className={`w-full ${p.popular ? "bg-gradient-primary hover:opacity-90" : ""}`} variant={p.popular ? "default" : "outline"}>
                  <Link to="/auth">{ar ? "اشترك الآن" : "Subscribe"}</Link>
                </Button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="rounded-3xl bg-gradient-primary p-10 md:p-14 text-center text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            {ar ? "جاهز تنقل محلك للمستوى التالي؟" : "Ready to level up your shop?"}
          </h2>
          <p className="text-white/85 mb-8 max-w-xl mx-auto">
            {ar ? "سجّل الآن وابدأ البيع خلال دقائق — 14 يوماً مجاناً بكل المميزات." : "Sign up now and start selling in minutes — 14 days free with every feature."}
          </p>
          <Button asChild size="lg" variant="secondary" className="h-12 px-8 text-base font-bold">
            <Link to="/auth">{ar ? "أنشئ حسابك مجاناً" : "Create your free account"}</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <span>{ar ? "منصة وصل — نظام محلات الجوالات" : "Wasel — Phone Shop System"}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="hover:text-primary transition-colors">{ar ? "تسجيل الدخول" : "Sign in"}</Link>
            <Link to="/admin/login" className="hover:text-primary transition-colors">{ar ? "إدارة المنصة" : "Platform admin"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
