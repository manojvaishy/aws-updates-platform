import { Priority } from "@/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Priority, string> = {
  critical: "bg-red-100 text-red-700 border border-red-200",
  high: "bg-orange-100 text-orange-700 border border-orange-200",
  normal: "bg-gray-100 text-gray-600 border border-gray-200",
};

const LABELS: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
};

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
        STYLES[priority],
        className
      )}
    >
      {priority === "critical" && (
        <span className="mr-1" aria-hidden="true">⚠</span>
      )}
      {LABELS[priority]}
    </span>
  );
}
