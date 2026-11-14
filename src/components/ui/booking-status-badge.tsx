import type { BookingStatus } from "@/db/types";
import { BOOKING_STATUS_LABEL } from "@/lib/format/labels";
import { cn } from "@/lib/utils";

const tones: Record<BookingStatus, string> = {
  pending: "bg-gold-50 text-gold-600 ring-gold-200",
  confirmed: "bg-primary-50 text-primary-700 ring-primary-100",
  completed: "bg-success-soft text-success ring-success/15",
  cancelled: "bg-surface-muted text-muted ring-border",
  rejected: "bg-danger-soft text-danger ring-danger/20",
  no_show: "bg-danger-soft text-danger ring-danger/20",
};

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", tones[status], className)}>
      {BOOKING_STATUS_LABEL[status]}
    </span>
  );
}
