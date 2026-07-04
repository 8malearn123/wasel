import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type StatusType = "available" | "reserved" | "sold" | "transferred" | "repair";

interface StatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  available: {
    label: "Available",
    className: "status-available",
  },
  reserved: {
    label: "Reserved",
    className: "status-reserved",
  },
  sold: {
    label: "Sold",
    className: "status-sold",
  },
  transferred: {
    label: "In Transfer",
    className: "status-transferred",
  },
  repair: {
    label: "In Repair",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];

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
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {config.label}
    </motion.span>
  );
}
