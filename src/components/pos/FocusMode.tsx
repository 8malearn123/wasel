import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize2, Clock, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "pos_focus_mode";

const readSaved = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Cashier focus mode: the POS alone on screen (no sidebar or header), full screen when the
 * browser allows it. Remembered per device; full screen needs a click, so after a reload the
 * layout comes back and the bar offers to go full screen again.
 */
export function useFocusMode() {
  const [focus, setFocus] = useState(readSaved);
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);

  const persist = (on: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      /* private mode: just don't remember */
    }
  };

  const enterFullscreen = useCallback(() => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        /* denied or unsupported: focus mode still works without it */
      });
    }
  }, []);

  const enter = useCallback(() => {
    setFocus(true);
    persist(true);
    enterFullscreen();
  }, [enterFullscreen]);

  const exit = useCallback(() => {
    setFocus(false);
    persist(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // Leaving full screen with the browser's own Esc also leaves focus mode.
  useEffect(() => {
    const onChange = () => {
      const isFull = !!document.fullscreenElement;
      setFullscreen((wasFull) => {
        if (wasFull && !isFull) {
          setFocus(false);
          persist(false);
        }
        return isFull;
      });
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Esc leaves focus mode when not in full screen (in full screen the browser handles Esc),
  // unless a dialog is open: then Esc closes the dialog.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.fullscreenElement) return;
      if (document.querySelector('[role="dialog"]')) return;
      exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, exit]);

  return { focus, fullscreen, enter, exit, enterFullscreen };
}

/** Thin bar shown instead of the app header while in focus mode. */
export function FocusModeBar({
  branchName,
  userName,
  fullscreen,
  onFullscreen,
  onExit,
}: {
  branchName?: string;
  userName?: string;
  fullscreen: boolean;
  onFullscreen: () => void;
  onExit: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2">
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <Store className="w-4 h-4 text-primary" />
          {branchName || "—"}
        </span>
        {userName && <span className="text-muted-foreground">{userName}</span>}
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {now.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="hidden md:inline text-xs text-muted-foreground">F2 للمسح · Esc للخروج</span>
      </div>
      <div className="flex items-center gap-2">
        {!fullscreen && (
          <Button variant="outline" size="sm" onClick={onFullscreen}>
            <Maximize className="w-4 h-4 ml-1.5" />
            ملء الشاشة
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onExit}>
          <Minimize2 className="w-4 h-4 ml-1.5" />
          خروج من وضع التركيز
        </Button>
      </div>
    </div>
  );
}

/** Button that turns focus mode on (shown in the normal POS layout). */
export function FocusModeButton({ onEnter }: { onEnter: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onEnter} title="إخفاء القوائم وملء الشاشة للكاشير">
      <Maximize className="w-4 h-4 ml-1.5" />
      وضع التركيز
    </Button>
  );
}
