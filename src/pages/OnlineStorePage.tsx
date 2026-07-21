import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Store, Palette, Truck, Plus, Trash2, Save, ExternalLink, Eye, EyeOff,
  Loader2, Tag, Link2, Sparkles, Search, FileText, Image as ImageIcon,
  Upload, Megaphone, Type, Star, Layout, Check, ArrowRight,
  Monitor, Smartphone, RotateCcw, GripVertical, ChevronDown, ArrowUp, ArrowDown, Rocket,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlTabs } from '@/components/common/UrlTabs';
import { ColorWheel } from '@/components/common/ColorWheel';
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useStoreSettings, useStorePages, uploadStoreAsset, DEFAULT_HOME_SECTIONS, type StorePage, type DesignExtras } from "@/hooks/useOnlineStore";
import { toast } from "sonner";

// ===== استوديو التصميم الكامل — حصري لباقة ماكس =====
const COLOR_PRESETS = [
  { name: "تيل ملكي", primary: "#0d9488", secondary: "#f59e0b" },
  { name: "أزرق احترافي", primary: "#2563eb", secondary: "#0ea5e9" },
  { name: "بنفسجي عصري", primary: "#7c3aed", secondary: "#ec4899" },
  { name: "أسود فاخر", primary: "#111827", secondary: "#d4af37" },
  { name: "أحمر جريء", primary: "#dc2626", secondary: "#f97316" },
  { name: "أخضر طبيعي", primary: "#16a34a", secondary: "#65a30d" },
  { name: "ذهبي فاخر", primary: "#b08a57", secondary: "#17120f" },
  { name: "نيلي ملكي", primary: "#4338ca", secondary: "#f59e0b" },
  { name: "سماوي منعش", primary: "#0284c7", secondary: "#22c55e" },
  { name: "وردي أنيق", primary: "#db2777", secondary: "#f472b6" },
  { name: "رمادي راقي", primary: "#475569", secondary: "#94a3b8" },
  { name: "زيتوني دافئ", primary: "#4d7c0f", secondary: "#d97706" },
];

const FONT_SAMPLE = "أهلاً بكم في متجرنا";
const FONT_PRESETS = [
  { id: "cairo", name: "Cairo", desc: "عصري وواضح", gf: "Cairo:wght@400;700", style: { fontFamily: '"Cairo", sans-serif' } },
  { id: "tajawal", name: "Tajawal", desc: "ناعم وبسيط", gf: "Tajawal:wght@400;700", style: { fontFamily: '"Tajawal", sans-serif' } },
  { id: "ibm_plex", name: "IBM Plex Arabic", desc: "رسمي أنيق", gf: "IBM+Plex+Sans+Arabic:wght@400;700", style: { fontFamily: '"IBM Plex Sans Arabic", sans-serif' } },
  { id: "noto", name: "Noto Kufi", desc: "كوفي حديث", gf: "Noto+Kufi+Arabic:wght@400;700", style: { fontFamily: '"Noto Kufi Arabic", sans-serif' } },
  { id: "almarai", name: "Almarai", desc: "نظيف ومريح للقراءة", gf: "Almarai:wght@400;700", style: { fontFamily: '"Almarai", sans-serif' } },
  { id: "changa", name: "Changa", desc: "قوي للعناوين", gf: "Changa:wght@400;700", style: { fontFamily: '"Changa", sans-serif' } },
  { id: "elmessiri", name: "El Messiri", desc: "فخم بلمسة عربية", gf: "El+Messiri:wght@400;700", style: { fontFamily: '"El Messiri", sans-serif' } },
  { id: "amiri", name: "Amiri", desc: "كلاسيكي أصيل", gf: "Amiri:wght@400;700", style: { fontFamily: '"Amiri", serif' } },
  { id: "reemkufi", name: "Reem Kufi", desc: "هندسي مميز", gf: "Reem+Kufi:wght@400;700", style: { fontFamily: '"Reem Kufi", sans-serif' } },
  { id: "lalezar", name: "Lalezar", desc: "جريء للعروض", gf: "Lalezar", style: { fontFamily: '"Lalezar", system-ui, sans-serif' } },
];

// أسماء أقسام الصفحة الرئيسية في محرر المتجر
const SECTION_META: Record<string, { name: string; desc: string }> = {
  hero: { name: "البنر الرئيسي", desc: "الواجهة الترحيبية بأعلى المتجر" },
  wide: { name: "البنرات العريضة", desc: "بنرات عالية بعرض الصفحة" },
  feature: { name: "الصور المميزة", desc: "صور كبيرة تبرز العروض" },
  divider: { name: "الفاصل العالي", desc: "شريط ملون بجملة تسويقية" },
  gallery: { name: "معرض الصور", desc: "صور حرة مع تعليقات" },
  text: { name: "كلامك الخاص", desc: "عنوان ورسالة بأسلوبك" },
  categories: { name: "تسوّق حسب الفئة", desc: "شبكة التصنيفات" },
  products: { name: "الأكثر مبيعاً", desc: "شبكة المنتجات" },
  reviews: { name: "آراء العملاء", desc: "تقييمات وشهادات عملائك" },
  perks: { name: "مميزات المتجر", desc: "توصيل، ضمان، دفع آمن" },
  support: { name: "خدمة العملاء", desc: "واتساب واتصال وساعات العمل" },
};

// عينات المنتجات في المعاينة الحية
const PV_PRODUCTS = [
  { name: "iPhone 15 Pro", price: "4,299", tag: "جديد" },
  { name: "سماعة AirPods Pro", price: "899", tag: "" },
  { name: "شاحن متنقل 20K", price: "149", tag: "الأكثر مبيعاً" },
];
const PV_CATS = [
  { icon: "📱", name: "الجوالات" },
  { icon: "🎧", name: "السماعات" },
  { icon: "🔌", name: "الشواحن" },
  { icon: "⌚", name: "الساعات" },
];

// ألوان جاهزة للمصمم المبسط (باقة برو)
const PRO_COLOR_PRESETS = [
  { name: "أزرق وصل", primary: "#2563eb", secondary: "#f59e0b" },
  { name: "تركواز هادئ", primary: "#0f766e", secondary: "#f59e0b" },
  { name: "أسود أنيق", primary: "#111827", secondary: "#f59e0b" },
];

// ألوان أساسية منفردة للمصمم المبسط — تغير اللون الأساسي مباشرة
const PRO_BASIC_COLORS = [
  { name: "أحمر", hex: "#dc2626" },
  { name: "برتقالي", hex: "#ea580c" },
  { name: "أصفر ذهبي", hex: "#d97706" },
  { name: "أخضر", hex: "#16a34a" },
  { name: "تركواز", hex: "#0d9488" },
  { name: "أزرق فاتح", hex: "#0284c7" },
  { name: "أزرق", hex: "#2563eb" },
  { name: "كحلي", hex: "#1e3a8a" },
  { name: "بنفسجي", hex: "#7c3aed" },
  { name: "وردي", hex: "#db2777" },
  { name: "بني", hex: "#78350f" },
  { name: "أسود", hex: "#111827" },
];

// ألوان جاهزة لخط المتجر
const FONT_COLORS = [
  { name: "أسود", hex: "#111827" },
  { name: "رمادي غامق", hex: "#374151" },
  { name: "كحلي", hex: "#1e3a5f" },
  { name: "أزرق بترولي", hex: "#0c4a6e" },
  { name: "أخضر غامق", hex: "#14532d" },
  { name: "بني", hex: "#5b3a29" },
  { name: "عنابي", hex: "#7f1d1d" },
  { name: "بنفسجي غامق", hex: "#4c1d95" },
];

// كل قالب معه إعدادات معاينة مصغرة تحاكي روح التصميم
const THEMES = [
  {
    id: "modern", name: "عصري", desc: "تصميم نظيف بأقواس ناعمة وظلال خفيفة", emoji: "✨",
    pv: { bg: "#eef2ff", hero: "linear-gradient(135deg,#6366f1,#a855f7)", tile: "#ffffff", bar: "#c7d2fe", dot: "#6366f1", radius: 14, tileRadius: 8, border: "transparent" },
  },
  {
    id: "minimal", name: "بسيط", desc: "أبيض، تباعد واسع، خطوط دقيقة", emoji: "◯",
    pv: { bg: "#ffffff", hero: "#f4f4f5", tile: "#fafafa", bar: "#e4e4e7", dot: "#18181b", radius: 4, tileRadius: 3, border: "#e4e4e7" },
  },
  {
    id: "bold", name: "جريء", desc: "ألوان قوية، خطوط ثقيلة، تباين عالي", emoji: "⚡",
    pv: { bg: "#0f172a", hero: "linear-gradient(120deg,#f97316,#ef4444)", tile: "#1e293b", bar: "#f97316", dot: "#facc15", radius: 8, tileRadius: 6, border: "transparent" },
  },
  {
    id: "classic", name: "كلاسيكي", desc: "زوايا حادة، تصميم تقليدي راقي", emoji: "♛",
    pv: { bg: "#faf6ee", hero: "#1e2a4a", tile: "#ffffff", bar: "#d4af37", dot: "#d4af37", radius: 0, tileRadius: 0, border: "#e6dcc3" },
  },
];

export default function OnlineStorePage() {
  const { merchant, subscription } = useAuth();
  const { settings, categories, loading, initStore, updateSettings, addCategory, removeCategory } = useStoreSettings();
  const { pages, upsertPage, deletePage, designExtras, saveDesignExtras } = useStorePages();
  const [newCat, setNewCat] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<Partial<StorePage> | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const ogRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const wideRef = useRef<HTMLInputElement>(null);
  const featureRef = useRef<HTMLInputElement>(null);

  // إعدادات التصميم الحر (باقة ماكس)
  const [designSection, setDesignSection] = useState<string | null>(null);
  const [colorTarget, setColorTarget] = useState<'primary_color' | 'secondary_color'>('primary_color');
  // محرر المتجر (ماكس)
  const [openPanel, setOpenPanel] = useState<string | null>('logo');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const dragIdx = useRef<number | null>(null);
  const [extras, setExtras] = useState<DesignExtras>({ gallery: [] });
  const [extrasDirty, setExtrasDirty] = useState(false);
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  const [savingExtras, setSavingExtras] = useState(false);
  useEffect(() => {
    if (designExtras && !extrasLoaded) {
      setExtras(designExtras);
      setExtrasLoaded(true);
    }
  }, [designExtras, extrasLoaded]);

  // تحميل كل خطوط المعاينة مرة واحدة حتى تظهر عينات الخطوط بشكلها الحقيقي
  useEffect(() => {
    const id = 'design-fonts-preview';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${FONT_PRESETS.map(f => `family=${f.gf}`).join('&')}&display=swap`;
    document.head.appendChild(link);
  }, []);

  const updExtras = (patch: Partial<DesignExtras>) => {
    setExtras(prev => ({ ...prev, ...patch }));
    setExtrasDirty(true);
  };

  const saveExtras = async () => {
    setSavingExtras(true);
    await saveDesignExtras(extras);
    setExtrasDirty(false);
    setSavingExtras(false);
  };

  if (loading) {
    return (
      <AppLayout title="المتجر الإلكتروني" subtitle="إدارة وتخصيص متجرك">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!settings) {
    return (
      <AppLayout title="المتجر الإلكتروني" subtitle="إدارة متجرك على الإنترنت">
        <div className="flex flex-col items-center justify-center py-20">
          <Store className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">لم يتم إنشاء متجر بعد</h2>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            أنشئ متجرك الإلكتروني لتتمكن من تخصيصه احترافياً ونشره لعملائك
          </p>
          <Button onClick={initStore} size="lg">
            <Store className="w-5 h-5 me-2" /> إنشاء المتجر الإلكتروني
          </Button>
        </div>
      </AppLayout>
    );
  }

  const val = (key: string) => form[key] ?? (settings as any)[key] ?? "";
  const set = (key: string, v: any) => setForm(prev => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    if (Object.keys(form).length === 0) return;
    setSaving(true);
    await updateSettings(form);
    setForm({});
    setSaving(false);
  };

  const handleUpload = async (file: File, kind: 'logo' | 'banner' | 'hero' | 'og', field: string) => {
    if (!merchant) return;
    setUploading(field);
    const url = await uploadStoreAsset(merchant.id, file, kind);
    if (url) {
      await updateSettings({ [field]: url } as any);
    }
    setUploading(null);
  };

  const handleGalleryUpload = async (file: File) => {
    if (!merchant) return;
    setUploading('gallery');
    const url = await uploadStoreAsset(merchant.id, file, 'gallery');
    if (url) {
      setExtras(prev => ({ ...prev, gallery: [...(prev.gallery || []), { image_url: url }] }));
      setExtrasDirty(true);
    }
    setUploading(null);
  };

  // رفع صورة لقسم البنر العريض أو الصور المميزة
  const handleSectionUpload = async (file: File, section: 'wide' | 'feature') => {
    if (!merchant) return;
    setUploading(section);
    const url = await uploadStoreAsset(merchant.id, file, 'banner');
    if (url) {
      setExtras(prev => section === 'wide'
        ? { ...prev, wide_banners: [...(prev.wide_banners || []), { image_url: url }] }
        : { ...prev, feature_images: [...(prev.feature_images || []), { image_url: url }] }
      );
      setExtrasDirty(true);
    }
    setUploading(null);
  };

  const READY_PERKS = [
    { icon: '🚚', title: 'توصيل سريع', desc: 'نوصل طلبك لباب بيتك بأسرع وقت' },
    { icon: '🛡️', title: 'ضمان موثوق', desc: 'كل منتجاتنا أصلية وعليها ضمان' },
    { icon: '💳', title: 'دفع آمن', desc: 'طرق دفع متعددة ومحمية بالكامل' },
    { icon: '🎧', title: 'دعم متواصل', desc: 'فريقنا جاهز يخدمك في أي وقت' },
  ];

  // ===== محرر المتجر (ماكس): أقسام الصفحة وحفظ ونشر =====
  const homeSections = (extras.home_sections && extras.home_sections.length > 0)
    ? [
        ...extras.home_sections,
        ...DEFAULT_HOME_SECTIONS.filter(d => !extras.home_sections!.some(s => s.key === d.key)),
      ]
    : DEFAULT_HOME_SECTIONS;

  const reorderSections = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= homeSections.length || to >= homeSections.length) return;
    const list = [...homeSections];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    updExtras({ home_sections: list });
  };

  const toggleHomeSection = (key: string) =>
    updExtras({ home_sections: homeSections.map(s => s.key === key ? { ...s, visible: s.visible === false } : s) });

  const publishAll = async () => {
    setSaving(true);
    const pending = { ...form };
    if (!settings.is_published) (pending as any).is_published = true;
    if (Object.keys(pending).length > 0) {
      await updateSettings(pending);
      setForm({});
    }
    if (extrasDirty) {
      await saveDesignExtras(extras);
      setExtrasDirty(false);
    }
    setSaving(false);
    toast.success('✓ تم نشر تصميم متجرك بنجاح');
  };

  const resetDesigner = () => {
    setForm(prev => ({
      ...prev,
      theme_id: 'modern', font_family: 'cairo',
      primary_color: '#2563eb', secondary_color: '#f59e0b',
    }));
    updExtras({
      icon_shape: 'circle', button_radius: 12, button_color: undefined,
      hero_button_text: undefined, home_sections: DEFAULT_HOME_SECTIONS,
    });
    toast.info('تم استعادة الافتراضي — اضغط "نشر التغييرات" للحفظ');
  };

  // قيم المعاينة الحية
  const pvFont = FONT_PRESETS.find(f => f.id === (val("font_family") || "cairo"))?.style || {};
  const pvPrimary = val("primary_color") || '#2563eb';
  const pvSecondary = val("secondary_color") || '#f59e0b';
  const pvBtn = extras.button_color || pvPrimary;
  const pvRadius = extras.button_radius ?? 12;
  const pvVisible = homeSections.filter(s => s.visible !== false).map(s => s.key);
  const pvName = val("store_name") || "متجرك";

  const storeUrl = `${window.location.origin}/store/${settings.slug}`;
  const dirty = Object.keys(form).length > 0;
  // باقة ماكس (الموزع) والفترة التجريبية: استوديو التصميم الكامل
  const isMax = subscription?.plan === 'Distributor' || subscription?.plan === 'trial';
  // باقة برو: مصمم متجر مبسط (شعار، بانر، ألوان جاهزة)
  const isPro = subscription?.plan === 'Enterprise';

  return (
    <AppLayout title="المتجر الإلكتروني" subtitle="إدارة وتخصيص احترافي لمتجرك">
      {/* Status bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className={cn("p-4 rounded-xl border mb-6 flex items-center justify-between flex-wrap gap-3",
          settings.is_published ? "bg-green-500/10 border-green-500/30" : "bg-muted/30 border-border"
        )}>
        <div className="flex items-center gap-3">
          {settings.is_published ? <Eye className="w-5 h-5 text-green-600" /> : <EyeOff className="w-5 h-5 text-muted-foreground" />}
          <div>
            <p className="font-semibold text-foreground">
              {settings.is_published ? "المتجر منشور ومتاح للعملاء" : "المتجر مخفي (مسودة)"}
            </p>
            <p className="text-sm text-muted-foreground font-mono" dir="ltr">{storeUrl}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={storeUrl} target="_blank" rel="noopener">
              <ExternalLink className="w-4 h-4 me-1" /> معاينة
            </a>
          </Button>
          <div className="flex items-center gap-2 ps-2 border-s">
            <span className="text-xs text-muted-foreground">منشور</span>
            <Switch
              checked={!!val("is_published")}
              onCheckedChange={(v) => { set("is_published", v); updateSettings({ is_published: v } as any); }}
            />
          </div>
        </div>
      </motion.div>

      {dirty && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="sticky top-2 z-30 mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 backdrop-blur p-3 shadow-sm">
          <p className="text-sm font-medium">لديك تغييرات غير محفوظة ({Object.keys(form).length})</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setForm({})}>تجاهل</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}
              حفظ التغييرات
            </Button>
          </div>
        </motion.div>
      )}

      <UrlTabs defaultTab="general" dir="rtl">

        {/* GENERAL */}
        <TabsContent value="general">
          <div className="bg-card rounded-xl border p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>اسم المتجر</Label>
                <Input value={val("store_name")} onChange={e => set("store_name", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>رابط المتجر (Slug)</Label>
                <Input value={val("slug")} onChange={e => set("slug", e.target.value)} className="font-mono mt-1" dir="ltr" />
                <p className="text-xs text-muted-foreground mt-1 truncate" dir="ltr">{window.location.origin}/store/{val("slug")}</p>
              </div>
            </div>
            <div>
              <Label>وصف المتجر القصير</Label>
              <Textarea value={val("description")} onChange={e => set("description", e.target.value)} className="mt-1" rows={2} placeholder="يظهر تحت اسم المتجر..." />
            </div>
            <div>
              <Label>رمز العملة</Label>
              <Input value={val("currency_symbol") || "ر.س"} onChange={e => set("currency_symbol", e.target.value)} className="mt-1 w-32" />
            </div>
            <div>
              <Label>سياسة الاسترجاع</Label>
              <Textarea value={val("return_policy")} onChange={e => set("return_policy", e.target.value)} className="mt-1" rows={3} />
            </div>
          </div>
        </TabsContent>

        {/* DESIGN STUDIO — حصري لباقة ماكس */}
        <TabsContent value="design" className="space-y-6">
          {isMax ? (
            <>
              {/* ===== محرر المتجر — لوحة تحكم + معاينة حية ===== */}
              {designSection === null && (
                <div className="space-y-4">
                  {/* شريط المحرر */}
                  <div className="bg-card rounded-xl border p-3 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black">م</div>
                      <div>
                        <p className="font-bold text-sm">محرر المتجر</p>
                        <p className="text-[11px] text-muted-foreground">{pvName} · {(dirty || extrasDirty) ? 'مسودة غير محفوظة' : 'كل التغييرات محفوظة'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex rounded-lg border overflow-hidden">
                        <button type="button" onClick={() => setPreviewDevice('desktop')}
                          className={cn("px-3 h-9 text-xs font-semibold flex items-center gap-1.5 transition-colors", previewDevice === 'desktop' ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                          <Monitor className="w-3.5 h-3.5" /> سطح المكتب
                        </button>
                        <button type="button" onClick={() => setPreviewDevice('mobile')}
                          className={cn("px-3 h-9 text-xs font-semibold flex items-center gap-1.5 transition-colors", previewDevice === 'mobile' ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                          <Smartphone className="w-3.5 h-3.5" /> جوال
                        </button>
                      </div>
                      <Button variant="outline" size="sm" onClick={resetDesigner}>
                        <RotateCcw className="w-4 h-4 me-1" /> استعادة الافتراضي
                      </Button>
                      <Button size="sm" onClick={publishAll} disabled={saving || savingExtras}>
                        {saving || savingExtras ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Rocket className="w-4 h-4 me-1" />}
                        نشر التغييرات
                      </Button>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
                    {/* ===== لوحة التحكم ===== */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted-foreground px-1">الهوية والشكل</p>

                      {/* الشعار واسم المتجر */}
                      <div className="bg-card rounded-xl border overflow-hidden">
                        <button type="button" onClick={() => setOpenPanel(openPanel === 'logo' ? null : 'logo')}
                          className="w-full flex items-center justify-between p-4 text-right">
                          <div className="flex items-center gap-3">
                            <ImageIcon className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-semibold text-sm">الشعار واسم المتجر</p>
                              <p className="text-[11px] text-muted-foreground">النص المعروض وأيقونة العلامة</p>
                            </div>
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'logo' && "rotate-180")} />
                        </button>
                        {openPanel === 'logo' && (
                          <div className="px-4 pb-4 space-y-3 border-t pt-3">
                            <div>
                              <Label className="text-xs">اسم المتجر</Label>
                              <Input value={val("store_name")} onChange={e => set("store_name", e.target.value)} className="mt-1 h-9" />
                            </div>
                            <div>
                              <Label className="text-xs">شكل أيقونة العلامة</Label>
                              <div className="flex gap-2 mt-1.5">
                                {([
                                  { id: 'circle', name: 'دائري' },
                                  { id: 'square', name: 'مربع' },
                                ] as const).map(sh => (
                                  <button key={sh.id} type="button" onClick={() => updExtras({ icon_shape: sh.id })}
                                    className={cn("flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all",
                                      (extras.icon_shape || 'circle') === sh.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                                    <span className={cn("w-6 h-6 flex items-center justify-center text-white text-[10px] font-black", sh.id === 'circle' ? "rounded-full" : "rounded-md")}
                                      style={{ background: pvPrimary }}>
                                      {pvName.charAt(0)}
                                    </span>
                                    {sh.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* منطقة سحب وإفلات الشعار */}
                            <input ref={logoRef} type="file" accept="image/*" className="hidden"
                              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo', 'logo_url')} />
                            <div
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleUpload(f, 'logo', 'logo_url'); }}
                              className="border-2 border-dashed rounded-xl p-5 text-center hover:border-primary/60 hover:bg-primary/5 transition-all">
                              {settings.logo_url ? (
                                <img src={settings.logo_url} alt="logo"
                                  className={cn("w-16 h-16 mx-auto object-contain border bg-muted/30 mb-2", (extras.icon_shape || 'circle') === 'circle' ? "rounded-full" : "rounded-lg")} />
                              ) : (
                                <span className={cn("w-14 h-14 mx-auto mb-2 flex items-center justify-center text-white text-xl font-black", (extras.icon_shape || 'circle') === 'circle' ? "rounded-full" : "rounded-lg")}
                                  style={{ background: pvPrimary, display: 'flex' }}>
                                  {pvName.charAt(0)}
                                </span>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {uploading === 'logo_url' ? 'جاري الرفع...' : 'اسحب صورة الشعار هنا أو'}
                                {' '}
                                <button type="button" className="text-primary font-semibold underline-offset-2 hover:underline"
                                  onClick={() => logoRef.current?.click()} disabled={uploading === 'logo_url'}>
                                  تصفّح الملفات
                                </button>
                              </p>
                            </div>
                            {settings.logo_url && (
                              <Button variant="ghost" size="sm" className="text-destructive w-full" onClick={() => updateSettings({ logo_url: null } as any)}>
                                <Trash2 className="w-4 h-4 me-1" /> إزالة الشعار
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* الخط */}
                      <div className="bg-card rounded-xl border overflow-hidden">
                        <button type="button" onClick={() => setOpenPanel(openPanel === 'font' ? null : 'font')}
                          className="w-full flex items-center justify-between p-4 text-right">
                          <div className="flex items-center gap-3">
                            <Type className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-semibold text-sm">الخط</p>
                              <p className="text-[11px] text-muted-foreground" dir="ltr">{FONT_PRESETS.find(f => f.id === (val("font_family") || "cairo"))?.name} — معاينة حية</p>
                            </div>
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'font' && "rotate-180")} />
                        </button>
                        {openPanel === 'font' && (
                          <div className="px-4 pb-4 border-t pt-3 grid grid-cols-2 gap-2">
                            {FONT_PRESETS.map(f => {
                              const active = (val("font_family") || "cairo") === f.id;
                              return (
                                <button key={f.id} type="button" onClick={() => set("font_family", f.id)}
                                  className={cn("text-right p-2.5 rounded-lg border-2 transition-all",
                                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                                  <p className="text-base font-semibold leading-tight" style={f.style}>{FONT_SAMPLE}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">{f.name}</p>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* الألوان */}
                      <div className="bg-card rounded-xl border overflow-hidden">
                        <button type="button" onClick={() => setOpenPanel(openPanel === 'colors' ? null : 'colors')}
                          className="w-full flex items-center justify-between p-4 text-right">
                          <div className="flex items-center gap-3">
                            <Palette className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-semibold text-sm">الألوان</p>
                              <p className="text-[11px] text-muted-foreground">لوحات جاهزة أو ألوان مخصصة</p>
                            </div>
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'colors' && "rotate-180")} />
                        </button>
                        {openPanel === 'colors' && (
                          <div className="px-4 pb-4 border-t pt-3 space-y-3">
                            <div>
                              <Label className="text-xs">لوحات جاهزة</Label>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                {COLOR_PRESETS.map(cp => (
                                  <button key={cp.name} type="button" title={cp.name}
                                    onClick={() => { set("primary_color", cp.primary); set("secondary_color", cp.secondary); }}
                                    className={cn("flex rounded-full overflow-hidden border-2 transition-all hover:scale-110",
                                      pvPrimary === cp.primary ? "border-primary ring-2 ring-primary/30" : "border-border")}>
                                    <span className="w-4 h-8" style={{ background: cp.primary }} />
                                    <span className="w-4 h-8" style={{ background: cp.secondary }} />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">ألوان أساسية</Label>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {PRO_BASIC_COLORS.map(c => (
                                  <button key={c.hex} type="button" title={c.name}
                                    onClick={() => set("primary_color", c.hex)}
                                    className={cn("w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                                      pvPrimary === c.hex ? "border-primary ring-2 ring-primary/40" : "border-border")}
                                    style={{ background: c.hex }} />
                                ))}
                              </div>
                            </div>
                            {([
                              { field: 'primary_color', label: 'اللون الأساسي', fb: '#2563eb' },
                              { field: 'secondary_color', label: 'اللون الثانوي (التدرّج)', fb: '#f59e0b' },
                            ] as const).map(cf => (
                              <div key={cf.field}>
                                <Label className="text-xs">{cf.label}</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <input type="color" value={val(cf.field) || cf.fb} onChange={e => set(cf.field, e.target.value)}
                                    className="w-10 h-9 rounded cursor-pointer border" />
                                  <Input value={val(cf.field) || cf.fb} onChange={e => set(cf.field, e.target.value)} className="font-mono h-9" dir="ltr" />
                                </div>
                              </div>
                            ))}
                            <div>
                              <Label className="text-xs">لون الأزرار</Label>
                              <div className="flex items-center gap-2 mt-1">
                                <input type="color" value={extras.button_color || pvPrimary} onChange={e => updExtras({ button_color: e.target.value })}
                                  className="w-10 h-9 rounded cursor-pointer border" />
                                <Input value={extras.button_color || ''} placeholder="تلقائي (نفس الأساسي)" onChange={e => updExtras({ button_color: e.target.value || undefined })}
                                  className="font-mono h-9" dir="ltr" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* قالب التصميم */}
                      <div className="bg-card rounded-xl border overflow-hidden">
                        <button type="button" onClick={() => setOpenPanel(openPanel === 'template' ? null : 'template')}
                          className="w-full flex items-center justify-between p-4 text-right">
                          <div className="flex items-center gap-3">
                            <Layout className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-semibold text-sm">قالب التصميم</p>
                              <p className="text-[11px] text-muted-foreground">{THEMES.find(t => t.id === (val("theme_id") || "modern"))?.name}</p>
                            </div>
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'template' && "rotate-180")} />
                        </button>
                        {openPanel === 'template' && (
                          <div className="px-4 pb-4 border-t pt-3 grid grid-cols-2 gap-2">
                            {THEMES.map(t => {
                              const active = (val("theme_id") || "modern") === t.id;
                              return (
                                <button key={t.id} type="button" onClick={() => set("theme_id", t.id)}
                                  className={cn("text-right p-3 rounded-lg border-2 transition-all",
                                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                                  <p className="font-semibold text-sm">{t.emoji} {t.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* الأزرار */}
                      <div className="bg-card rounded-xl border overflow-hidden">
                        <button type="button" onClick={() => setOpenPanel(openPanel === 'buttons' ? null : 'buttons')}
                          className="w-full flex items-center justify-between p-4 text-right">
                          <div className="flex items-center gap-3">
                            <Check className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-semibold text-sm">الأزرار</p>
                              <p className="text-[11px] text-muted-foreground">الشكل والاستدارة</p>
                            </div>
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'buttons' && "rotate-180")} />
                        </button>
                        {openPanel === 'buttons' && (
                          <div className="px-4 pb-4 border-t pt-3 space-y-3">
                            <div className="flex gap-2">
                              {([
                                { name: 'حبة كاملة', r: 999 },
                                { name: 'مستديرة', r: 12 },
                                { name: 'حادة', r: 0 },
                              ] as const).map(bp => (
                                <button key={bp.name} type="button" onClick={() => updExtras({ button_radius: bp.r })}
                                  className={cn("flex-1 py-2 text-xs font-semibold border-2 transition-all text-white",
                                    pvRadius === bp.r ? "border-primary ring-2 ring-primary/30" : "border-transparent")}
                                  style={{ background: pvBtn, borderRadius: Math.min(bp.r, 24) }}>
                                  {bp.name}
                                </button>
                              ))}
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs">درجة الاستدارة</Label>
                                <span className="text-[11px] font-mono text-muted-foreground" dir="ltr">{pvRadius}px</span>
                              </div>
                              <input type="range" min={0} max={24} value={Math.min(pvRadius, 24)}
                                onChange={e => updExtras({ button_radius: Number(e.target.value) })}
                                className="w-full cursor-pointer" />
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="text-xs font-bold text-muted-foreground px-1 pt-2">أقسام الصفحة الرئيسية</p>
                      <p className="text-[11px] text-muted-foreground px-1 -mt-2">اسحب لإعادة الترتيب · بدّل لإخفاء القسم</p>

                      {/* ترتيب وإظهار الأقسام */}
                      <div className="bg-card rounded-xl border divide-y">
                        {homeSections.map((s, i) => (
                          <div key={s.key}
                            draggable
                            onDragStart={() => { dragIdx.current = i; }}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => { if (dragIdx.current !== null) reorderSections(dragIdx.current, i); dragIdx.current = null; }}
                            className={cn("flex items-center gap-2 p-3", s.visible === false && "opacity-50")}>
                            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{SECTION_META[s.key]?.name || s.key}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{SECTION_META[s.key]?.desc}</p>
                            </div>
                            <button type="button" onClick={() => reorderSections(i, i - 1)} disabled={i === 0}
                              className="p-1 rounded hover:bg-muted disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => reorderSections(i, i + 1)} disabled={i === homeSections.length - 1}
                              className="p-1 rounded hover:bg-muted disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <Switch checked={s.visible !== false} onCheckedChange={() => toggleHomeSection(s.key)} />
                          </div>
                        ))}
                      </div>

                      {/* تعديل البنر */}
                      <div className="bg-card rounded-xl border overflow-hidden">
                        <button type="button" onClick={() => setOpenPanel(openPanel === 'banner' ? null : 'banner')}
                          className="w-full flex items-center justify-between p-4 text-right">
                          <div className="flex items-center gap-3">
                            <Megaphone className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-semibold text-sm">تعديل البنر الرئيسي</p>
                              <p className="text-[11px] text-muted-foreground">العنوان والنص والزر وصورة الخلفية</p>
                            </div>
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'banner' && "rotate-180")} />
                        </button>
                        {openPanel === 'banner' && (
                          <div className="px-4 pb-4 border-t pt-3 space-y-3">
                            <div>
                              <Label className="text-xs">العنوان الرئيسي</Label>
                              <Input value={val("hero_title")} onChange={e => set("hero_title", e.target.value)} className="mt-1 h-9" placeholder={`أهلاً في ${pvName}`} />
                            </div>
                            <div>
                              <Label className="text-xs">النص الفرعي</Label>
                              <Input value={val("hero_subtitle")} onChange={e => set("hero_subtitle", e.target.value)} className="mt-1 h-9" placeholder="اكتشف أحدث الأجهزة بأفضل الأسعار" />
                            </div>
                            <div>
                              <Label className="text-xs">نص الزر</Label>
                              <Input value={extras.hero_button_text || ''} onChange={e => updExtras({ hero_button_text: e.target.value || undefined })} className="mt-1 h-9" placeholder="تسوق الآن" />
                            </div>
                            <div>
                              <Label className="text-xs">صورة الخلفية</Label>
                              <div className="flex items-center gap-2 mt-1.5">
                                <input ref={heroRef} type="file" accept="image/*" className="hidden"
                                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'hero', 'hero_image_url')} />
                                <Button variant="outline" size="sm" onClick={() => heroRef.current?.click()} disabled={uploading === 'hero_image_url'}>
                                  {uploading === 'hero_image_url' ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Upload className="w-4 h-4 me-1" />}
                                  رفع صورة
                                </Button>
                                {settings.hero_image_url && (
                                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => updateSettings({ hero_image_url: null } as any)}>
                                    <Trash2 className="w-4 h-4 me-1" /> إزالة
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="text-xs font-bold text-muted-foreground px-1 pt-2">محتوى الأقسام</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'wide', icon: Megaphone, name: 'البنرات العريضة' },
                          { key: 'feature', icon: Star, name: 'الصور المميزة' },
                          { key: 'divider', icon: Tag, name: 'الفاصل العالي' },
                          { key: 'motion', icon: Sparkles, name: 'حركة المنتجات' },
                          { key: 'perks', icon: Check, name: 'مميزات المتجر' },
                          { key: 'reviews', icon: Star, name: 'آراء العملاء' },
                          { key: 'support', icon: Megaphone, name: 'خدمة العملاء' },
                          { key: 'gallery', icon: ImageIcon, name: 'معرض الصور' },
                          { key: 'text', icon: FileText, name: 'كلامك الخاص' },
                          { key: 'fonts', icon: Type, name: 'لون الخط' },
                        ].map(it => (
                          <button key={it.key} type="button" onClick={() => setDesignSection(it.key)}
                            className="flex items-center gap-2 bg-card rounded-lg border p-2.5 text-xs font-semibold hover:border-primary/60 hover:shadow-sm transition-all">
                            <it.icon className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{it.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ===== المعاينة الحية ===== */}
                    <div className="bg-muted/40 rounded-xl border p-3 lg:sticky lg:top-4">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">{window.location.host}/store/{settings.slug}</p>
                        <Badge variant="outline" className="text-[10px]">معاينة حية</Badge>
                      </div>
                      <div className={cn("bg-white rounded-lg border shadow-sm overflow-hidden transition-all mx-auto", previewDevice === 'mobile' ? "max-w-[380px]" : "w-full")}
                        style={{ ...pvFont, color: extras.font_color || '#1f2937' }} dir="rtl">

                        {/* هيدر مصغر */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-white">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-7 h-7 flex items-center justify-center text-white text-xs font-black", (extras.icon_shape || 'circle') === 'circle' ? "rounded-full" : "rounded-md")}
                              style={{ background: pvPrimary }}>
                              {pvName.charAt(0)}
                            </span>
                            <span className="font-bold text-sm">{pvName}</span>
                          </div>
                          {previewDevice === 'desktop' && (
                            <div className="flex items-center gap-3 text-[11px] text-gray-500">
                              <span className="font-semibold" style={{ color: pvPrimary }}>الرئيسية</span>
                              <span>الجوالات</span>
                              <span>الإكسسوارات</span>
                              <span>العروض</span>
                            </div>
                          )}
                          <span className="relative">
                            🛒
                            <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-[9px] text-white flex items-center justify-center" style={{ background: pvBtn }}>٣</span>
                          </span>
                        </div>

                        {pvVisible.map(sk => {
                          if (sk === 'hero') return (
                            <div key={sk} className="px-6 py-8 text-center text-white"
                              style={{
                                background: settings.hero_image_url
                                  ? `linear-gradient(135deg, ${pvPrimary}d9, ${pvSecondary}d9), url(${settings.hero_image_url}) center/cover`
                                  : `linear-gradient(135deg, ${pvPrimary}, ${pvSecondary})`,
                              }}>
                              <p className="text-lg font-extrabold mb-1">{val("hero_title") || `أهلاً في ${pvName}`}</p>
                              <p className="text-[11px] opacity-90 mb-3">{val("hero_subtitle") || val("description") || 'اكتشف أحدث الأجهزة والإكسسوارات بأفضل الأسعار'}</p>
                              <span className="inline-block bg-white text-gray-900 text-[11px] font-bold px-4 py-1.5" style={{ borderRadius: pvRadius }}>
                                {extras.hero_button_text || 'تسوق الآن'}
                              </span>
                            </div>
                          );
                          if (sk === 'categories') return (
                            <div key={sk} className="px-4 py-4">
                              <p className="text-xs font-bold mb-2">تسوّق حسب الفئة</p>
                              <div className="grid grid-cols-4 gap-2">
                                {PV_CATS.map(c => (
                                  <div key={c.name} className="rounded-lg border text-center py-2">
                                    <p className="text-base">{c.icon}</p>
                                    <p className="text-[9px] font-semibold mt-0.5">{c.name}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                          if (sk === 'wide') return (
                            <div key={sk} className="h-16 flex items-center justify-center text-white text-xs font-extrabold"
                              style={{ background: (extras.wide_banners?.[0]?.image_url)
                                ? `linear-gradient(135deg, ${pvPrimary}66, ${pvSecondary}66), url(${extras.wide_banners[0].image_url}) center/cover`
                                : `linear-gradient(135deg, ${pvPrimary}, ${pvSecondary})` }}>
                              {extras.wide_banners?.[0]?.title || 'بنر عريض'}
                            </div>
                          );
                          if (sk === 'feature') return (
                            <div key={sk} className="px-4 py-3 grid grid-cols-2 gap-2">
                              {[0, 1].map(fi => (
                                <div key={fi} className="h-16 rounded-lg overflow-hidden"
                                  style={{ background: extras.feature_images?.[fi]?.image_url
                                    ? `url(${extras.feature_images[fi].image_url}) center/cover`
                                    : `linear-gradient(135deg, ${pvPrimary}22, ${pvSecondary}33)` }} />
                              ))}
                            </div>
                          );
                          if (sk === 'divider') return (
                            <div key={sk} className="h-10 flex items-center justify-center text-white text-[11px] font-extrabold"
                              style={{ background: `linear-gradient(90deg, ${pvPrimary}, ${pvSecondary})` }}>
                              {extras.divider?.text || 'عروض نهاية الأسبوع — خصومات تصل إلى ٤٠٪'}
                            </div>
                          );
                          if (sk === 'gallery') return (
                            <div key={sk} className="px-4 py-3 grid grid-cols-3 gap-1.5">
                              {[0, 1, 2].map(gi => (
                                <div key={gi} className="h-10 rounded-md"
                                  style={{ background: extras.gallery?.[gi]?.image_url
                                    ? `url(${extras.gallery[gi].image_url}) center/cover`
                                    : `${pvPrimary}1a` }} />
                              ))}
                            </div>
                          );
                          if (sk === 'text') return (extras.custom_heading || extras.custom_text) ? (
                            <div key={sk} className="px-4 py-3 text-center">
                              {extras.custom_heading && <p className="text-sm font-extrabold" style={{ color: pvPrimary }}>{extras.custom_heading}</p>}
                              {extras.custom_text && <p className="text-[10px] text-gray-500 mt-0.5">{extras.custom_text}</p>}
                            </div>
                          ) : null;
                          if (sk === 'products') return (
                            <div key={sk} className="px-4 py-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold">الأكثر مبيعاً</p>
                                <p className="text-[10px]" style={{ color: pvPrimary }}>عرض الكل ←</p>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {PV_PRODUCTS.map(pp => (
                                  <div key={pp.name} className="border rounded-lg overflow-hidden">
                                    <div className="h-12 relative" style={{ background: `${pvPrimary}14` }}>
                                      {pp.tag && <span className="absolute top-1 right-1 text-[7px] text-white px-1 py-0.5 rounded" style={{ background: pvSecondary }}>{pp.tag}</span>}
                                    </div>
                                    <div className="p-1.5">
                                      <p className="text-[9px] font-semibold truncate">{pp.name}</p>
                                      <p className="text-[9px] font-bold mt-0.5" style={{ color: pvPrimary }}>{pp.price} ر.س</p>
                                      <span className="block text-center text-[8px] text-white font-bold py-1 mt-1" style={{ background: pvBtn, borderRadius: Math.min(pvRadius, 10) }}>
                                        أضف للسلة
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                          if (sk === 'reviews') return (extras.testimonials?.filter(t => t.text).length ? (
                            <div key={sk} className="px-4 py-3">
                              <p className="text-xs font-bold mb-2 text-center">آراء عملائنا</p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {extras.testimonials.filter(t => t.text).slice(0, 3).map((t, ti) => (
                                  <div key={ti} className="border rounded-lg p-1.5">
                                    <p className="text-[8px]" dir="ltr" style={{ color: '#f59e0b' }}>{'★'.repeat(t.rating || 5)}</p>
                                    <p className="text-[8px] text-gray-600 line-clamp-2 mt-0.5">"{t.text}"</p>
                                    <p className="text-[8px] font-bold mt-0.5" style={{ color: pvPrimary }}>— {t.name || 'عميل'}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null);
                          if (sk === 'support') return (extras.customer_service?.enabled ? (
                            <div key={sk} className="px-4 py-3">
                              <div className="rounded-lg border text-center py-3 px-2" style={{ background: `${pvPrimary}08` }}>
                                <p className="text-sm">🎧</p>
                                <p className="text-[9px] font-bold">خدمة العملاء</p>
                                <div className="flex justify-center gap-1.5 mt-1.5">
                                  {extras.customer_service.whatsapp && <span className="text-[7px] text-white font-bold px-2 py-0.5 rounded" style={{ background: '#25D366' }}>💬 واتساب</span>}
                                  {extras.customer_service.phone && <span className="text-[7px] text-white font-bold px-2 py-0.5 rounded" style={{ background: pvBtn }}>📞 اتصال</span>}
                                </div>
                              </div>
                            </div>
                          ) : null);
                          if (sk === 'perks') return (
                            <div key={sk} className="px-4 py-3 grid grid-cols-4 gap-1.5 border-t" style={{ background: `${pvPrimary}08` }}>
                              {(extras.store_perks?.filter(pk => pk.title).length ? extras.store_perks.filter(pk => pk.title).slice(0, 4) : [
                                { icon: '🚚', title: 'توصيل سريع' },
                                { icon: '🛡️', title: 'ضمان موثوق' },
                                { icon: '💳', title: 'دفع آمن' },
                                { icon: '🎧', title: 'دعم متواصل' },
                              ]).map((pk, pi) => (
                                <div key={pi} className="text-center">
                                  <p className="text-sm">{pk.icon}</p>
                                  <p className="text-[8px] font-bold mt-0.5">{pk.title}</p>
                                </div>
                              ))}
                            </div>
                          );
                          return null;
                        })}

                        {/* فوتر مصغر */}
                        <div className="px-4 py-3 text-white" style={{ background: '#111827' }}>
                          <p className="text-[10px] font-bold mb-1">{pvName}</p>
                          <p className="text-[8px] opacity-70">وجهتك الأولى للجوالات والإكسسوارات الأصلية — أسعار منافسة وشحن سريع.</p>
                          <p className="text-[8px] opacity-50 mt-2 text-center">© ٢٠٢٦ {pvName} — جميع الحقوق محفوظة</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {designSection !== null && (
                <Button variant="outline" size="sm" onClick={() => setDesignSection(null)}>
                  <ArrowRight className="w-4 h-4 me-1" /> رجوع لأقسام التصميم
                </Button>
              )}

              {designSection === 'themes' && (<>
              {/* Themes */}
              <div className="bg-card rounded-xl border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layout className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">قالب التصميم</h3>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">
                    <Sparkles className="w-3 h-3 me-1" /> باقة ماكس
                  </Badge>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {THEMES.map((t, ti) => {
                    const active = (val("theme_id") || "modern") === t.id;
                    return (
                      <motion.button
                        key={t.id}
                        type="button"
                        onClick={() => set("theme_id", t.id)}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: ti * 0.07 }}
                        whileHover={{ y: -5 }}
                        className={cn(
                          "relative text-right rounded-2xl border-2 overflow-hidden transition-all",
                          active
                            ? "border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/25"
                            : "border-border hover:border-primary/40 hover:shadow-lg"
                        )}
                      >
                        {/* معاينة مصغرة للمتجر بروح القالب */}
                        <div className="p-4 pb-3" style={{ background: t.pv.bg }}>
                          {/* شريط علوي مصغر */}
                          <div className="flex items-center gap-1.5 mb-2" dir="ltr">
                            <span className="w-2 h-2 rounded-full" style={{ background: t.pv.dot }} />
                            <span className="h-1.5 flex-1 rounded-full opacity-60" style={{ background: t.pv.bar }} />
                            <span className="h-1.5 w-6 rounded-full" style={{ background: t.pv.bar }} />
                          </div>
                          {/* هيرو مصغر */}
                          <div
                            className="h-16 mb-2.5 flex flex-col items-center justify-center gap-1.5"
                            style={{ background: t.pv.hero, borderRadius: t.pv.radius }}
                          >
                            <span className="h-2 w-24 rounded-full" style={{ background: t.id === 'minimal' ? '#a1a1aa' : 'rgba(255,255,255,0.9)' }} />
                            <span className="h-1.5 w-16 rounded-full" style={{ background: t.id === 'minimal' ? '#d4d4d8' : 'rgba(255,255,255,0.55)' }} />
                          </div>
                          {/* منتجات مصغرة */}
                          <div className="grid grid-cols-3 gap-1.5">
                            {[0, 1, 2].map(k => (
                              <div
                                key={k}
                                className="p-1.5"
                                style={{ background: t.pv.tile, borderRadius: t.pv.tileRadius, border: `1px solid ${t.pv.border}` }}
                              >
                                <div className="h-6 mb-1 opacity-80" style={{ background: t.pv.bar, borderRadius: Math.max(t.pv.tileRadius - 2, 0) }} />
                                <div className="h-1 w-3/4 rounded-full mb-1" style={{ background: t.pv.bar }} />
                                <div className="h-1 w-1/3 rounded-full" style={{ background: t.pv.dot }} />
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* اسم القالب */}
                        <div className="flex items-center justify-between px-4 py-3 bg-card border-t">
                          <div>
                            <p className="font-bold flex items-center gap-1.5">{t.emoji} {t.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                          </div>
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0",
                            active ? "bg-primary text-primary-foreground scale-100" : "bg-muted scale-90"
                          )}>
                            {active && <Check className="w-4 h-4" />}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
              </>)}

              {designSection === 'colors' && (<>
              {/* Colors — عجلة ألوان كاملة */}
              <div className="bg-card rounded-xl border p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">الألوان</h3>
                </div>

                {/* اختر أي لون تعدله */}
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { field: 'primary_color', label: 'اللون الأساسي', fallback: '#0d9488' },
                    { field: 'secondary_color', label: 'اللون الثانوي', fallback: '#f59e0b' },
                  ] as const).map(t => (
                    <button key={t.field} type="button" onClick={() => setColorTarget(t.field)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all",
                        colorTarget === t.field ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"
                      )}>
                      <span className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ background: val(t.field) || t.fallback }} />
                      <span className="text-sm font-semibold">{t.label}</span>
                      {colorTarget === t.field && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* العجلة */}
                  <ColorWheel
                    value={val(colorTarget) || (colorTarget === 'primary_color' ? '#0d9488' : '#f59e0b')}
                    onChange={hex => set(colorTarget, hex)}
                  />

                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <Label>كود اللون</Label>
                      <Input value={val(colorTarget)} onChange={e => set(colorTarget, e.target.value)}
                        className="font-mono mt-1" dir="ltr" placeholder="#0d9488" />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">تدرجات جاهزة بضغطة</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {COLOR_PRESETS.map(p => (
                          <button key={p.name} type="button" title={p.name}
                            onClick={() => { set("primary_color", p.primary); set("secondary_color", p.secondary); }}
                            className="flex rounded-full overflow-hidden border-2 border-border hover:border-primary transition-all hover:scale-110">
                            <span className="w-5 h-9" style={{ background: p.primary }} />
                            <span className="w-5 h-9" style={{ background: p.secondary }} />
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* معاينة حية */}
                    <div className="rounded-xl overflow-hidden border">
                      <div className="h-14 flex items-center justify-center text-white font-bold drop-shadow"
                        style={{ background: `linear-gradient(135deg, ${val("primary_color") || '#0d9488'}, ${val("secondary_color") || '#f59e0b'})` }}>
                        هكذا بتظهر ألوان متجرك
                      </div>
                      <div className="p-3 flex gap-2 bg-muted/30">
                        <span className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold" style={{ background: val("primary_color") || '#0d9488' }}>زر أساسي</span>
                        <span className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold" style={{ background: val("secondary_color") || '#f59e0b' }}>زر ثانوي</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </>)}

              {designSection === 'fonts' && (<>
              {/* Fonts */}
              <div className="bg-card rounded-xl border p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <Type className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">الخط</h3>
                </div>

                {/* اختيار الخط — 10 خطوط عربية */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {FONT_PRESETS.map((f, fi) => {
                    const active = (val("font_family") || "cairo") === f.id;
                    return (
                      <motion.button
                        key={f.id}
                        type="button"
                        onClick={() => set("font_family", f.id)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: fi * 0.04 }}
                        whileHover={{ y: -3 }}
                        className={cn(
                          "relative text-right p-4 rounded-xl border-2 transition-all",
                          active ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-border hover:border-primary/50"
                        )}
                      >
                        {active && (
                          <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">{f.name}</p>
                          <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                        </div>
                        <p className="text-xl font-semibold" style={{ ...f.style, color: extras.font_color || undefined }}>{FONT_SAMPLE}</p>
                      </motion.button>
                    );
                  })}
                </div>

                {/* لون الخط */}
                <div className="pt-4 border-t space-y-4">
                  <div>
                    <Label className="font-semibold">لون الخط</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">اختر لون نصوص متجرك — من الألوان الجاهزة أو من العجلة</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button"
                      onClick={() => updExtras({ font_color: undefined })}
                      className={cn(
                        "px-3 h-9 rounded-full border-2 text-xs font-semibold transition-all",
                        !extras.font_color ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      )}>
                      تلقائي
                    </button>
                    {FONT_COLORS.map(c => (
                      <button key={c.hex} type="button" title={c.name}
                        onClick={() => updExtras({ font_color: c.hex })}
                        className={cn(
                          "w-9 h-9 rounded-full border-2 transition-all hover:scale-110",
                          extras.font_color === c.hex ? "border-primary ring-2 ring-primary/30" : "border-border"
                        )}
                        style={{ background: c.hex }} />
                    ))}
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <ColorWheel
                      size={180}
                      value={extras.font_color || '#111827'}
                      onChange={hex => updExtras({ font_color: hex })}
                    />
                    {/* معاينة حية */}
                    <div className="flex-1 w-full rounded-xl border p-5 bg-muted/20">
                      <p className="text-xs text-muted-foreground mb-2">معاينة</p>
                      <p className="text-2xl font-bold mb-1"
                        style={{ ...(FONT_PRESETS.find(f => f.id === (val("font_family") || "cairo"))?.style || {}), color: extras.font_color || undefined }}>
                        {val("store_name") || "متجرك"}
                      </p>
                      <p className="text-sm leading-relaxed"
                        style={{ ...(FONT_PRESETS.find(f => f.id === (val("font_family") || "cairo"))?.style || {}), color: extras.font_color || undefined }}>
                        تسوّق أحدث الأجهزة والإكسسوارات بأفضل الأسعار — توصيل سريع لجميع المدن
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              </>)}

              {designSection === 'gallery' && (<>
              {/* معرض صور المتجر */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">معرض صور المتجر</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => galleryRef.current?.click()} disabled={uploading === 'gallery'}>
                    {uploading === 'gallery' ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Plus className="w-4 h-4 me-1" />}
                    إضافة صورة
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">حط الصور اللي تبغاها تظهر في واجهة متجرك، مع تعليق اختياري تحت كل صورة</p>
                <input ref={galleryRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleGalleryUpload(e.target.files[0]); e.target.value = ''; }} />
                {(extras.gallery || []).length === 0 ? (
                  <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
                    ما فيه صور بعد — اضغط "إضافة صورة" وارفع أي صورة تبغاها تظهر في متجرك
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {extras.gallery.map((g, i) => (
                      <div key={i} className="rounded-xl border overflow-hidden bg-muted/20">
                        <img src={g.image_url} alt="" className="w-full h-28 object-cover" />
                        <div className="p-2 space-y-1.5">
                          <Input
                            value={g.caption || ''}
                            placeholder="تعليق (اختياري)"
                            className="h-8 text-xs"
                            onChange={e => {
                              const gallery = [...extras.gallery];
                              gallery[i] = { ...gallery[i], caption: e.target.value };
                              updExtras({ gallery });
                            }}
                          />
                          <Button variant="ghost" size="sm" className="w-full h-7 text-destructive"
                            onClick={() => updExtras({ gallery: extras.gallery.filter((_, j) => j !== i) })}>
                            <Trash2 className="w-3.5 h-3.5 me-1" /> حذف
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>)}

              {designSection === 'text' && (<>
              {/* نصوص المتجر الخاصة */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">كلامك الخاص في الواجهة</h3>
                </div>
                <p className="text-xs text-muted-foreground">اكتب أي عنوان أو رسالة تبغاها تظهر لعملائك في الصفحة الرئيسية</p>
                <div>
                  <Label>العنوان</Label>
                  <Input value={extras.custom_heading || ''} onChange={e => updExtras({ custom_heading: e.target.value })}
                    className="mt-1" placeholder="مثال: عروض حصرية هذا الأسبوع" />
                </div>
                <div>
                  <Label>النص</Label>
                  <Textarea value={extras.custom_text || ''} onChange={e => updExtras({ custom_text: e.target.value })}
                    className="mt-1" rows={3} placeholder="اكتب الكلام اللي تبغاه يظهر تحت العنوان..." />
                </div>
              </div>
              </>)}

              {designSection === 'wide' && (<>
              {/* ١ — البنر العريض */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">١ — البنر العريض</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => wideRef.current?.click()} disabled={uploading === 'wide'}>
                    {uploading === 'wide' ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Plus className="w-4 h-4 me-1" />}
                    إضافة بنر
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">بنر عريض وعالي يظهر أعلى المتجر — تقدر تضيف أكثر من واحد بزر +</p>
                <input ref={wideRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleSectionUpload(e.target.files[0], 'wide'); e.target.value = ''; }} />
                {(extras.wide_banners || []).length === 0 ? (
                  <button type="button" onClick={() => wideRef.current?.click()} disabled={uploading === 'wide'}
                    className="w-full border-2 border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-all flex flex-col items-center gap-2">
                    <span className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      {uploading === 'wide' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                    </span>
                    اضغط هنا وارفع أول بنر عريض
                  </button>
                ) : (
                  <div className="space-y-3">
                    {(extras.wide_banners || []).map((b, i) => (
                      <div key={i} className="rounded-xl border overflow-hidden bg-muted/20">
                        <div className="h-28 w-full" style={{
                          background: b.image_url
                            ? `url(${b.image_url}) center/cover`
                            : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.5))',
                        }} />
                        <div className="p-3 grid sm:grid-cols-2 gap-2">
                          <Input value={b.title || ''} placeholder="عنوان البنر (اختياري)" className="h-9"
                            onChange={e => {
                              const wide_banners = [...(extras.wide_banners || [])];
                              wide_banners[i] = { ...wide_banners[i], title: e.target.value };
                              updExtras({ wide_banners });
                            }} />
                          <Input value={b.subtitle || ''} placeholder="نص تحت العنوان (اختياري)" className="h-9"
                            onChange={e => {
                              const wide_banners = [...(extras.wide_banners || [])];
                              wide_banners[i] = { ...wide_banners[i], subtitle: e.target.value };
                              updExtras({ wide_banners });
                            }} />
                          <Button variant="ghost" size="sm" className="text-destructive sm:col-span-2 h-8"
                            onClick={() => updExtras({ wide_banners: (extras.wide_banners || []).filter((_, j) => j !== i) })}>
                            <Trash2 className="w-3.5 h-3.5 me-1" /> حذف البنر
                          </Button>
                        </div>
                      </div>
                    ))}
                    {/* زر + لإضافة بنر آخر */}
                    <button type="button" onClick={() => wideRef.current?.click()} disabled={uploading === 'wide'}
                      className="w-full border-2 border-dashed rounded-xl p-5 text-center text-sm text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        {uploading === 'wide' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      </span>
                      إضافة بنر آخر
                    </button>
                  </div>
                )}
              </div>
              </>)}

              {designSection === 'feature' && (<>
              {/* ٢ — الصور المميزة */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">٢ — الصور المميزة</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => featureRef.current?.click()} disabled={uploading === 'feature'}>
                    {uploading === 'feature' ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Plus className="w-4 h-4 me-1" />}
                    إضافة صورة
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">صور كبيرة وعالية تبرز منتجاتك أو عروضك — زد العدد اللي تبغاه بزر +</p>
                <input ref={featureRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleSectionUpload(e.target.files[0], 'feature'); e.target.value = ''; }} />
                {(extras.feature_images || []).length === 0 ? (
                  <button type="button" onClick={() => featureRef.current?.click()} disabled={uploading === 'feature'}
                    className="w-full border-2 border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-all flex flex-col items-center gap-2">
                    <span className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      {uploading === 'feature' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                    </span>
                    اضغط هنا وارفع أول صورة مميزة
                  </button>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(extras.feature_images || []).map((f, i) => (
                      <div key={i} className="rounded-xl border overflow-hidden bg-muted/20">
                        <img src={f.image_url} alt="" className="w-full h-32 object-cover" />
                        <div className="p-2 space-y-1.5">
                          <Input value={f.caption || ''} placeholder="عنوان على الصورة (اختياري)" className="h-8 text-xs"
                            onChange={e => {
                              const feature_images = [...(extras.feature_images || [])];
                              feature_images[i] = { ...feature_images[i], caption: e.target.value };
                              updExtras({ feature_images });
                            }} />
                          <Button variant="ghost" size="sm" className="w-full h-7 text-destructive"
                            onClick={() => updExtras({ feature_images: (extras.feature_images || []).filter((_, j) => j !== i) })}>
                            <Trash2 className="w-3.5 h-3.5 me-1" /> حذف
                          </Button>
                        </div>
                      </div>
                    ))}
                    {/* زر + لإضافة صورة أخرى */}
                    <button type="button" onClick={() => featureRef.current?.click()} disabled={uploading === 'feature'}
                      className="border-2 border-dashed rounded-xl min-h-[176px] text-sm text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-all flex flex-col items-center justify-center gap-2">
                      <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        {uploading === 'feature' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      </span>
                      إضافة صورة
                    </button>
                  </div>
                )}
              </div>
              </>)}

              {designSection === 'divider' && (<>
              {/* ٣ — الفاصل العالي */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">٣ — الفاصل العالي</h3>
                  </div>
                  <Switch
                    checked={!!extras.divider?.enabled}
                    onCheckedChange={v => updExtras({ divider: { ...extras.divider, enabled: v } })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">شريط ملون عالي بألوان متجرك يفصل بين الأقسام، مع كلمة أو جملة بالنص</p>
                {extras.divider?.enabled && (
                  <>
                    <Input value={extras.divider?.text || ''} placeholder="النص داخل الفاصل (اختياري) — مثال: عروض لا تفوتك 🔥"
                      onChange={e => updExtras({ divider: { ...extras.divider, text: e.target.value } })} />
                    <div className="h-16 rounded-xl flex items-center justify-center text-white font-extrabold text-lg"
                      style={{ background: `linear-gradient(90deg, ${val("primary_color") || '#0d9488'}, ${val("secondary_color") || '#f59e0b'})` }}>
                      {extras.divider?.text || 'معاينة الفاصل'}
                    </div>
                  </>
                )}
              </div>
              </>)}

              {designSection === 'motion' && (<>
              {/* ٤ — المنتجات المتحركة */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">٤ — المنتجات المتحركة</h3>
                </div>
                <p className="text-xs text-muted-foreground">خلّ منتجاتك تتحرك في الصفحة الرئيسية وتلفت نظر العملاء</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {([
                    { id: 'none', name: 'بدون حركة', desc: 'عرض ثابت وهادئ', emoji: '⏸️' },
                    { id: 'float', name: 'حركة عائمة', desc: 'المنتجات تطفو بلطف فوق وتحت', emoji: '🎈' },
                    { id: 'marquee', name: 'شريط متحرك', desc: 'المنتجات تمشي تلقائياً بشكل مستمر', emoji: '🎬' },
                  ] as const).map(m => {
                    const active = (extras.product_motion || 'none') === m.id;
                    return (
                      <button key={m.id} type="button"
                        onClick={() => updExtras({ product_motion: m.id })}
                        className={cn(
                          "relative text-right p-4 rounded-xl border-2 transition-all hover:shadow-md",
                          active ? "border-primary bg-primary/5" : "border-border bg-background"
                        )}>
                        {active && <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check className="w-3 h-3" /></div>}
                        <div className="text-2xl mb-2">{m.emoji}</div>
                        <p className="font-semibold">{m.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              </>)}

              {designSection === 'perks' && (<>
              {/* ٥ — مميزات المتجر */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">٥ — مميزات المتجر</h3>
                  </div>
                  <div className="flex gap-2">
                    {(extras.store_perks || []).length === 0 && (
                      <Button variant="outline" size="sm"
                        onClick={() => updExtras({ store_perks: READY_PERKS })}>
                        <Sparkles className="w-4 h-4 me-1" /> المميزات الجاهزة
                      </Button>
                    )}
                    <Button variant="outline" size="sm"
                      onClick={() => updExtras({ store_perks: [...(extras.store_perks || []), { icon: '⭐', title: '' }] })}>
                      <Plus className="w-4 h-4 me-1" /> إضافة ميزة
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">مميزات تظهر أسفل المتجر تكسب ثقة العميل (توصيل سريع، ضمان، دفع آمن...) — الرمز مجرد إيموجي تقدر تغيره</p>
                {(extras.store_perks || []).length === 0 ? (
                  <div className="border border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">
                    اضغط "المميزات الجاهزة" لإضافة 4 مميزات بضغطة وحدة، أو أضف مميزاتك بنفسك
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(extras.store_perks || []).map((perk, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input value={perk.icon} className="w-16 text-center text-lg h-9"
                          onChange={e => {
                            const store_perks = [...(extras.store_perks || [])];
                            store_perks[i] = { ...store_perks[i], icon: e.target.value };
                            updExtras({ store_perks });
                          }} />
                        <Input value={perk.title} placeholder="عنوان الميزة" className="h-9 flex-1"
                          onChange={e => {
                            const store_perks = [...(extras.store_perks || [])];
                            store_perks[i] = { ...store_perks[i], title: e.target.value };
                            updExtras({ store_perks });
                          }} />
                        <Input value={perk.desc || ''} placeholder="وصف قصير (اختياري)" className="h-9 flex-1 hidden sm:block"
                          onChange={e => {
                            const store_perks = [...(extras.store_perks || [])];
                            store_perks[i] = { ...store_perks[i], desc: e.target.value };
                            updExtras({ store_perks });
                          }} />
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0"
                          onClick={() => updExtras({ store_perks: (extras.store_perks || []).filter((_, j) => j !== i) })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>)}

              {designSection === 'reviews' && (<>
              {/* آراء العملاء — يتحكم فيها التاجر */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">آراء العملاء</h3>
                  </div>
                  <Button variant="outline" size="sm"
                    onClick={() => updExtras({ testimonials: [...(extras.testimonials || []), { name: '', text: '', rating: 5 }] })}>
                    <Plus className="w-4 h-4 me-1" /> إضافة رأي
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">اكتب آراء عملائك بنفسك وتحكم فيها بالكامل — الاسم، التقييم بالنجوم، ونص الرأي. تظهر في الصفحة الرئيسية لمتجرك</p>
                {(extras.testimonials || []).length === 0 ? (
                  <button type="button"
                    onClick={() => updExtras({ testimonials: [{ name: '', text: '', rating: 5 }] })}
                    className="w-full border-2 border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-all flex flex-col items-center gap-2">
                    <span className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Plus className="w-6 h-6" />
                    </span>
                    اضغط هنا وأضف أول رأي عميل
                  </button>
                ) : (
                  <div className="space-y-3">
                    {(extras.testimonials || []).map((t, i) => (
                      <div key={i} className="rounded-xl border p-4 space-y-2.5 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Input value={t.name} placeholder="اسم العميل" className="h-9 flex-1"
                            onChange={e => {
                              const testimonials = [...(extras.testimonials || [])];
                              testimonials[i] = { ...testimonials[i], name: e.target.value };
                              updExtras({ testimonials });
                            }} />
                          <div className="flex gap-0.5" dir="ltr">
                            {[1, 2, 3, 4, 5].map(s => (
                              <button key={s} type="button" className="text-xl leading-none"
                                style={{ color: s <= (t.rating || 5) ? '#f59e0b' : 'hsl(var(--muted-foreground) / 0.3)' }}
                                onClick={() => {
                                  const testimonials = [...(extras.testimonials || [])];
                                  testimonials[i] = { ...testimonials[i], rating: s };
                                  updExtras({ testimonials });
                                }}>★</button>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0"
                            onClick={() => updExtras({ testimonials: (extras.testimonials || []).filter((_, j) => j !== i) })}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <Textarea value={t.text} placeholder="اكتب رأي العميل هنا... مثال: تعامل راقي وتوصيل سريع، أنصح فيهم" rows={2}
                          onChange={e => {
                            const testimonials = [...(extras.testimonials || [])];
                            testimonials[i] = { ...testimonials[i], text: e.target.value };
                            updExtras({ testimonials });
                          }} />
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => updExtras({ testimonials: [...(extras.testimonials || []), { name: '', text: '', rating: 5 }] })}
                      className="w-full border-2 border-dashed rounded-xl p-4 text-center text-sm text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> إضافة رأي آخر
                    </button>
                  </div>
                )}
              </div>
              </>)}

              {designSection === 'support' && (<>
              {/* خدمة العملاء */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">خدمة العملاء</h3>
                  </div>
                  <Switch
                    checked={!!extras.customer_service?.enabled}
                    onCheckedChange={v => updExtras({ customer_service: { ...extras.customer_service, enabled: v } })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">قسم في أسفل متجرك يعرض طرق التواصل — زر واتساب مباشر، رقم اتصال، وساعات العمل</p>
                {extras.customer_service?.enabled && (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">رقم الواتساب</Label>
                        <Input value={extras.customer_service?.whatsapp || ''} dir="ltr" placeholder="9665xxxxxxxx"
                          onChange={e => updExtras({ customer_service: { ...extras.customer_service, whatsapp: e.target.value } })}
                          className="mt-1 h-9 font-mono" />
                      </div>
                      <div>
                        <Label className="text-xs">رقم الاتصال</Label>
                        <Input value={extras.customer_service?.phone || ''} dir="ltr" placeholder="05xxxxxxxx"
                          onChange={e => updExtras({ customer_service: { ...extras.customer_service, phone: e.target.value } })}
                          className="mt-1 h-9 font-mono" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">ساعات العمل</Label>
                      <Input value={extras.customer_service?.hours || ''} placeholder="مثال: يومياً من ٩ صباحاً حتى ١١ مساءً"
                        onChange={e => updExtras({ customer_service: { ...extras.customer_service, hours: e.target.value } })}
                        className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">رسالة ترحيبية (اختياري)</Label>
                      <Input value={extras.customer_service?.note || ''} placeholder="فريقنا جاهز يخدمك ويجاوب على استفساراتك في أي وقت"
                        onChange={e => updExtras({ customer_service: { ...extras.customer_service, note: e.target.value } })}
                        className="mt-1 h-9" />
                    </div>
                    {/* معاينة */}
                    <div className="rounded-xl border p-5 text-center bg-muted/20">
                      <p className="text-2xl mb-1">🎧</p>
                      <p className="font-bold text-sm mb-1">خدمة العملاء</p>
                      <p className="text-xs text-muted-foreground mb-3">{extras.customer_service?.note || 'فريقنا جاهز يخدمك ويجاوب على استفساراتك في أي وقت'}</p>
                      <div className="flex justify-center gap-2">
                        {extras.customer_service?.whatsapp && (
                          <span className="text-[11px] text-white font-bold px-3 py-1.5 rounded-lg" style={{ background: '#25D366' }}>💬 واتساب</span>
                        )}
                        {extras.customer_service?.phone && (
                          <span className="text-[11px] text-white font-bold px-3 py-1.5 rounded-lg bg-primary">📞 {extras.customer_service.phone}</span>
                        )}
                      </div>
                      {extras.customer_service?.hours && <p className="text-[11px] text-muted-foreground mt-3">🕐 {extras.customer_service.hours}</p>}
                    </div>
                  </div>
                )}
              </div>
              </>)}

              {/* حفظ التصميم الحر */}
              {extrasDirty && (
                <div className="sticky bottom-4 z-30 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 backdrop-blur p-3 shadow-lg">
                  <p className="text-sm font-medium">عندك تعديلات تصميم غير محفوظة</p>
                  <Button size="sm" onClick={saveExtras} disabled={savingExtras}>
                    {savingExtras ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}
                    حفظ التصميم
                  </Button>
                </div>
              )}
            </>
          ) : isPro ? (
            /* ===== باقة برو: محرر متجر مبسط بمعاينة حية ===== */
            <div className="space-y-4">
              {/* شريط المحرر */}
              <div className="bg-card rounded-xl border p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black">م</div>
                  <div>
                    <p className="font-bold text-sm flex items-center gap-2">تصميم متجرك
                      <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px]" variant="outline">باقة برو</Badge>
                    </p>
                    <p className="text-[11px] text-muted-foreground">{pvName} · {(dirty || extrasDirty) ? 'مسودة غير محفوظة' : 'كل التغييرات محفوظة'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex rounded-lg border overflow-hidden">
                    <button type="button" onClick={() => setPreviewDevice('desktop')}
                      className={cn("px-3 h-9 text-xs font-semibold flex items-center gap-1.5 transition-colors", previewDevice === 'desktop' ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                      <Monitor className="w-3.5 h-3.5" /> سطح المكتب
                    </button>
                    <button type="button" onClick={() => setPreviewDevice('mobile')}
                      className={cn("px-3 h-9 text-xs font-semibold flex items-center gap-1.5 transition-colors", previewDevice === 'mobile' ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                      <Smartphone className="w-3.5 h-3.5" /> جوال
                    </button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    setForm(prev => ({ ...prev, primary_color: '#2563eb', secondary_color: '#f59e0b' }));
                    updExtras({ icon_shape: 'circle', hero_effect: 'none', hero_button_text: undefined });
                    toast.info('تم استعادة الافتراضي — اضغط "نشر التغييرات" للحفظ');
                  }}>
                    <RotateCcw className="w-4 h-4 me-1" /> استعادة الافتراضي
                  </Button>
                  <Button size="sm" onClick={publishAll} disabled={saving || savingExtras}>
                    {saving || savingExtras ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Rocket className="w-4 h-4 me-1" />}
                    نشر التغييرات
                  </Button>
                </div>
              </div>

              <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
                {/* ===== لوحة التخصيص ===== */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground px-1">تخصيص متجرك</p>

                  {/* الشعار */}
                  <div className="bg-card rounded-xl border overflow-hidden">
                    <button type="button" onClick={() => setOpenPanel(openPanel === 'logo' ? null : 'logo')}
                      className="w-full flex items-center justify-between p-4 text-right">
                      <div className="flex items-center gap-3">
                        <ImageIcon className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-semibold text-sm">الشعار</p>
                          <p className="text-[11px] text-muted-foreground">شعار متجرك يظهر أعلى الصفحة</p>
                        </div>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'logo' && "rotate-180")} />
                    </button>
                    {openPanel === 'logo' && (
                      <div className="px-4 pb-4 border-t pt-3 space-y-3">
                        <input ref={logoRef} type="file" accept="image/*" className="hidden"
                          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo', 'logo_url')} />
                        <div
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleUpload(f, 'logo', 'logo_url'); }}
                          className="border-2 border-dashed rounded-xl p-5 text-center hover:border-primary/60 hover:bg-primary/5 transition-all">
                          {settings.logo_url ? (
                            <img src={settings.logo_url} alt="logo" className={cn("w-16 h-16 mx-auto object-contain border bg-muted/30 mb-2", (extras.icon_shape || 'circle') === 'circle' ? "rounded-full" : "rounded-lg")} />
                          ) : (
                            <span className={cn("w-14 h-14 mx-auto mb-2 flex items-center justify-center text-white text-xl font-black", (extras.icon_shape || 'circle') === 'circle' ? "rounded-full" : "rounded-lg")}
                              style={{ background: pvPrimary, display: 'flex' }}>
                              {pvName.charAt(0)}
                            </span>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {uploading === 'logo_url' ? 'جاري الرفع...' : 'اسحب صورة الشعار هنا أو'}
                            {' '}
                            <button type="button" className="text-primary font-semibold underline-offset-2 hover:underline"
                              onClick={() => logoRef.current?.click()} disabled={uploading === 'logo_url'}>
                              تصفّح الملفات
                            </button>
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs">شكل الشعار</Label>
                          <div className="flex gap-2 mt-1.5">
                            {([
                              { id: 'circle', name: 'دائري' },
                              { id: 'square', name: 'مربع' },
                            ] as const).map(sh => (
                              <button key={sh.id} type="button" onClick={() => updExtras({ icon_shape: sh.id })}
                                className={cn("flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all",
                                  (extras.icon_shape || 'circle') === sh.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                                <span className={cn("w-6 h-6 flex items-center justify-center text-white text-[10px] font-black", sh.id === 'circle' ? "rounded-full" : "rounded-md")}
                                  style={{ background: pvPrimary }}>
                                  {pvName.charAt(0)}
                                </span>
                                {sh.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* اسم المتجر والوصف */}
                  <div className="bg-card rounded-xl border overflow-hidden">
                    <button type="button" onClick={() => setOpenPanel(openPanel === 'name' ? null : 'name')}
                      className="w-full flex items-center justify-between p-4 text-right">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-semibold text-sm">اسم المتجر والوصف</p>
                          <p className="text-[11px] text-muted-foreground">اسم متجرك والجملة اللي تظهر تحته</p>
                        </div>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'name' && "rotate-180")} />
                    </button>
                    {openPanel === 'name' && (
                      <div className="px-4 pb-4 border-t pt-3 space-y-3">
                        <div>
                          <Label className="text-xs">اسم المتجر</Label>
                          <Input value={val("store_name")} onChange={e => set("store_name", e.target.value)} className="mt-1 h-9" />
                        </div>
                        <div>
                          <Label className="text-xs">العنوان الرئيسي</Label>
                          <Input value={val("hero_title")} onChange={e => set("hero_title", e.target.value)} className="mt-1 h-9" placeholder={`أهلاً في ${pvName}`} />
                        </div>
                        <div>
                          <Label className="text-xs">الوصف</Label>
                          <Textarea value={val("hero_subtitle")} onChange={e => set("hero_subtitle", e.target.value)} className="mt-1" rows={2} placeholder="اكتشف أحدث الأجهزة والإكسسوارات بأفضل الأسعار" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* الألوان */}
                  <div className="bg-card rounded-xl border overflow-hidden">
                    <button type="button" onClick={() => setOpenPanel(openPanel === 'colors' ? null : 'colors')}
                      className="w-full flex items-center justify-between p-4 text-right">
                      <div className="flex items-center gap-3">
                        <Palette className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-semibold text-sm">الألوان</p>
                          <p className="text-[11px] text-muted-foreground">تدرجات جاهزة وألوان أساسية</p>
                        </div>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'colors' && "rotate-180")} />
                    </button>
                    {openPanel === 'colors' && (
                      <div className="px-4 pb-4 border-t pt-3 space-y-3">
                        <div className="space-y-2">
                          {PRO_COLOR_PRESETS.map(cp => (
                            <button key={cp.name} type="button"
                              onClick={() => { set("primary_color", cp.primary); set("secondary_color", cp.secondary); }}
                              className={cn("w-full flex items-center justify-between rounded-lg border-2 px-3 py-2 transition-all",
                                pvPrimary === cp.primary ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                              <span className="flex items-center gap-2">
                                <span className="flex -space-x-1">
                                  <span className="w-5 h-5 rounded-full border-2 border-background" style={{ backgroundColor: cp.primary }} />
                                  <span className="w-5 h-5 rounded-full border-2 border-background" style={{ backgroundColor: cp.secondary }} />
                                </span>
                                <span className="text-xs font-semibold">{cp.name}</span>
                              </span>
                              {pvPrimary === cp.primary && <Check className="w-4 h-4 text-primary" />}
                            </button>
                          ))}
                        </div>
                        <div>
                          <Label className="text-xs">ألوان أساسية</Label>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {PRO_BASIC_COLORS.map(c => (
                              <button key={c.hex} type="button" title={c.name}
                                onClick={() => set("primary_color", c.hex)}
                                className={cn("w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                                  pvPrimary === c.hex ? "border-primary ring-2 ring-primary/40" : "border-border")}
                                style={{ background: c.hex }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* صورة البانر */}
                  <div className="bg-card rounded-xl border overflow-hidden">
                    <button type="button" onClick={() => setOpenPanel(openPanel === 'banner' ? null : 'banner')}
                      className="w-full flex items-center justify-between p-4 text-right">
                      <div className="flex items-center gap-3">
                        <Megaphone className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-semibold text-sm">صورة البانر</p>
                          <p className="text-[11px] text-muted-foreground">الصورة العلوية لواجهة متجرك</p>
                        </div>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openPanel === 'banner' && "rotate-180")} />
                    </button>
                    {openPanel === 'banner' && (
                      <div className="px-4 pb-4 border-t pt-3 space-y-3">
                        {settings.hero_image_url && (
                          <img src={settings.hero_image_url} alt="hero" className="w-full h-24 rounded-lg object-cover border" />
                        )}
                        <div className="flex items-center gap-2">
                          <input ref={heroRef} type="file" accept="image/*" className="hidden"
                            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'hero', 'hero_image_url')} />
                          <Button variant="outline" size="sm" onClick={() => heroRef.current?.click()} disabled={uploading === 'hero_image_url'}>
                            {uploading === 'hero_image_url' ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Upload className="w-4 h-4 me-1" />}
                            رفع صورة
                          </Button>
                          {settings.hero_image_url && (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => updateSettings({ hero_image_url: null } as any)}>
                              <Trash2 className="w-4 h-4 me-1" /> إزالة
                            </Button>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs">تأثير الصورة</Label>
                          <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                            {([
                              { id: 'none', name: 'بدون' },
                              { id: 'glow', name: 'إشراق' },
                              { id: 'dark', name: 'تعتيم' },
                              { id: 'dots', name: 'نقشة' },
                            ] as const).map(ef => (
                              <button key={ef.id} type="button" onClick={() => updExtras({ hero_effect: ef.id })}
                                className={cn("py-2 rounded-lg border-2 text-xs font-semibold transition-all",
                                  (extras.hero_effect || 'none') === ef.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                                {ef.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">نص زر البانر</Label>
                          <Input value={extras.hero_button_text || ''} onChange={e => updExtras({ hero_button_text: e.target.value || undefined })}
                            className="mt-1 h-9" placeholder="تسوق الآن" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ترقية لماكس */}
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-foreground mb-1">تبغى استوديو التصميم الكامل؟</p>
                      <p className="text-xs text-muted-foreground mb-2.5">
                        باقة ماكس تفتح لك: قوالب التصميم، عجلة الألوان الكاملة، ١٠ خطوط مع لون الخط، البنرات العريضة، الصور المميزة، الفاصل، المنتجات المتحركة، ومميزات المتجر.
                      </p>
                      <Button size="sm" asChild>
                        <a href="/subscription">الترقية إلى باقة ماكس</a>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ===== المعاينة الحية ===== */}
                <div className="bg-muted/40 rounded-xl border p-3 lg:sticky lg:top-4">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">{window.location.host}/store/{settings.slug}</p>
                    <Badge variant="outline" className="text-[10px]">معاينة حية</Badge>
                  </div>
                  <div className={cn("bg-white rounded-lg border shadow-sm overflow-hidden transition-all mx-auto text-gray-800", previewDevice === 'mobile' ? "max-w-[380px]" : "w-full")} dir="rtl">

                    {/* هيدر مصغر */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b bg-white">
                      <div className="flex items-center gap-2">
                        {settings.logo_url ? (
                          <img src={settings.logo_url} alt="logo" className={cn("w-7 h-7 object-cover border", (extras.icon_shape || 'circle') === 'circle' ? "rounded-full" : "rounded-md")} />
                        ) : (
                          <span className={cn("w-7 h-7 flex items-center justify-center text-white text-xs font-black", (extras.icon_shape || 'circle') === 'circle' ? "rounded-full" : "rounded-md")}
                            style={{ background: pvPrimary }}>
                            {pvName.charAt(0)}
                          </span>
                        )}
                        <span className="font-bold text-sm">{pvName}</span>
                      </div>
                      {previewDevice === 'desktop' && (
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          <span className="font-semibold" style={{ color: pvPrimary }}>الرئيسية</span>
                          <span>الجوالات</span>
                          <span>الإكسسوارات</span>
                          <span>العروض</span>
                        </div>
                      )}
                      <span className="relative">
                        🛒
                        <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-[9px] text-white flex items-center justify-center" style={{ background: pvPrimary }}>٣</span>
                      </span>
                    </div>

                    {/* البانر */}
                    <div className="relative px-6 py-8 text-center text-white overflow-hidden"
                      style={{
                        background: settings.hero_image_url
                          ? `linear-gradient(135deg, ${pvPrimary}${(extras.hero_effect || 'none') === 'glow' ? '8c' : 'd9'}, ${pvSecondary}${(extras.hero_effect || 'none') === 'glow' ? '8c' : 'd9'}), url(${settings.hero_image_url}) center/cover`
                          : `linear-gradient(135deg, ${pvPrimary}, ${pvSecondary})`,
                      }}>
                      {(extras.hero_effect || 'none') === 'dots' && (
                        <span className="absolute inset-0 opacity-40 pointer-events-none"
                          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1.5px, transparent 1.5px)', backgroundSize: '14px 14px' }} />
                      )}
                      {(extras.hero_effect || 'none') === 'dark' && <span className="absolute inset-0 bg-black/40 pointer-events-none" />}
                      {(extras.hero_effect || 'none') === 'glow' && (
                        <span className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.35), transparent 60%)' }} />
                      )}
                      <div className="relative z-10">
                        <p className="text-lg font-extrabold mb-1">{val("hero_title") || `أهلاً في ${pvName}`}</p>
                        <p className="text-[11px] opacity-90 mb-3">{val("hero_subtitle") || val("description") || 'اكتشف أحدث الأجهزة والإكسسوارات بأفضل الأسعار'}</p>
                        <span className="inline-block bg-white text-gray-900 text-[11px] font-bold px-4 py-1.5 rounded-lg">
                          {extras.hero_button_text || 'تسوق الآن'}
                        </span>
                      </div>
                    </div>

                    {/* الفئات */}
                    <div className="px-4 py-4">
                      <p className="text-xs font-bold mb-2">تسوّق حسب الفئة</p>
                      <div className="grid grid-cols-4 gap-2">
                        {PV_CATS.map(c => (
                          <div key={c.name} className="rounded-lg border text-center py-2">
                            <p className="text-base">{c.icon}</p>
                            <p className="text-[9px] font-semibold mt-0.5">{c.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* الأكثر مبيعاً */}
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold">الأكثر مبيعاً</p>
                        <p className="text-[10px]" style={{ color: pvPrimary }}>عرض الكل ←</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {PV_PRODUCTS.map(pp => (
                          <div key={pp.name} className="border rounded-lg overflow-hidden">
                            <div className="h-12 relative" style={{ background: `${pvPrimary}14` }}>
                              {pp.tag && <span className="absolute top-1 right-1 text-[7px] text-white px-1 py-0.5 rounded" style={{ background: pvSecondary }}>{pp.tag}</span>}
                            </div>
                            <div className="p-1.5">
                              <p className="text-[9px] font-semibold truncate">{pp.name}</p>
                              <p className="text-[9px] font-bold mt-0.5" style={{ color: pvPrimary }}>{pp.price} ر.س</p>
                              <span className="block text-center text-[8px] text-white font-bold py-1 mt-1 rounded-md" style={{ background: pvPrimary }}>
                                أضف للسلة
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* فوتر مصغر */}
                    <div className="px-4 py-3 text-white" style={{ background: '#111827' }}>
                      <p className="text-[10px] font-bold mb-1">{pvName}</p>
                      <p className="text-[8px] opacity-70">وجهتك الأولى للجوالات والإكسسوارات الأصلية — أسعار منافسة وشحن سريع لكل مدن المملكة.</p>
                      <p className="text-[8px] opacity-50 mt-2 text-center">© ٢٠٢٦ {pvName} — جميع الحقوق محفوظة</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border p-10 flex flex-col items-center text-center">
              <Sparkles className="w-10 h-10 text-primary mb-3" />
              <h3 className="font-bold text-lg mb-1">استوديو تصميم المتجر — حصري لباقة ماكس</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                قوالب تصميم جاهزة، تحكم كامل بالألوان، واختيار الخطوط — رقّ لباقة ماكس وصمّم متجرك بنفسك.
              </p>
              <Button asChild size="sm"><a href="/subscription">ترقية الباقة</a></Button>
            </div>
          )}
        </TabsContent>

        {/* BRANDING */}
        <TabsContent value="branding" className="space-y-6">
          {/* Logo + banner uploads */}
          <div className="bg-card rounded-xl border p-6 space-y-5">
            <h3 className="font-semibold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" /> الشعار والبانر</h3>

            <div>
              <Label>الشعار (Logo)</Label>
              <div className="flex items-center gap-4 mt-2">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="logo" className="w-20 h-20 rounded-lg object-contain border bg-muted/30" />
                ) : (
                  <div className="w-20 h-20 rounded-lg border border-dashed flex items-center justify-center bg-muted/30">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <input ref={logoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo', 'logo_url')} />
                  <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploading === 'logo_url'}>
                    {uploading === 'logo_url' ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Upload className="w-4 h-4 me-1" />}
                    رفع شعار
                  </Button>
                  {settings.logo_url && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => updateSettings({ logo_url: null } as any)}>
                      <Trash2 className="w-4 h-4 me-1" /> إزالة
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>صورة البانر العلوية</Label>
              <div className="mt-2 space-y-2">
                {settings.banner_url && (
                  <img src={settings.banner_url} alt="banner" className="w-full h-32 rounded-lg object-cover border" />
                )}
                <input ref={bannerRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'banner', 'banner_url')} />
                <Button variant="outline" size="sm" onClick={() => bannerRef.current?.click()} disabled={uploading === 'banner_url'}>
                  {uploading === 'banner_url' ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Upload className="w-4 h-4 me-1" />}
                  رفع بانر
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* HERO */}
        <TabsContent value="hero" className="space-y-6">
          {/* Announcement */}
          <div className="bg-card rounded-xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">شريط الإعلانات العلوي</h3>
              </div>
              <Switch
                checked={!!val("announcement_bar_enabled")}
                onCheckedChange={v => set("announcement_bar_enabled", v)}
              />
            </div>
            <Input
              value={val("announcement_bar_text")}
              onChange={e => set("announcement_bar_text", e.target.value)}
              placeholder="🎉 شحن مجاني للطلبات فوق 500 ر.س"
              disabled={!val("announcement_bar_enabled")}
            />
          </div>

          {/* Hero section */}
          <div className="bg-card rounded-xl border p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> القسم الرئيسي (Hero)
            </h3>
            <div>
              <Label>العنوان الرئيسي</Label>
              <Input value={val("hero_title")} onChange={e => set("hero_title", e.target.value)} className="mt-1" placeholder="أهلاً بك في متجرنا" />
            </div>
            <div>
              <Label>العنوان الفرعي</Label>
              <Textarea value={val("hero_subtitle")} onChange={e => set("hero_subtitle", e.target.value)} className="mt-1" rows={2} placeholder="اكتشف أحدث الأجهزة..." />
            </div>
            <div>
              <Label>صورة الخلفية</Label>
              <div className="mt-2 space-y-2">
                {settings.hero_image_url && (
                  <div className="relative rounded-lg overflow-hidden border">
                    <img src={settings.hero_image_url} alt="hero" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${settings.primary_color || '#0d9488'}d9, ${settings.secondary_color || '#f59e0b'}d9)` }}>
                      <p className="text-white font-bold text-2xl">{val("hero_title") || "معاينة"}</p>
                    </div>
                  </div>
                )}
                <input ref={heroRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'hero', 'hero_image_url')} />
                <Button variant="outline" size="sm" onClick={() => heroRef.current?.click()} disabled={uploading === 'hero_image_url'}>
                  {uploading === 'hero_image_url' ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Upload className="w-4 h-4 me-1" />}
                  رفع صورة Hero
                </Button>
              </div>
            </div>
          </div>

          {/* Featured */}
          <div className="bg-card rounded-xl border p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold">قسم المنتجات المميزة</h3>
              </div>
              <Switch
                checked={!!val("featured_section_enabled")}
                onCheckedChange={v => set("featured_section_enabled", v)}
              />
            </div>
            <p className="text-sm text-muted-foreground">عند التفعيل، يتم عرض المنتجات المميزة في أعلى الصفحة. يمكنك تحديد المنتجات من صفحة المنتجات لاحقاً.</p>
          </div>
        </TabsContent>

        {/* SEO */}
        {/* BANNERS */}
        <TabsContent value="banners">
          <div className="bg-card rounded-xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" /> بنرات إضافية
                </h3>
                <p className="text-sm text-muted-foreground mt-1">تعرض في الصفحة الرئيسية أسفل قسم الواجهة. مثالية للعروض والتشكيلات الموسمية.</p>
              </div>
              <Button size="sm" onClick={() => {
                const list = [...((val("additional_banners") as any[]) || [])];
                list.push({ image_url: "", title: "", subtitle: "", link: "" });
                set("additional_banners", list);
              }}>
                <Plus className="w-4 h-4 me-1" /> بنر جديد
              </Button>
            </div>

            {(((val("additional_banners") as any[]) || []).length === 0) && (
              <p className="text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">لا توجد بنرات بعد. أضف بنر للترويج لعروض جديدة.</p>
            )}

            <div className="space-y-3">
              {((val("additional_banners") as any[]) || []).map((b: any, i: number) => (
                <div key={i} className="rounded-xl border p-4 bg-muted/20 space-y-3">
                  <div className="flex items-start gap-4">
                    {b.image_url ? (
                      <div className="relative w-40 h-24 rounded-lg overflow-hidden border flex-shrink-0">
                        <img src={b.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-40 h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-background flex-shrink-0">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 grid sm:grid-cols-2 gap-2">
                      <Input value={b.title || ""} onChange={e => {
                        const list = [...((val("additional_banners") as any[]) || [])];
                        list[i] = { ...list[i], title: e.target.value };
                        set("additional_banners", list);
                      }} placeholder="العنوان" />
                      <Input value={b.subtitle || ""} onChange={e => {
                        const list = [...((val("additional_banners") as any[]) || [])];
                        list[i] = { ...list[i], subtitle: e.target.value };
                        set("additional_banners", list);
                      }} placeholder="العنوان الفرعي" />
                      <Input value={b.link || ""} onChange={e => {
                        const list = [...((val("additional_banners") as any[]) || [])];
                        list[i] = { ...list[i], link: e.target.value };
                        set("additional_banners", list);
                      }} placeholder="رابط الزر (اختياري)" dir="ltr" className="sm:col-span-2 font-mono text-sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t">
                    <div>
                      <input
                        type="file" accept="image/*" id={`banner-upload-${i}`} className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0]; if (!file || !merchant) return;
                          setUploading(`banner-${i}`);
                          const url = await uploadStoreAsset(merchant.id, file, 'banner');
                          if (url) {
                            const list = [...((val("additional_banners") as any[]) || [])];
                            list[i] = { ...list[i], image_url: url };
                            set("additional_banners", list);
                          }
                          setUploading(null);
                        }}
                      />
                      <Button variant="outline" size="sm" onClick={() => document.getElementById(`banner-upload-${i}`)?.click()} disabled={uploading === `banner-${i}`}>
                        {uploading === `banner-${i}` ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Upload className="w-4 h-4 me-1" />}
                        {b.image_url ? "تغيير الصورة" : "رفع صورة"}
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                      const list = [...((val("additional_banners") as any[]) || [])];
                      list.splice(i, 1);
                      set("additional_banners", list);
                    }}>
                      <Trash2 className="w-4 h-4 me-1" /> حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* LEGAL — CR / VAT visibility */}
        <TabsContent value="legal">
          <div className="space-y-6">
            <div className="bg-card rounded-xl border p-6 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> البيانات القانونية
              </h3>
              <p className="text-sm text-muted-foreground">
                البيانات تُحدّث من <span className="font-medium">الإعدادات → المتجر</span>. هنا تتحكم فقط بإظهارها داخل متجرك الإلكتروني.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 pt-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">السجل التجاري</p>
                  <p className="font-mono text-sm font-semibold mt-1" dir="ltr">{(merchant as any)?.cr_number || "—"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">الرقم الضريبي</p>
                  <p className="font-mono text-sm font-semibold mt-1" dir="ltr">{(merchant as any)?.vat_number || "—"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">حالة الضريبة</p>
                  <Badge variant={(merchant as any)?.vat_enabled ? "default" : "secondary"} className="mt-1">
                    {(merchant as any)?.vat_enabled ? "ضريبة 15% مفعّلة" : "بدون ضريبة"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-6 space-y-1">
              <h3 className="font-semibold mb-3">إظهار البيانات في المتجر</h3>
              <div className="flex items-center justify-between py-3 border-b last:border-0">
                <div>
                  <p className="font-medium">إظهار رقم السجل التجاري</p>
                  <p className="text-xs text-muted-foreground">يظهر في فوتر المتجر الإلكتروني</p>
                </div>
                <Switch checked={!!val("show_cr_number")} onCheckedChange={v => set("show_cr_number", v)} />
              </div>
              <div className="flex items-center justify-between py-3 border-b last:border-0">
                <div>
                  <p className="font-medium">إظهار الرقم الضريبي</p>
                  <p className="text-xs text-muted-foreground">يظهر في فوتر المتجر مع شارة الضريبة</p>
                </div>
                <Switch checked={!!val("show_vat_number")} onCheckedChange={v => set("show_vat_number", v)} />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">إظهار حالة الضريبة (مفعّلة / غير مفعّلة)</p>
                  <p className="text-xs text-muted-foreground">تساعد العميل في معرفة هل الأسعار شاملة الضريبة</p>
                </div>
                <Switch checked={!!val("show_vat_status")} onCheckedChange={v => set("show_vat_status", v)} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seo">
          <div className="bg-card rounded-xl border p-6 space-y-5">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground mb-2">معاينة في Google</p>
              <p className="text-blue-700 dark:text-blue-400 text-base hover:underline cursor-pointer truncate">
                {val("seo_title") || val("store_name") || "اسم المتجر"}
              </p>
              <p className="text-green-700 dark:text-green-500 text-xs truncate" dir="ltr">{storeUrl}</p>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {val("seo_description") || val("description") || "وصف المتجر..."}
              </p>
            </div>

            <div>
              <Label>عنوان SEO</Label>
              <Input value={val("seo_title")} onChange={e => set("seo_title", e.target.value)} className="mt-1" maxLength={60} />
              <p className="text-xs text-muted-foreground mt-1">{(val("seo_title") || "").length}/60 حرف</p>
            </div>
            <div>
              <Label>وصف SEO</Label>
              <Textarea value={val("seo_description")} onChange={e => set("seo_description", e.target.value)} className="mt-1" rows={3} maxLength={160} />
              <p className="text-xs text-muted-foreground mt-1">{(val("seo_description") || "").length}/160 حرف</p>
            </div>
            <div>
              <Label>الكلمات المفتاحية</Label>
              <Input value={val("seo_keywords")} onChange={e => set("seo_keywords", e.target.value)} className="mt-1" placeholder="جوالات، إكسسوارات، أيفون" />
            </div>
            <div>
              <Label>صورة المشاركة (Open Graph)</Label>
              <div className="mt-2 space-y-2">
                {settings.og_image_url && <img src={settings.og_image_url} alt="og" className="w-full max-w-sm h-40 rounded-lg object-cover border" />}
                <input ref={ogRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'og', 'og_image_url')} />
                <Button variant="outline" size="sm" onClick={() => ogRef.current?.click()} disabled={uploading === 'og_image_url'}>
                  {uploading === 'og_image_url' ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Upload className="w-4 h-4 me-1" />}
                  رفع صورة OG
                </Button>
                <p className="text-xs text-muted-foreground">تظهر عند مشاركة الرابط في وسائل التواصل (1200×630).</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* PAGES */}
        <TabsContent value="pages">
          <div className="bg-card rounded-xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">صفحات مخصصة (من نحن، الشروط، الأسئلة...)</h3>
              <Button size="sm" onClick={() => setEditingPage({ slug: "", title: "", content: "", is_published: true })}>
                <Plus className="w-4 h-4 me-1" /> صفحة جديدة
              </Button>
            </div>

            {editingPage && (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>عنوان الصفحة</Label>
                    <Input value={editingPage.title || ""} onChange={e => setEditingPage({ ...editingPage, title: e.target.value })} placeholder="من نحن" />
                  </div>
                  <div>
                    <Label>الرابط (Slug)</Label>
                    <Input value={editingPage.slug || ""} onChange={e => setEditingPage({ ...editingPage, slug: e.target.value })} className="font-mono" dir="ltr" placeholder="about" />
                  </div>
                </div>
                <div>
                  <Label>المحتوى</Label>
                  <Textarea value={editingPage.content || ""} onChange={e => setEditingPage({ ...editingPage, content: e.target.value })} rows={8} placeholder="اكتب محتوى الصفحة هنا..." />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!editingPage.is_published} onCheckedChange={v => setEditingPage({ ...editingPage, is_published: v })} />
                    <Label className="cursor-pointer">منشورة</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingPage(null)}>إلغاء</Button>
                    <Button size="sm" onClick={async () => {
                      if (!editingPage.title || !editingPage.slug) { toast.error("العنوان والرابط مطلوبان"); return; }
                      await upsertPage(editingPage as any);
                      setEditingPage(null);
                    }}>
                      <Save className="w-4 h-4 me-1" /> حفظ الصفحة
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {pages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">لا توجد صفحات. أنشئ صفحات مثل "من نحن"، "الشروط"، "الأسئلة الشائعة".</p>
            ) : (
              <div className="space-y-2">
                {pages.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{p.title}</p>
                        {!p.is_published && <Badge variant="outline" className="text-xs">مسودة</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate" dir="ltr">/{p.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingPage(p)}>تعديل</Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deletePage(p.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* CATEGORIES */}
        <TabsContent value="categories">
          <div className="bg-card rounded-xl border p-6 space-y-4">
            <div className="flex gap-2">
              <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="اسم التصنيف الجديد..." />
              <Button onClick={() => { if (newCat.trim()) { addCategory(newCat.trim()); setNewCat(""); } }} disabled={!newCat.trim()}>
                <Plus className="w-4 h-4 me-1" /> إضافة
              </Button>
            </div>
            {categories.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">لا توجد تصنيفات بعد</p>
            ) : (
              <div className="space-y-2">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeCategory(cat.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* SHIPPING */}
        <TabsContent value="shipping">
          <div className="bg-card rounded-xl border p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>تكلفة الشحن (ر.س)</Label>
                <Input type="number" value={val("shipping_cost")} onChange={e => set("shipping_cost", parseFloat(e.target.value) || 0)} className="mt-1" />
              </div>
              <div>
                <Label>الشحن مجاني فوق (ر.س)</Label>
                <Input type="number" value={val("free_shipping_threshold") || ""} onChange={e => set("free_shipping_threshold", parseFloat(e.target.value) || null)} className="mt-1" placeholder="مثال: 500" />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border">
              <p className="text-sm font-medium mb-2">شركات الشحن المدعومة</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">🚚 أرامكس</Badge>
                <Badge variant="outline">📦 SMSA Express</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">يمكنك إضافة رقم التتبع يدوياً لكل طلب من صفحة الطلبات.</p>
            </div>
          </div>
        </TabsContent>

        {/* LINKS */}
        <TabsContent value="links">
          <div className="bg-card rounded-xl border p-6 space-y-4">
            <div>
              <Label>رقم واتساب</Label>
              <Input value={val("whatsapp_number")} onChange={e => set("whatsapp_number", e.target.value)} placeholder="966XXXXXXXXX" className="mt-1" dir="ltr" />
            </div>
            <div>
              <Label>انستقرام</Label>
              <Input value={val("instagram_url")} onChange={e => set("instagram_url", e.target.value)} placeholder="https://instagram.com/..." className="mt-1" dir="ltr" />
            </div>
            <div>
              <Label>تويتر / X</Label>
              <Input value={val("twitter_url")} onChange={e => set("twitter_url", e.target.value)} placeholder="https://x.com/..." className="mt-1" dir="ltr" />
            </div>
          </div>
        </TabsContent>
      </UrlTabs>
    </AppLayout>
  );
}
