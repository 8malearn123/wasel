import { useParams, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2, Store } from 'lucide-react';
import { usePublicStore } from '@/hooks/useOnlineStore';
import { StoreThemeProvider } from '@/components/store/StoreTheme';
import { StoreCartProvider } from '@/components/store/StoreCart';
import { StoreFavoritesProvider } from '@/components/store/StoreFavorites';
import { StoreFavoritesPage } from '@/pages/store/StoreFavoritesPage';
import { StoreLayout } from '@/components/store/StoreLayout';
import { StoreSEO } from '@/components/store/StoreSEO';
import { StoreHomePage } from '@/pages/store/StoreHomePage';
import { StoreProductsPage } from '@/pages/store/StoreProductsPage';
import { StoreProductDetailPage } from '@/pages/store/StoreProductDetailPage';
import { StoreCartPage } from '@/pages/store/StoreCartPage';
import { StoreCheckoutPage } from '@/pages/store/StoreCheckoutPage';
import { StoreThankYouPage } from '@/pages/store/StoreThankYouPage';
import { StoreTrackOrderPage } from '@/pages/store/StoreTrackOrderPage';
import { StoreCustomPage } from '@/pages/store/StoreCustomPage';
import { StoreMyOrdersPage } from '@/pages/store/StoreMyOrdersPage';

export default function PublicStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const { store, devices, accessories, categories, pages, merchantLegal, loading, error, placeOrder } = usePublicStore(slug || '');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background" dir="rtl">
        <Store className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">المتجر غير موجود</h1>
        <p className="text-muted-foreground">تأكد من صحة الرابط</p>
      </div>
    );
  }

  const seoTitle = store.seo_title || store.store_name || 'متجر إلكتروني';
  const seoDesc = store.seo_description || store.description || `تسوّق من ${store.store_name} بأسعار شاملة الضريبة وتوصيل سريع.`;
  const baseUrl = `${window.location.origin}/store/${slug}`;
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: store.store_name,
    description: seoDesc,
    url: baseUrl,
    image: store.og_image_url || store.banner_url || store.logo_url || undefined,
    logo: store.logo_url || undefined,
  };
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: store.store_name,
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/products?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <StoreThemeProvider store={store}>
      <StoreSEO
        title={seoTitle}
        description={seoDesc}
        keywords={store.seo_keywords || undefined}
        image={store.og_image_url || store.banner_url || undefined}
        canonical={baseUrl}
        siteName={store.store_name}
        jsonLd={[orgJsonLd, websiteJsonLd]}
      />
      <StoreCartProvider slug={slug || ''}>
       <StoreFavoritesProvider slug={slug || ''}>
        <StoreLayout store={store} pages={pages} merchantLegal={merchantLegal}>
          <Routes>
            <Route index element={<StoreHomePage store={store} devices={devices} accessories={accessories} categories={categories} />} />
            <Route path="products" element={<StoreProductsPage store={store} devices={devices} accessories={accessories} categories={categories} />} />
            <Route path="device/:productId" element={<StoreProductDetailPage store={store} devices={devices} accessories={accessories} type="device" />} />
            <Route path="accessory/:productId" element={<StoreProductDetailPage store={store} devices={devices} accessories={accessories} type="accessory" />} />
            <Route path="cart" element={<StoreCartPage store={store} />} />
            <Route path="checkout" element={<StoreCheckoutPage store={store} placeOrder={placeOrder} />} />
            <Route path="thank-you/:orderNumber" element={<StoreThankYouPage store={store} />} />
            <Route path="track" element={<StoreTrackOrderPage store={store} />} />
            <Route path="track/:orderNumber" element={<StoreTrackOrderPage store={store} />} />
            <Route path="my-orders" element={<StoreMyOrdersPage store={store} />} />
            <Route path="favorites" element={<StoreFavoritesPage store={store} devices={devices} accessories={accessories} />} />
            <Route path="page/:pageSlug" element={<StoreCustomPage pages={pages} />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </StoreLayout>
       </StoreFavoritesProvider>
      </StoreCartProvider>
    </StoreThemeProvider>
  );
}
