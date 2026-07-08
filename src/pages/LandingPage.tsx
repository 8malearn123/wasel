import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Smartphone, ShoppingCart, Package, Wrench, Store, BarChart3,
  Building2, Check, Zap, ArrowLeft, ShieldCheck, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: ShoppingCart, title: "نقطة بيع سريعة", desc: "بيع بالباركود أو IMEI مع فواتير ضريبية مبسطة ورمز QR لهيئة الزكاة" },
  { icon: Package, title: "إدارة مخزون ذكية", desc: "تتبع الأجهزة برقم IMEI والإكسسوارات بالكميات مع تنبيهات النفاد" },
  { icon: Wrench, title: "إدارة الصيانة", desc: "طلبات صيانة بمراحل واضحة، قطع غيار، وإشعار العميل عند الجاهزية" },
  { icon: Store, title: "متجر إلكتروني", desc: "متجرك الخاص على الإنترنت بهويتك وألوانك مع سلة وطلبات أونلاين" },
  { icon: BarChart3, title: "تقارير وأرباح", desc: "مبيعات وأرباح يومية وشهرية ولوحة تحكم مباشرة لكل فروعك" },
  { icon: Building2, title: "فروع متعددة", desc: "أدر عدة فروع ومستودعات بتحويلات مخزون موثقة بينها" },
];

const PLANS = [
  { name: "باقة لايت", price: 99, popular: false, points: ["فرع واحد و3 مستخدمين", "نقطة بيع ومخزون كامل", "فحص فني مجاني وضمان 30 يوم"] },
  { name: "باقة بلس", price: 199, popular: true, points: ["3 فروع و10 مستخدمين", "متجر إلكتروني وتقارير متقدمة", "خصم 15% على الصيانة وضمان 90 يوم"] },
  { name: "باقة برو", price: 399, popular: false, points: ["10 فروع و50 مستخدم", "أولوية VIP وجهاز بديل", "دعم مخصص 24/7 واستلام وتوصيل"] },
  { name: "باقة ماكس", price: 499, popular: false, points: ["للموزعين والتجار", "أسعار جملة ودفع آجل", "مدير حساب مخصص ولوحة موزع"] },
];

export default function LandingPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold leading-none">وصل</p>
              <p className="text-[11px] text-muted-foreground">نظام محلات الجوالات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
            <Button asChild className="bg-gradient-primary hover:opacity-90">
              <Link to="/auth">ابدأ مجاناً</Link>
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
              تجربة مجانية 14 يوماً — بدون بطاقة ائتمانية
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              نظام متكامل لإدارة
              <span className="text-gradient block mt-2">محلات الجوالات</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              نقطة بيع، مخزون بالـ IMEI، صيانة، متجر إلكتروني، وتقارير أرباح —
              كل ما يحتاجه محلك في منصة واحدة سهلة وسريعة.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button asChild size="lg" className="bg-gradient-primary hover:opacity-90 shadow-glow h-12 px-8 text-base">
                <Link to="/auth">
                  ابدأ تجربتك المجانية
                  <ArrowLeft className="w-4 h-4 mr-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                <Link to="/auth">جرّب حساب الديمو</Link>
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-success" /> فواتير متوافقة مع هيئة الزكاة</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-success" /> جاهز خلال دقائق</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-success" /> دعم عربي كامل</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">كل أدوات محلك في مكان واحد</h2>
          <p className="text-muted-foreground">صُمم خصيصاً لمحلات بيع وصيانة الجوالات</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-glow transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">باقات تناسب كل الأحجام</h2>
          <p className="text-muted-foreground">ابدأ صغيراً وكبّر متى ما احتجت — الأسعار شهرية</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`relative p-6 rounded-2xl border-2 bg-card ${p.popular ? "border-primary shadow-glow" : "border-border"}`}
            >
              {p.popular && (
                <span className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  الأكثر طلباً
                </span>
              )}
              <h3 className="font-bold text-lg text-center">{p.name}</h3>
              <p className="text-center my-4">
                <span className="text-4xl font-extrabold">{p.price}</span>
                <span className="text-muted-foreground text-sm"> ر.س/شهر</span>
              </p>
              <ul className="space-y-2.5 mb-6">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    {pt}
                  </li>
                ))}
              </ul>
              <Button asChild className={`w-full ${p.popular ? "bg-gradient-primary hover:opacity-90" : ""}`} variant={p.popular ? "default" : "outline"}>
                <Link to="/auth">اشترك الآن</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="rounded-3xl bg-gradient-primary p-10 md:p-14 text-center text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">جاهز تنقل محلك للمستوى التالي؟</h2>
          <p className="text-white/85 mb-8 max-w-xl mx-auto">
            سجّل الآن وابدأ البيع خلال دقائق — 14 يوماً مجاناً بكل المميزات.
          </p>
          <Button asChild size="lg" variant="secondary" className="h-12 px-8 text-base font-bold">
            <Link to="/auth">أنشئ حسابك مجاناً</Link>
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
            <span>منصة وصل — نظام محلات الجوالات</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="hover:text-primary transition-colors">تسجيل الدخول</Link>
            <Link to="/admin/login" className="hover:text-primary transition-colors">إدارة المنصة</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
