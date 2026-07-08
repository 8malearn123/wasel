import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Extracts the hashed bundle name from index.html so we can tell
// when a new deployment replaced the one this tab is running
const BUNDLE_RE = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

async function fetchBundleId(): Promise<string | null> {
  try {
    const res = await fetch("/index.html", { cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();
    return html.match(BUNDLE_RE)?.[0] ?? null;
  } catch {
    return null;
  }
}

export function useVersionCheck() {
  const currentRef = useRef<string | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    fetchBundleId().then((id) => {
      if (!cancelled) currentRef.current = id;
    });

    const interval = setInterval(async () => {
      if (notifiedRef.current) return;
      const latest = await fetchBundleId();
      if (!latest || !currentRef.current || cancelled) return;
      if (latest !== currentRef.current) {
        notifiedRef.current = true;
        toast.info("يتوفر تحديث جديد للموقع", {
          description: "اضغط للتحديث الآن وتحميل آخر نسخة",
          duration: Infinity,
          action: {
            label: "تحديث الآن",
            onClick: () => window.location.reload(),
          },
        });
      }
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}
