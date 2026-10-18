import { CloudOff, RefreshCw, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Connection status for the till: offline selling, and sales waiting to sync. */
export function OfflineBanner({
  online,
  pending,
  syncing,
  terminalReady,
  onSync,
}: {
  online: boolean;
  pending: number;
  syncing: boolean;
  terminalReady: boolean;
  onSync: () => void;
}) {
  if (online && pending === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2 text-sm",
        online ? "border-primary/30 bg-primary/5" : "border-amber-500/40 bg-amber-500/10",
      )}
      role="status"
    >
      <div className="flex items-center gap-2">
        {online ? <CloudUpload className="w-4 h-4 text-primary" /> : <CloudOff className="w-4 h-4 text-amber-600" />}
        <span className="font-medium">
          {online
            ? "عاد الاتصال"
            : terminalReady
              ? "غير متصل بالإنترنت — البيع بدون إنترنت مفعّل (نقداً أو شبكة فقط)"
              : "غير متصل بالإنترنت — هذا الجهاز غير مسجّل كصندوق بعد، فلا يمكن البيع بدون إنترنت"}
        </span>
        {pending > 0 && (
          <span className="text-muted-foreground">· {pending} عملية بانتظار المزامنة</span>
        )}
        {!online && <span className="text-xs text-muted-foreground">· لا تُحدّث الصفحة حتى يعود الاتصال</span>}
      </div>
      {online && pending > 0 && (
        <Button size="sm" variant="outline" disabled={syncing} onClick={onSync}>
          <RefreshCw className={cn("w-4 h-4 ml-1.5", syncing && "animate-spin")} />
          {syncing ? "جاري المزامنة..." : "مزامنة الآن"}
        </Button>
      )}
    </div>
  );
}
