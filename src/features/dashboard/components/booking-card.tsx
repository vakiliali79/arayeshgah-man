import Link from "next/link";
import { CalendarIcon, ClockIcon, MapPinIcon, ScissorsIcon } from "@/components/icons";
import { BookingStatusBadge } from "@/components/ui";
import type { BookingStatus } from "@/db/types";
import { formatDateTime } from "@/lib/format/datetime";
import { formatToman, toPersianDigits } from "@/lib/utils";

export interface BookingCardData {
  id: string;
  trackingCode: string;
  status: BookingStatus;
  startsAt: Date;
  timezone: string;
  serviceName: string;
  durationMinutes: number;
  priceToman: number;
  stylistName: string;
  salonName: string | null;
  /** نام مشتری (در نمای آرایشگر/سالن) */
  customerName?: string | null;
}

/** کارت فشرده نوبت؛ لینک به صفحه جزئیات */
export function BookingCard({ b, href, actions }: { b: BookingCardData; href?: string; actions?: React.ReactNode }) {
  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 font-bold">
            <ScissorsIcon size={16} className="text-primary-600" /> {b.serviceName}
          </p>
          <p className="text-sm text-muted">
            {b.customerName ? `${b.customerName} · ` : ""}
            {b.stylistName}
            {b.salonName ? ` · ${b.salonName}` : " · مستقل"}
          </p>
        </div>
        <BookingStatusBadge status={b.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <CalendarIcon size={15} /> {formatDateTime(b.startsAt, b.timezone)}
        </span>
        <span className="flex items-center gap-1.5">
          <ClockIcon size={15} /> {toPersianDigits(b.durationMinutes)} دقیقه
        </span>
        <span className="font-medium text-foreground">{formatToman(b.priceToman)}</span>
        <span dir="ltr" className="text-xs">{b.trackingCode}</span>
      </div>
    </>
  );
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-soft transition-shadow hover:shadow-lift">
      {href ? (
        <Link href={href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
      {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">{actions}</div>}
    </article>
  );
}

export function LocationLine({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted">
      <MapPinIcon size={15} /> {text}
    </span>
  );
}
