import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarIcon, ClockIcon, HeartIcon, ImageIcon, MapPinIcon, StarIcon } from "@/components/icons";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, buttonVariants, EmptyState, Rating } from "@/components/ui";
import { Textarea } from "@/components/ui";
import { toggleFavoriteAction } from "@/features/dashboard/actions/customer";
import { bookHref } from "@/lib/booking-links";
import { fileUrl } from "@/lib/files";
import { formatClock, formatDate, formatTime, formatWeekdayDate, IRAN_WEEK_ORDER, localDateKey, localTimeKey, WEEKDAYS_FA } from "@/lib/format/datetime";
import { formatToman, toPersianDigits } from "@/lib/utils";
import type { NextAvailability, Offering } from "@/server/public/details";
import { reportReviewAction } from "../actions/review";

export function Section({ id, title, children, action }: { id?: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-24 rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id ? `${id}-title` : undefined} className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** دکمه علاقه‌مندی: مهمان ← ورود و بازگشت به همین صفحه */
export function FavoriteButton({ loggedIn, favorited, target, returnTo }: { loggedIn: boolean; favorited: boolean; target: { salonId?: string; stylistId?: string }; returnTo: string }) {
  if (!loggedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <HeartIcon size={16} /> افزودن به علاقه‌مندی‌ها
      </Link>
    );
  }
  return (
    <ActionForm action={toggleFavoriteAction} submitLabel={favorited ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"} submitVariant={favorited ? "secondary" : "outline"} submitSize="sm" inline hideMessage>
      {target.salonId && <input type="hidden" name="salonId" value={target.salonId} />}
      {target.stylistId && <input type="hidden" name="stylistId" value={target.stylistId} />}
    </ActionForm>
  );
}

/** پیوند نقشه: با مختصات ← OpenStreetMap و Google Maps؛ بدون مختصات ← جستجوی نشانی */
export function MapLinks({ lat, lng, address }: { lat: string | null; lng: string | null; address: string }) {
  const links = lat && lng
    ? [
        { href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`, label: "نقشه (OpenStreetMap)" },
        { href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, label: "Google Maps" },
      ]
    : [{ href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, label: "جستجوی نشانی در نقشه" }];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <MapPinIcon size={16} /> {l.label}
        </a>
      ))}
    </div>
  );
}

/** ساعات کاری هفتگی (شنبه تا جمعه) */
export function WeeklyHours({ hours }: { hours: { dayOfWeek: number; opensAt: string; closesAt: string }[] }) {
  if (hours.length === 0) return <p className="text-sm text-muted">ساعات کاری هنوز ثبت نشده است.</p>;
  return (
    <dl className="divide-y divide-border text-sm">
      {IRAN_WEEK_ORDER.map((d) => {
        const day = hours.filter((h) => h.dayOfWeek === d);
        return (
          <div key={d} className="flex justify-between gap-3 py-2">
            <dt className="font-medium">{WEEKDAYS_FA[d]}</dt>
            <dd className={day.length ? "" : "text-muted"}>{day.length ? day.map((h) => `${formatClock(h.opensAt)} تا ${formatClock(h.closesAt)}`).join("، ") : "تعطیل"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** فهرست خدمات با قیمت، مدت و دکمه رزرو (گروه‌بندی بر اساس خدمت) */
export function OfferingsList({ offerings, groupBy, showSalon }: { offerings: Offering[]; groupBy: "service" | "location"; showSalon?: boolean }) {
  if (offerings.length === 0) {
    return <EmptyState title="خدمت قابل رزروی ثبت نشده است" description="به‌زودی خدمات این صفحه اضافه می‌شود." className="py-8" />;
  }
  if (groupBy === "service") {
    const groups = new Map<string, Offering[]>();
    for (const o of offerings) groups.set(o.serviceId, [...(groups.get(o.serviceId) ?? []), o]);
    return (
      <ul className="divide-y divide-border">
        {[...groups.values()].map((g) => {
          const o = g[0]!;
          const prices = g.map((x) => x.priceToman);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          return (
            <li key={o.serviceId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-semibold">{o.serviceName} {o.categoryLabel && <Badge tone="neutral" className="ms-1">{o.categoryLabel}</Badge>}</p>
                {o.description && <p className="text-sm leading-7 text-muted">{o.description}</p>}
                <p className="flex flex-wrap gap-x-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><ClockIcon size={14} /> {toPersianDigits(o.durationMinutes)} دقیقه</span>
                  <span>{min === max ? formatToman(min) : `${formatToman(min)} تا ${formatToman(max)}`}</span>
                  <span>آرایشگر: {g.map((x) => x.stylistName).join("، ")}</span>
                </p>
              </div>
              <Link href={bookHref({ salon: o.salonSlug, service: o.serviceId, stylist: g.length === 1 ? o.stylistSlug : null })} className={buttonVariants({ size: "sm", className: "shrink-0" })}>
                رزرو این خدمت
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {offerings.map((o) => (
        <li key={`${o.serviceId}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-semibold">{o.serviceName} {o.categoryLabel && <Badge tone="neutral" className="ms-1">{o.categoryLabel}</Badge>}</p>
            <p className="flex flex-wrap gap-x-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><ClockIcon size={14} /> {toPersianDigits(o.durationMinutes)} دقیقه</span>
              <span>{formatToman(o.priceToman)}</span>
              {showSalon && <span>{o.salonName ? <>در <Link href={`/salons/${o.salonSlug}`} className="text-primary-700 hover:underline">{o.salonName}</Link></> : "نوبت مستقل"}</span>}
            </p>
          </div>
          <Link href={bookHref({ stylist: o.stylistSlug, service: o.serviceId, salon: o.salonSlug })} className={buttonVariants({ size: "sm", className: "shrink-0" })}>
            رزرو
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** نزدیک‌ترین زمان‌های آزاد؛ هر زمان مستقیم به مرحله تأیید رزرو می‌رود */
export function AvailabilityList({ items, salonSlug }: { items: NextAvailability[]; salonSlug?: string | null }) {
  const withSlots = items.filter((i) => i.slots.length > 0);
  if (withSlots.length === 0) {
    return <p className="text-sm leading-7 text-muted">در ۷ روز آینده زمان آزادی ثبت نشده است. می‌توانید از صفحه رزرو روزهای بعد را بررسی کنید.</p>;
  }
  return (
    <ul className="space-y-4">
      {withSlots.map((i) => (
        <li key={`${i.stylistId}:${i.salonName}`} className="space-y-2">
          <p className="text-sm">
            <Link href={`/stylists/${i.stylistSlug}`} className="font-semibold hover:underline">{i.stylistName}</Link>
            <span className="text-muted"> — {i.serviceName}{i.salonName ? ` · ${i.salonName}` : " · نوبت مستقل"}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {i.slots.map((s) => (
              <Link
                key={s.toISOString()}
                href={bookHref({ salon: salonSlug, stylist: i.stylistSlug, service: i.serviceId, date: localDateKey(s, i.timezone), time: localTimeKey(s, i.timezone) })}
                className="rounded-md border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100"
              >
                <CalendarIcon size={12} className="me-1 inline" />
                {formatWeekdayDate(s, i.timezone)} — {formatTime(s, i.timezone)}
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PortfolioGrid({ items }: { items: { id: string; title: string | null; description: string | null; fileId: string }[] }) {
  if (items.length === 0) return <EmptyState icon={<ImageIcon />} title="هنوز نمونه‌کاری منتشر نشده است" className="py-8" />;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-md border border-border">
          <div className="relative aspect-square bg-surface-muted">
            <Image src={fileUrl(p.fileId)!} alt={p.title ?? "نمونه‌کار"} fill unoptimized sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
          </div>
          {p.title && <p className="truncate px-2 py-1.5 text-xs">{p.title}</p>}
        </li>
      ))}
    </ul>
  );
}

type PublicReview = { id: string; rating: number; comment: string | null; reply: string | null; createdAt: Date; serviceName: string; stylistName: string; stylistSlug: string; customerName: string };

export function ReviewsList({ reviews, loggedIn, returnTo, showStylist }: { reviews: PublicReview[]; loggedIn: boolean; returnTo: string; showStylist?: boolean }) {
  if (reviews.length === 0) return <EmptyState icon={<StarIcon />} title="هنوز نظری ثبت نشده است" description="نظرها فقط پس از انجام نوبت توسط مشتریان ثبت می‌شوند." className="py-8" />;
  return (
    <ul className="divide-y divide-border">
      {reviews.map((r) => (
        <li key={r.id} className="space-y-2 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{r.customerName}</p>
            <Rating value={r.rating} />
          </div>
          <p className="text-xs text-muted">
            {r.serviceName}
            {showStylist && <> · <Link href={`/stylists/${r.stylistSlug}`} className="hover:underline">{r.stylistName}</Link></>} · {formatDate(r.createdAt)}
          </p>
          {r.comment && <p className="text-sm leading-7">{r.comment}</p>}
          {r.reply && <p className="rounded-md bg-surface-muted px-3 py-2 text-sm leading-7"><span className="font-semibold">پاسخ: </span>{r.reply}</p>}
          {loggedIn ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted hover:text-foreground">گزارش این نظر</summary>
              <ActionForm action={reportReviewAction} submitLabel="ارسال گزارش" submitVariant="outline" submitSize="sm" resetOnSuccess className="mt-2">
                <input type="hidden" name="reviewId" value={r.id} />
                <label htmlFor={`reason-${r.id}`} className="sr-only">دلیل گزارش</label>
                <Textarea id={`reason-${r.id}`} name="reason" required minLength={10} maxLength={1000} placeholder="دلیل گزارش (حداقل ۱۰ نویسه)" className="min-h-20 text-sm" />
              </ActionForm>
            </details>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="text-xs text-muted hover:text-foreground">برای گزارش نظر وارد شوید</Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/** داده ساخت‌یافته برای موتورهای جستجو */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
