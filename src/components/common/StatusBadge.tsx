import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";

type StatusType = "available" | "reserved" | "sold" | "transferred" | "repair";

interface StatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<StatusType, { label: string; labelAr: string; className: string }> = {
  available: {
    label: "Available",
    labelAr: "متاح",
    className: "status-available",
  },
  reserved: {
    label: "Reserved",
    labelAr: "محجوز",
    className: "status-reserved",
  },
  sold: {
    label: "Sold",
    labelAr: "مباع",
    className: "status-sold",
  },
  transferred: {
    label: "In Transfer",
    labelAr: "قيد التحويل",
    className: "status-transferred",
  },
  repair: {
    label: "In Repair",
    labelAr: "في الصيانة",
    className: "bg-primary/10 text-primary border-primary/20",
  },
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];
  const { isRTL } = useLanguage();

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center rounded-full font-medium border",
        config.className,
        sizeStyles[size]
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current me-1.5" />
      {isRTL ? config.labelAr : config.label}
    </motion.span>
  );
}
