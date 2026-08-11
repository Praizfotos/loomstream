import { cn } from "@/lib/utils";
import type { StreamStatus } from "@/lib/stream";

const STATUS_STYLES: Record<StreamStatus, { label: string; className: string; dot: string }> = {
  UPCOMING: {
    label: "Upcoming",
    className: "border-sky-300 bg-sky-50 text-sky-800",
    dot: "bg-sky-500",
  },
  CLIFF: {
    label: "Cliff",
    className: "border-amber-300 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  ACTIVE: {
    label: "Active",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  FULLY_VESTED: {
    label: "Fully Vested",
    className: "border-violet-300 bg-violet-50 text-violet-800",
    dot: "bg-violet-500",
  },
  CANCELED: {
    label: "Canceled",
    className: "border-red-300 bg-red-50 text-red-800",
    dot: "bg-red-500",
  },
};

export function StreamStatusBadge({
  status,
  className,
}: {
  status: StreamStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status];
  return (
    <span
      role="status"
      aria-label={`Stream status: ${style.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style.className,
        className
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}