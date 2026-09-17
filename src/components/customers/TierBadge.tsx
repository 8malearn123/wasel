import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { tierStyle } from "@/lib/loyaltyTiers";

/**
 * A loyalty tier, wearing its own metal — the dot carries the colour so the
 * four tiers are told apart at a glance, not by reading the word.
 */
export function TierBadge({ tier, className }: { tier?: string; className?: string }) {
  const { isRTL } = useLanguage();
  const style = tierStyle(tier);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        style.badge,
        className
      )}
    >
      <span className={cn("w-2 h-2 rounded-full shadow-sm", style.dot)} />
      {isRTL ? style.ar : style.en}
    </span>
  );
}
