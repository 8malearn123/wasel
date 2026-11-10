import { ReactNode, useState, FormEvent } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Search, Instagram, Twitter, Phone, Store as StoreIcon, ClipboardList, ShieldCheck, FileText, Heart, Home, LayoutGrid } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { StoreSettings, StorePage, MerchantLegalInfo, DesignExtras, StoreCategory } from '@/hooks/useOnlineStore';
import { useStoreCart } from './StoreCart';
import { useStoreFavorites } from './StoreFavorites';
import { cn } from '@/lib/utils';

interface Props {
  store: StoreSettings;
  pages?: StorePage[];
  merchantLegal?: MerchantLegalInfo | null;
  // نصوص الفوتر القابلة للتعديل من محرر المتجر
  designExtras?: DesignExtras | null;
  /** the shop's own active categories — the design's category row */
  categories?: StoreCategory[];
  children: ReactNode;
}

export function StoreLayout({ store, pages = [], merchantLegal, designExtras, categories = [], children }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const { count } = useStoreCart();
  const { count: favCount } = useStoreFavorites();
  const base = `/store/${slug}`;
  const currency = store.currency_symbol || 'ر.س';
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  // Claude Design: a search box in the header, into the products page's own search
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(`${base}/products${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  };
  const activeCategory = new URLSearchParams(location.search).get('category');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Announcement bar */}
      {store.announcement_bar_enabled && store.announcement_bar_text && (
        <div
          className="text-center text-sm py-2 px-4 font-medium"
          style={{ background: `hsl(var(--store-primary))`, color: 'white' }}
        >
          {store.announcement_bar_text}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to={base} className="flex items-center gap-3 min-w-0">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.store_name || ''} className="h-10 w-10 rounded-lg object-cover" loading="eager" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ background: `hsl(var(--store-primary))` }}
              >
                <StoreIcon className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-base truncate">{store.store_name || 'متجر'}</h1>
              {store.description && <p className="text-xs text-muted-foreground truncate">{store.description}</p>}
            </div>
          </Link>

          {/* القائمة العلوية ثابتة — الصفحات التعريفية تظهر أسفل المتجر فقط */}
          <nav className="hidden md:flex items-center gap-1">
            <NavItem to={base} label="الرئيسية" />
            <NavItem to={`${base}/products`} label="المنتجات" />
          </nav>

          <form onSubmit={submitSearch} className="hidden lg:flex flex-1 max-w-md items-center gap-2 h-11 px-3.5 rounded-[14px] border bg-card shadow-sm" role="search">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <label htmlFor="store-search" className="sr-only">ابحث في المتجر</label>
            <input
              id="store-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن جوال، سماعة، كفر…"
              className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </form>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="lg:hidden">
              <Link to={`${base}/products`} aria-label="البحث"><Search className="w-5 h-5" /></Link>
            </Button>
            <Button variant="ghost" size="icon" asChild title="طلباتي">
              <Link to={`${base}/my-orders`}><ClipboardList className="w-5 h-5" /></Link>
            </Button>
            <Button variant="ghost" size="icon" asChild className="relative" title="المفضلة">
              <Link to={`${base}/favorites`}>
                <Heart className="w-5 h-5" />
                {favCount > 0 && (
                  <Badge className="absolute -top-1 -left-1 h-5 min-w-5 px-1 text-[10px] bg-destructive hover:bg-destructive">
                    {favCount}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link to={`${base}/cart`}>
                <ShoppingCart className="w-5 h-5" />
                {count > 0 && (
                  <Badge
                    className="absolute -top-1 -left-1 h-5 min-w-5 px-1 text-[10px]"
                    style={{ background: `hsl(var(--store-primary))` }}
                  >
                    {count}
                  </Badge>
                )}
              </Link>
            </Button>
          </div>
        </div>
        {/* Claude Design: the shop's categories under the header */}
        {categories.length > 0 && (
          <nav className="hidden md:block border-t" aria-label="التصنيفات">
            <div className="max-w-7xl mx-auto px-4 h-11 flex items-center gap-1 overflow-x-auto">
              <Link
                to={`${base}/products`}
                className={cn('shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors',
                  location.pathname.endsWith('/products') && !activeCategory ? 'font-semibold text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
              >
                الكل
              </Link>
              {categories.map(c => (
                <Link
                  key={c.id}
                  to={`${base}/products?category=${encodeURIComponent(c.name)}`}
                  className={cn('shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors',
                    activeCategory === c.name ? 'font-semibold text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      {/* Claude Design: a tab bar at the bottom on phones */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t" aria-label="التنقل">
        <div className="grid grid-cols-5 h-16">
          {[
            { to: base, label: 'الرئيسية', icon: Home, active: location.pathname === base || location.pathname === `${base}/` },
            { to: `${base}/products`, label: 'المنتجات', icon: LayoutGrid, active: location.pathname.startsWith(`${base}/products`) },
            { to: `${base}/cart`, label: 'السلة', icon: ShoppingCart, active: location.pathname.startsWith(`${base}/cart`), badge: count },
            { to: `${base}/favorites`, label: 'المفضلة', icon: Heart, active: location.pathname.startsWith(`${base}/favorites`), badge: favCount },
            { to: `${base}/my-orders`, label: 'طلباتي', icon: ClipboardList, active: location.pathname.startsWith(`${base}/my-orders`) },
          ].map(t => (
            <Link key={t.label} to={t.to} aria-current={t.active ? 'page' : undefined}
              className={cn('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium', t.active ? 'text-foreground' : 'text-muted-foreground')}>
              <span className="relative">
                <t.icon className="w-5 h-5" style={t.active ? { color: 'hsl(var(--store-primary))' } : undefined} />
                {!!t.badge && t.badge > 0 && (
                  <span className="absolute -top-1.5 -left-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: 'hsl(var(--store-primary))' }}>
                    {t.badge}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-4 gap-8 text-sm">
          <div>
            <h3 className="font-bold mb-3">{store.store_name}</h3>
            <p className="text-muted-foreground">{designExtras?.footer?.about || store.description || 'نوفر أحدث الأجهزة بأفضل الأسعار.'}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">روابط سريعة</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link to={base} className="hover:text-foreground">الرئيسية</Link></li>
              <li><Link to={`${base}/products`} className="hover:text-foreground">جميع المنتجات</Link></li>
              <li><Link to={`${base}/my-orders`} className="hover:text-foreground">طلباتي</Link></li>
              <li><Link to={`${base}/favorites`} className="hover:text-foreground">المفضلة</Link></li>
              <li><Link to={`${base}/track`} className="hover:text-foreground">تتبع الطلب</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">صفحات</h4>
            <ul className="space-y-2 text-muted-foreground">
              {pages.map((p) => (
                <li key={p.id}><Link to={`${base}/page/${p.slug}`} className="hover:text-foreground">{p.title}</Link></li>
              ))}
              {pages.length === 0 && <li className="text-xs">لا توجد صفحات بعد</li>}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">تواصل معنا</h4>
            <div className="flex items-center gap-2 flex-wrap">
              {store.whatsapp_number && (
                <a href={`https://wa.me/${store.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener" title="واتساب" className="hover:text-foreground text-muted-foreground"><Phone className="w-4 h-4" /></a>
              )}
              {store.instagram_url && (
                <a href={store.instagram_url} target="_blank" rel="noopener" title="إنستقرام" className="hover:text-foreground text-muted-foreground"><Instagram className="w-4 h-4" /></a>
              )}
              {store.twitter_url && (
                <a href={store.twitter_url} target="_blank" rel="noopener" title="إكس" className="hover:text-foreground text-muted-foreground"><Twitter className="w-4 h-4" /></a>
              )}
              {/* حسابات إضافية من محرر المتجر */}
              {([
                { k: 'snapchat', label: 'سناب شات' },
                { k: 'tiktok', label: 'تيك توك' },
                { k: 'youtube', label: 'يوتيوب' },
                { k: 'facebook', label: 'فيسبوك' },
                { k: 'linkedin', label: 'لينكدإن' },
                { k: 'website', label: 'الموقع' },
                { k: 'maps', label: 'الموقع على الخريطة' },
              ] as const).map(sn => {
                const url = designExtras?.socials?.[sn.k];
                if (!url) return null;
                return (
                  <a key={sn.k} href={url} target="_blank" rel="noopener"
                    className="px-2.5 py-1 rounded-lg border text-[11px] hover:border-foreground/40 hover:text-foreground text-muted-foreground transition-colors">
                    {sn.label}
                  </a>
                );
              })}
              {designExtras?.socials?.email && (
                <a href={`mailto:${designExtras.socials.email}`}
                  className="px-2.5 py-1 rounded-lg border text-[11px] hover:border-foreground/40 hover:text-foreground text-muted-foreground transition-colors">البريد الإلكتروني</a>
              )}
              {designExtras?.socials?.phone && (
                <a href={`tel:${designExtras.socials.phone}`}
                  className="px-2.5 py-1 rounded-lg border text-[11px] hover:border-foreground/40 hover:text-foreground text-muted-foreground transition-colors">اتصال</a>
              )}
            </div>
            {(designExtras?.socials?.phone || designExtras?.socials?.email) && (
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {designExtras.socials.phone && <p dir="ltr" className="font-mono">{designExtras.socials.phone}</p>}
                {designExtras.socials.email && <p dir="ltr" className="font-mono">{designExtras.socials.email}</p>}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3 whitespace-pre-wrap">
              {designExtras?.footer?.note
                || (store.show_vat_status !== false && merchantLegal?.vat_enabled
                  ? `جميع الأسعار شاملة الضريبة 15%. العملة ${currency}.`
                  : `العملة ${currency}.`)}
            </p>
          </div>
        </div>

        {/* Legal info bar */}
        {merchantLegal && (
          (store.show_cr_number !== false && merchantLegal.cr_number) ||
          (store.show_vat_number !== false && merchantLegal.vat_number) ||
          (store.show_vat_status !== false)
        ) && (
          <div className="border-t bg-background/50">
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-3 text-xs">
              {store.show_cr_number !== false && merchantLegal.cr_number && (
                <Badge variant="outline" className="gap-1.5 font-mono py-1">
                  <FileText className="w-3 h-3" />
                  <span className="text-muted-foreground">س.ت:</span>
                  <span dir="ltr">{merchantLegal.cr_number}</span>
                </Badge>
              )}
              {store.show_vat_number !== false && merchantLegal.vat_number && (
                <Badge variant="outline" className="gap-1.5 font-mono py-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="text-muted-foreground">الرقم الضريبي:</span>
                  <span dir="ltr">{merchantLegal.vat_number}</span>
                </Badge>
              )}
              {store.show_vat_status !== false && (
                <Badge variant={merchantLegal.vat_enabled ? 'default' : 'secondary'} className="gap-1.5 py-1">
                  <ShieldCheck className="w-3 h-3" />
                  {merchantLegal.vat_enabled ? 'الضريبة مفعّلة 15%' : 'بدون ضريبة'}
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="border-t py-4 text-center text-xs text-muted-foreground space-y-1.5">
          <p>{designExtras?.footer?.copyright || `© ${new Date().getFullYear()} ${store.store_name}`}</p>
          {!designExtras?.hide_wasel_badge && (
            <p className="flex items-center justify-center gap-1.5 text-[11px]">
              <span>صُنع بواسطة</span>
              <a href="https://wasel-alpha.vercel.app" target="_blank" rel="noopener"
                className="inline-flex items-center gap-1 font-bold text-foreground/80 hover:text-foreground transition-colors">
                <img src="/brand/app-icon.svg" alt="" className="w-3.5 h-3.5" /> منصة PIXA
              </a>
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={cn('px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors')}>{label}</Link>
  );
}
