import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Store, Palette, Truck, Plus, Trash2, Save, ExternalLink, Eye, EyeOff,
  Loader2, Tag, Link2, Sparkles, Search, FileText, Image as ImageIcon,
  Upload, Megaphone, Type, Star, Layout, Check,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useStoreSettings, useStorePages, uploadStoreAsset, type StorePage } from "@/hooks/useOnlineStore";
import { toast } from "sonner";

const COLOR_PRESETS = [
  { name: "تيل ملكي", primary: "#0d9488", secondary: "#f59e0b" },
  { name: "أزرق احترافي", primary: "#2563eb", secondary: "#0ea5e9" },
  { name: "بنفسجي عصري", primary: "#7c3aed", secondary: "#ec4899" },
  { name: "أسود فاخر", primary: "#111827", secondary: "#d4af37" },
  { name: "أحمر جريء", primary: "#dc2626", secondary: "#f97316" },
  { name: "أخضر طبيعي", primary: "#16a34a", secondary: "#65a30d" },
];

const FONT_PRESETS = [
  { id: "cairo", name: "Cairo", sample: "أهلاً بكم في متجرنا", style: { fontFamily: '"Cairo", sans-serif' } },
  { id: "tajawal", name: "Tajawal", sample: "أهلاً بكم في متجرنا", style: { fontFamily: '"Tajawal", sans-serif' } },
  { id: "ibm_plex", name: "IBM Plex Arabic", sample: "أهلاً بكم في متجرنا", style: { fontFamily: '"IBM Plex Sans Arabic", sans-serif' } },
  { id: "noto", name: "Noto Kufi", sample: "أهلاً بكم في متجرنا", style: { fontFamily: '"Noto Kufi Arabic", sans-serif' } },
];

const THEMES = [
  { id: "modern", name: "عصري", desc: "تصميم نظيف بأقواس ناعمة وظلال خفيفة", emoji: "✨" },
  { id: "minimal", name: "بسيط", desc: "أبيض، تباعد واسع، خطوط دقيقة", emoji: "◯" },
  { id: "bold", name: "جريء", desc: "ألوان قوية، خطوط ثقيلة، تباين عالي", emoji: "⚡" },
  { id: "classic", name: "كلاسيكي", desc: "زوايا حادة، تصميم تقليدي راقي", emoji: "♛" },
];

export default function OnlineStorePage() {
  const { merchant } = useAuth();
  const { settings, categories, loading, initStore, updateSettings, addCategory, removeCategory } = useStoreSettings();
  const { pages, upsertPage, deletePage } = useStorePages();
  const [newCat, setNewCat] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<Partial<StorePage> | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const ogRef = useRef<HTMLInputElement>(null);

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

  const storeUrl = `${window.location.origin}/store/${settings.slug}`;
  const dirty = Object.keys(form).length > 0;

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

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="general"><Store className="w-4 h-4 me-1" /> عام</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="w-4 h-4 me-1" /> الهوية</TabsTrigger>
          <TabsTrigger value="hero"><Sparkles className="w-4 h-4 me-1" /> الواجهة</TabsTrigger>
          <TabsTrigger value="banners"><ImageIcon className="w-4 h-4 me-1" /> البنرات</TabsTrigger>
          <TabsTrigger value="legal"><FileText className="w-4 h-4 me-1" /> الصلاحيات والضريبة</TabsTrigger>
          <TabsTrigger value="seo"><Search className="w-4 h-4 me-1" /> SEO</TabsTrigger>
          <TabsTrigger value="pages"><FileText className="w-4 h-4 me-1" /> الصفحات</TabsTrigger>
          <TabsTrigger value="categories"><Tag className="w-4 h-4 me-1" /> التصنيفات</TabsTrigger>
          <TabsTrigger value="shipping"><Truck className="w-4 h-4 me-1" /> الشحن</TabsTrigger>
          <TabsTrigger value="links"><Link2 className="w-4 h-4 me-1" /> الروابط</TabsTrigger>
        </TabsList>

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

        {/* BRANDING */}
        <TabsContent value="branding" className="space-y-6">
          {/* Themes */}
          <div className="bg-card rounded-xl border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layout className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">قالب التصميم</h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {THEMES.map(t => {
                const active = (val("theme_id") || "modern") === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => set("theme_id", t.id)}
                    className={cn(
                      "relative text-right p-4 rounded-xl border-2 transition-all hover:shadow-md",
                      active ? "border-primary bg-primary/5" : "border-border bg-background"
                    )}
                  >
                    {active && <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check className="w-3 h-3" /></div>}
                    <div className="text-3xl mb-2">{t.emoji}</div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colors */}
          <div className="bg-card rounded-xl border p-6">
            <h3 className="font-semibold mb-4">الألوان</h3>
            <div className="mb-4">
              <Label className="text-sm text-muted-foreground mb-2 block">قوالب جاهزة</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {COLOR_PRESETS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => { set("primary_color", p.primary); set("secondary_color", p.secondary); }}
                    className="group rounded-lg border p-2 hover:border-primary hover:shadow-sm transition-all"
                  >
                    <div className="flex gap-1 mb-1.5">
                      <div className="flex-1 h-8 rounded" style={{ background: p.primary }} />
                      <div className="flex-1 h-8 rounded" style={{ background: p.secondary }} />
                    </div>
                    <p className="text-xs font-medium text-center">{p.name}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label>اللون الأساسي</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={val("primary_color") || "#0d9488"} onChange={e => set("primary_color", e.target.value)} className="w-12 h-10 rounded cursor-pointer border" />
                  <Input value={val("primary_color")} onChange={e => set("primary_color", e.target.value)} className="font-mono" dir="ltr" />
                </div>
              </div>
              <div>
                <Label>اللون الثانوي</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={val("secondary_color") || "#f59e0b"} onChange={e => set("secondary_color", e.target.value)} className="w-12 h-10 rounded cursor-pointer border" />
                  <Input value={val("secondary_color")} onChange={e => set("secondary_color", e.target.value)} className="font-mono" dir="ltr" />
                </div>
              </div>
            </div>
          </div>

          {/* Fonts */}
          <div className="bg-card rounded-xl border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">الخط</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {FONT_PRESETS.map(f => {
                const active = (val("font_family") || "cairo") === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => set("font_family", f.id)}
                    className={cn(
                      "text-right p-4 rounded-xl border-2 transition-all",
                      active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    )}
                  >
                    <p className="text-xs text-muted-foreground mb-1">{f.name}</p>
                    <p className="text-xl font-semibold" style={f.style}>{f.sample}</p>
                  </button>
                );
              })}
            </div>
          </div>

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
      </Tabs>
    </AppLayout>
  );
}
