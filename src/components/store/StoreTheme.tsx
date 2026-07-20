import { ReactNode, useEffect } from 'react';
import type { StoreSettings } from '@/hooks/useOnlineStore';

const FONT_LINKS: Record<string, string> = {
  cairo: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap',
  tajawal: 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap',
  ibm_plex: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&display=swap',
  noto: 'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700;900&display=swap',
  almarai: 'https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=swap',
  changa: 'https://fonts.googleapis.com/css2?family=Changa:wght@400;600;700&display=swap',
  elmessiri: 'https://fonts.googleapis.com/css2?family=El+Messiri:wght@400;600;700&display=swap',
  amiri: 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap',
  reemkufi: 'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;600;700&display=swap',
  lalezar: 'https://fonts.googleapis.com/css2?family=Lalezar&display=swap',
};

const FONT_FAMILY: Record<string, string> = {
  cairo: '"Cairo", system-ui, sans-serif',
  tajawal: '"Tajawal", system-ui, sans-serif',
  ibm_plex: '"IBM Plex Sans Arabic", system-ui, sans-serif',
  noto: '"Noto Kufi Arabic", system-ui, sans-serif',
  almarai: '"Almarai", system-ui, sans-serif',
  changa: '"Changa", system-ui, sans-serif',
  elmessiri: '"El Messiri", system-ui, sans-serif',
  amiri: '"Amiri", serif',
  reemkufi: '"Reem Kufi", system-ui, sans-serif',
  lalezar: '"Lalezar", system-ui, sans-serif',
};

function hexToHsl(hex: string): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return '240 70% 60%';
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface Props {
  store: StoreSettings;
  children: ReactNode;
  // لون خط المتجر المختار من استوديو تصميم ماكس
  textColor?: string | null;
}

export function StoreThemeProvider({ store, children, textColor }: Props) {
  const fontKey = store.font_family || 'cairo';
  const fontHref = FONT_LINKS[fontKey] || FONT_LINKS.cairo;
  const fontStack = FONT_FAMILY[fontKey] || FONT_FAMILY.cairo;
  const primary = store.primary_color || '#6366f1';
  const secondary = store.secondary_color || '#8b5cf6';

  useEffect(() => {
    const id = 'store-font-link';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = fontHref;
  }, [fontHref]);

  // Public storefronts keep the light theme with the merchant's own colors,
  // even though the merchant dashboard defaults to dark
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      if (wasDark) root.classList.add('dark');
    };
  }, []);

  const style: Record<string, string> = {
    '--store-primary': hexToHsl(primary),
    '--store-secondary': hexToHsl(secondary),
    '--store-primary-hex': primary,
    '--store-secondary-hex': secondary,
    fontFamily: fontStack,
  };
  if (textColor && /^#[0-9a-fA-F]{6}$/.test(textColor)) {
    style['--foreground'] = hexToHsl(textColor);
    style.color = textColor;
  }

  return (
    <div style={style as React.CSSProperties} dir="rtl" className="store-root min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}

export function getThemeClass(themeId?: string | null) {
  switch (themeId) {
    case 'minimal': return 'theme-minimal';
    case 'bold': return 'theme-bold';
    case 'classic': return 'theme-classic';
    default: return 'theme-modern';
  }
}
