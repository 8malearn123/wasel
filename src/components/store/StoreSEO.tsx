import { useEffect } from 'react';

interface Props {
  title?: string;
  description?: string;
  image?: string;
  keywords?: string;
  canonical?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
  siteName?: string;
}

const MANAGED_ATTR = 'data-store-seo';

/** Lightweight head manager for store pages (title, meta, canonical, JSON-LD) */
export function StoreSEO({
  title,
  description,
  image,
  keywords,
  canonical,
  type = 'website',
  noindex,
  jsonLd,
  siteName,
}: Props) {
  useEffect(() => {
    const head = document.head;

    // Title
    if (title) document.title = title;

    const upsertMeta = (key: string, content: string, attr: 'name' | 'property' = 'name') => {
      if (!content) return;
      let tag = head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, key);
        tag.setAttribute(MANAGED_ATTR, 'true');
        head.appendChild(tag);
      }
      tag.content = content;
    };

    if (description) upsertMeta('description', description);
    if (keywords) upsertMeta('keywords', keywords);

    // Open Graph
    if (title) upsertMeta('og:title', title, 'property');
    if (description) upsertMeta('og:description', description, 'property');
    if (image) upsertMeta('og:image', image, 'property');
    if (siteName) upsertMeta('og:site_name', siteName, 'property');
    upsertMeta('og:type', type, 'property');
    upsertMeta('og:url', canonical || window.location.href, 'property');

    // Twitter
    upsertMeta('twitter:card', image ? 'summary_large_image' : 'summary');
    if (title) upsertMeta('twitter:title', title);
    if (description) upsertMeta('twitter:description', description);
    if (image) upsertMeta('twitter:image', image);

    // Robots
    upsertMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // Canonical
    const href = canonical || window.location.href.split('#')[0];
    let link = head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      link.setAttribute(MANAGED_ATTR, 'true');
      head.appendChild(link);
    }
    link.href = href;

    // JSON-LD structured data (Google rich results)
    const oldScripts = head.querySelectorAll(`script[type="application/ld+json"][${MANAGED_ATTR}]`);
    oldScripts.forEach((s) => s.remove());
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach((data) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute(MANAGED_ATTR, 'true');
        script.text = JSON.stringify(data);
        head.appendChild(script);
      });
    }
  }, [title, description, image, keywords, canonical, type, noindex, JSON.stringify(jsonLd), siteName]);

  return null;
}
