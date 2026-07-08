import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Smartphone, Package, User, Wrench, Receipt, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SearchResult {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  path: string;
}

export function GlobalSearch() {
  const { t, isRTL } = useLanguage();
  const { merchant } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Debounced search across the main entities
  useEffect(() => {
    if (!merchant || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Map common Arabic brand/model spellings to the English catalog names
    const ALIASES: [RegExp, string][] = [
      [/ايفون|آيفون|أيفون/g, "iPhone"],
      [/سامسونج|سامسونغ|جالكسي|قالكسي/g, "Galaxy"],
      [/بكسل|بيكسل/g, "Pixel"],
      [/شاومي/g, "Xiaomi"],
      [/هواوي/g, "Huawei"],
      [/برو ماكس/g, "Pro Max"],
      [/برو/g, "Pro"],
      [/الترا|ألترا/g, "Ultra"],
    ];
    let q = query.trim();
    for (const [re, en] of ALIASES) q = q.replace(re, en);
    const like = `%${q}%`;
    const timer = setTimeout(async () => {
      const [devices, accessories, customers, repairs, sales] = await Promise.all([
        supabase.from("devices")
          .select("id, model, brand, imei, price")
          .eq("merchant_id", merchant.id)
          .or(`model.ilike.${like},brand.ilike.${like},imei.ilike.${like}`)
          .limit(4),
        supabase.from("accessories")
          .select("id, name, sku, price")
          .eq("merchant_id", merchant.id)
          .or(`name.ilike.${like},sku.ilike.${like}`)
          .limit(4),
        supabase.from("customers")
          .select("id, name, phone")
          .eq("merchant_id", merchant.id)
          .or(`name.ilike.${like},phone.ilike.${like}`)
          .limit(4),
        supabase.from("repair_orders")
          .select("id, repair_number, customer_name, device_model")
          .eq("merchant_id", merchant.id)
          .or(`repair_number.ilike.${like},customer_name.ilike.${like}`)
          .limit(3),
        supabase.from("sales")
          .select("id, invoice_number, total_amount, customer_name")
          .eq("merchant_id", merchant.id)
          .ilike("invoice_number", like)
          .limit(3),
      ]);

      const found: SearchResult[] = [];
      for (const d of devices.data || []) {
        found.push({
          id: `d-${d.id}`, icon: Smartphone,
          title: `${d.brand ? d.brand + " " : ""}${d.model}`,
          subtitle: `IMEI: ${d.imei} — ${Number(d.price).toLocaleString()} ر.س`,
          path: "/inventory",
        });
      }
      for (const a of accessories.data || []) {
        found.push({
          id: `a-${a.id}`, icon: Package,
          title: a.name,
          subtitle: `${a.sku} — ${Number(a.price).toLocaleString()} ر.س`,
          path: "/inventory",
        });
      }
      for (const c of customers.data || []) {
        found.push({
          id: `c-${c.id}`, icon: User,
          title: c.name,
          subtitle: c.phone || "",
          path: `/customers/${c.id}`,
        });
      }
      for (const r of repairs.data || []) {
        found.push({
          id: `r-${r.id}`, icon: Wrench,
          title: `#${r.repair_number} — ${r.customer_name}`,
          subtitle: r.device_model || (isRTL ? "طلب صيانة" : "Repair order"),
          path: "/repairs",
        });
      }
      for (const s of sales.data || []) {
        found.push({
          id: `s-${s.id}`, icon: Receipt,
          title: `#${s.invoice_number}`,
          subtitle: `${s.customer_name || ""} — ${Number(s.total_amount).toLocaleString()} ر.س`,
          path: "/pos",
        });
      }

      setResults(found);
      setLoading(false);
      setOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, merchant, isRTL]);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(r.path);
  };

  return (
    <div ref={boxRef} className="relative hidden lg:block">
      <Search className={cn(
        "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
        isRTL ? "right-3" : "left-3"
      )} />
      <Input
        placeholder={t.common.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && results.length > 0) go(results[0]);
        }}
        className={cn(
          "w-80 bg-muted/50 border-transparent focus:border-primary",
          isRTL ? "pr-9" : "pl-9"
        )}
      />
      {open && (
        <div className={cn(
          "absolute top-full mt-2 w-[420px] rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden",
          isRTL ? "right-0" : "left-0"
        )}>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isRTL ? "لا توجد نتائج" : "No results"}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => go(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-start"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <r.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
