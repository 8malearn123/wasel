import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StoreSEO } from '@/components/store/StoreSEO';
import type { StorePage } from '@/hooks/useOnlineStore';

export function StoreCustomPage({ pages }: { pages: StorePage[] }) {
  const { pageSlug, slug } = useParams<{ pageSlug: string; slug: string }>();
  const page = pages.find((p) => p.slug === pageSlug);

  if (!page) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <StoreSEO title="الصفحة غير موجودة" noindex />
        <h1 className="text-2xl font-bold mb-2">الصفحة غير موجودة</h1>
        <Button asChild><Link to={`/store/${slug}`}>الرجوع للرئيسية</Link></Button>
      </div>
    );
  }

  const desc = (page.content || '').replace(/\s+/g, ' ').trim().slice(0, 160) || page.title;
  const canonical = `${window.location.origin}/store/${slug}/page/${page.slug}`;

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <StoreSEO title={page.title} description={desc} canonical={canonical} type="article" />
      <h1 className="text-3xl font-bold mb-6">{page.title}</h1>
      <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground/90">
        {page.content || 'لا يوجد محتوى بعد'}
      </div>
    </article>
  );
}
