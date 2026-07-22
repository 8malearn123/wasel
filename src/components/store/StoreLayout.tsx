import { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingCart, Search, Instagram, Twitter, Phone, Store as StoreIcon, ClipboardList, ShieldCheck, FileText, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { StoreSettings, StorePage, MerchantLegalInfo, DesignExtras } from '@/hooks/useOnlineStore';
import { useStoreCart } from './StoreCart';
import { useStoreFavorites } from './StoreFavorites';
import { cn } from '@/lib/utils';

interface Props {
  store: StoreSettings;
  pages?: StorePage[];
  merchantLegal?: MerchantLegalInfo | null;
  // نصوص الفوتر القابلة للتعديل من محرر المتجر
  designExtras?: DesignExtras | null;
  children: ReactNode;
}

export function StoreLayout({ store, pages = [], merchantLegal, designExtras, children }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const { count } = useStoreCart();
  const { count: favCount } = useStoreFavorites();
  const base = `/store/${slug}`;
  const currency = store.currency_symbol || 'ر.س';

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

          <nav className="hidden md:flex items-center gap-1">
            <NavItem to={base} label="الرئيسية" />
            <NavItem to={`${base}/products`} label="المنتجات" />
            {pages.slice(0, 3).map((p) => (
              <NavItem key={p.id} to={`${base}/page/${p.slug}`} label={p.title} />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to={`${base}/products`}><Search className="w-5 h-5" /></Link>
            </Button>
            <Button variant="ghost" size="icon" asChild title="طلباتي">
              <Link to={`${base}/my-orders`}><ClipboardList className="w-5 h-5" /></Link>
            </Button>
            <Button variant="ghost" size="icon" asChild className="relative" title="المفضلة">
              <Link to={`${base}/favorites`}>
                <Heart className="w-5 h-5" />
                {favCount > 0 && (
                  <Badge className="absolute -top-1 -left-1 h-5 min-w-5 px-1 text-[10px] bg-red-500 hover:bg-red-500">
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
      </header>

      <main className="flex-1">{children}</main>

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
            <div className="flex items-center gap-3">
              {store.whatsapp_number && (
                <a href={`https://wa.me/${store.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="hover:text-foreground text-muted-foreground"><Phone className="w-4 h-4" /></a>
              )}
              {store.instagram_url && (
                <a href={store.instagram_url} target="_blank" rel="noopener" className="hover:text-foreground text-muted-foreground"><Instagram className="w-4 h-4" /></a>
              )}
              {store.twitter_url && (
                <a href={store.twitter_url} target="_blank" rel="noopener" className="hover:text-foreground text-muted-foreground"><Twitter className="w-4 h-4" /></a>
              )}
            </div>
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

        <div className="border-t py-4 text-center text-xs text-muted-foreground">
          {designExtras?.footer?.copyright || `© ${new Date().getFullYear()} ${store.store_name}`}
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
