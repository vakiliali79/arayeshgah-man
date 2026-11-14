import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, CheckIcon, ClockIcon, ScissorsIcon, StoreIcon, UserIcon } from "@/components/icons";
import { Alert, Avatar, buttonVariants, EmptyState } from "@/components/ui";
import { db } from "@/db";
import { BookingConfirmForm } from "@/features/public/components/booking-confirm-form";
import { bookHref } from "@/lib/booking-links";
import { formatDate, formatTime, formatWeekdayDate, localTimeKey, WEEKDAYS_FA } from "@/lib/format/datetime";
import { cn, formatToman, toPersianDigits } from "@/lib/utils";
import { getCurrentSession } from "@/server/auth/current";
import { parseBookingParams, resolveBookingFlow, type BookingFlow, type BookingStep } from "@/server/public/booking-flow";
import { currentTime } from "@/server/time";

export const metadata: Metadata = {
  title: "رزرو نوبت",
  description: "رزرو آنلاین نوبت سالن زیبایی و آرایشگر در چند مرحله ساده.",
  robots: { index: false, follow: true },
};

const STEPS: { key: BookingStep; label: string }[] = [
  { key: "service", label: "خدمت" },
  { key: "stylist", label: "آرایشگر" },
  { key: "date", label: "تاریخ" },
  { key: "time", label: "ساعت" },
  { key: "confirm", label: "تأیید" },
];

function Stepper({ step }: { step: BookingStep }) {
  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="flex flex-wrap items-center gap-1 pb-1 text-xs sm:gap-2 sm:text-sm" aria-label="مراحل رزرو">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex shrink-0 items-center gap-1 sm:gap-2" aria-current={active ? "step" : undefined}>
            <span className={cn("flex size-7 items-center justify-center rounded-full font-bold", done ? "bg-success text-white" : active ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted")}>
              {done ? <CheckIcon size={14} /> : toPersianDigits(i + 1)}
            </span>
            <span className={active ? "font-semibold" : "hidden text-muted sm:inline"}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-3 bg-border sm:mx-1 sm:w-8" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/** خلاصه انتخاب‌ها با پیوند تغییر هر مورد */
function Summary({ f }: { f: BookingFlow }) {
  const tz = f.ctx?.timezone;
  const rows = [
    f.salon && { icon: <StoreIcon size={16} />, label: "سالن", value: <Link href={`/salons/${f.salon.slug}`} className="hover:underline">{f.salon.name}</Link>, change: f.stylist && !f.ctx?.salonId ? null : "/salons" },
    f.ctx && { icon: <ScissorsIcon size={16} />, label: "خدمت", value: `${f.ctx.serviceName} — ${toPersianDigits(f.ctx.durationMinutes)} دقیقه`, change: bookHref({ salon: f.salon?.slug, stylist: f.stylist?.slug }) },
    f.stylist && { icon: <UserIcon size={16} />, label: "آرایشگر", value: <Link href={`/stylists/${f.stylist.slug}`} className="hover:underline">{f.stylist.name}</Link>, change: f.ctx && f.stylistChoices.length > 1 ? bookHref({ salon: f.salon?.slug, service: f.ctx.serviceId }) : null },
    f.date && tz && { icon: <CalendarIcon size={16} />, label: "تاریخ", value: formatWeekdayDate(`${f.date}T12:00:00Z`, "UTC"), change: bookHref({ salon: f.salon?.slug, stylist: f.stylist?.slug, service: f.ctx?.serviceId }) },
    f.startsAt && tz && { icon: <ClockIcon size={16} />, label: "ساعت", value: formatTime(f.startsAt, tz), change: bookHref({ salon: f.salon?.slug, stylist: f.stylist?.slug, service: f.ctx?.serviceId, date: f.date }) },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: React.ReactNode; change: string | null }[];
  if (rows.length === 0) return null;
  return (
    <dl className="divide-y divide-border rounded-lg border border-border bg-surface px-4 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 py-3">
          <dt className="flex items-center gap-2 text-muted">{r.icon} {r.label}</dt>
          <dd className="flex items-center gap-3 text-end font-medium">
            {r.value}
            {r.change && <Link href={r.change} className="text-xs font-normal text-primary-700 hover:underline">تغییر</Link>}
          </dd>
        </div>
      ))}
      {f.ctx && (
        <div className="flex items-center justify-between gap-3 py-3">
          <dt className="text-muted">مبلغ</dt>
          <dd className="font-bold">{formatToman(f.ctx.priceToman)}</dd>
        </div>
      )}
    </dl>
  );
}

const choiceClass = "flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50/40";

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const raw = await searchParams;
  const params = parseBookingParams(raw);
  const session = await getCurrentSession();
  const f = await resolveBookingFlow(db, params, { now: currentTime(), customerId: session?.user.id });
  const base = { salon: params.salon, stylist: f.stylist?.slug ?? params.stylist };

  return (
    <div className="container-page max-w-3xl space-y-6 py-8 sm:py-10">
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">رزرو نوبت</h1>
        {f.step !== "start" && <Stepper step={f.step} />}
      </div>

      {f.notice && <Alert tone="warning">{f.notice}</Alert>}

      {f.step === "start" && (
        <EmptyState
          icon={<CalendarIcon />}
          title="ابتدا سالن یا آرایشگر را انتخاب کنید"
          description="از صفحه سالن یا آرایشگر دلخواه، روی «رزرو نوبت» یا یکی از خدمات بزنید."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/salons" className={buttonVariants({ size: "sm" })}>جستجوی سالن‌ها</Link>
              <Link href="/stylists" className={buttonVariants({ size: "sm", variant: "outline" })}>جستجوی آرایشگران</Link>
            </div>
          }
        />
      )}

      {f.step !== "start" && <Summary f={f} />}

      {f.step === "service" && f.services.length > 0 && (
        <section className="space-y-3" aria-labelledby="s-title">
          <h2 id="s-title" className="font-bold">خدمت مورد نظر را انتخاب کنید</h2>
          <ul className="space-y-2">
            {f.services.map((s) => (
              <li key={s.serviceId}>
                <Link href={bookHref({ ...base, salon: params.salon ?? s.salonSlug, service: s.serviceId })} className={choiceClass}>
                  <span className="space-y-1">
                    <span className="block font-semibold">{s.serviceName}</span>
                    <span className="block text-xs text-muted">
                      {s.categoryLabel ? `${s.categoryLabel} · ` : ""}
                      {s.minDuration === s.maxDuration ? `${toPersianDigits(s.minDuration)} دقیقه` : `${toPersianDigits(s.minDuration)} تا ${toPersianDigits(s.maxDuration)} دقیقه`}
                      {!params.salon && s.salonName ? ` · ${s.salonName}` : !params.salon && !s.salonName ? " · نوبت مستقل" : ""}
                      {s.stylistCount > 1 ? ` · ${toPersianDigits(s.stylistCount)} آرایشگر` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium">{s.minPrice === s.maxPrice ? formatToman(s.minPrice) : `از ${formatToman(s.minPrice)}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {f.step === "stylist" && (
        <section className="space-y-3" aria-labelledby="st-title">
          <h2 id="st-title" className="font-bold">آرایشگر را انتخاب کنید</h2>
          <ul className="space-y-2">
            {f.stylistChoices.map((o) => (
              <li key={o.stylistId}>
                <Link href={bookHref({ salon: params.salon ?? o.salonSlug, stylist: o.stylistSlug, service: o.serviceId })} className={choiceClass}>
                  <span className="flex items-center gap-3">
                    <Avatar name={o.stylistName} className="size-10" />
                    <span>
                      <span className="block font-semibold">{o.stylistName}</span>
                      <span className="block text-xs text-muted">{toPersianDigits(o.durationMinutes)} دقیقه</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium">{formatToman(o.priceToman)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {f.step === "date" && (
        <section className="space-y-3" aria-labelledby="d-title">
          <h2 id="d-title" className="font-bold">روز مراجعه را انتخاب کنید</h2>
          {f.days.some((d) => d.open) ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {f.days.map((d) => (
                <li key={d.key}>
                  {d.open ? (
                    <Link href={bookHref({ ...base, salon: f.salon?.slug ?? params.salon, service: f.ctx?.serviceId, date: d.key })} className="flex flex-col items-center rounded-lg border border-border bg-surface p-3 text-center hover:border-primary-300 hover:bg-primary-50/40">
                      <span className="text-xs text-muted">{WEEKDAYS_FA[d.dow]}</span>
                      <span className="font-semibold">{formatDate(`${d.key}T12:00:00Z`, "UTC", { year: undefined })}</span>
                    </Link>
                  ) : (
                    <span className="flex flex-col items-center rounded-lg border border-dashed border-border p-3 text-center text-muted" aria-disabled="true">
                      <span className="text-xs">{WEEKDAYS_FA[d.dow]}</span>
                      <span>{formatDate(`${d.key}T12:00:00Z`, "UTC", { year: undefined })}</span>
                      <span className="text-[0.7rem]">تعطیل</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<CalendarIcon />} title="ساعات کاری این آرایشگر هنوز ثبت نشده است" description="لطفاً آرایشگر یا سالن دیگری را انتخاب کنید." className="py-8" />
          )}
        </section>
      )}

      {f.step === "time" && f.ctx && f.date && (
        <section className="space-y-3" aria-labelledby="t-title">
          <h2 id="t-title" className="font-bold">ساعت را انتخاب کنید <span className="text-sm font-normal text-muted">(به وقت محلی)</span></h2>
          {f.slots.length > 0 ? (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {f.slots.map((s) => {
                const key = localTimeKey(s, f.ctx!.timezone);
                return (
                  <li key={s.toISOString()}>
                    <Link href={bookHref({ ...base, salon: f.salon?.slug ?? params.salon, service: f.ctx!.serviceId, date: f.date, time: key })} className="block rounded-md border border-border bg-surface py-2 text-center text-sm font-medium hover:border-primary-300 hover:bg-primary-50">
                      {formatTime(s, f.ctx!.timezone)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<ClockIcon />}
              title="در این روز زمان آزادی نمانده است"
              description="روز دیگری را امتحان کنید."
              action={<Link href={bookHref({ ...base, salon: f.salon?.slug ?? params.salon, service: f.ctx.serviceId })} className={buttonVariants({ size: "sm" })}>انتخاب روز دیگر</Link>}
              className="py-8"
            />
          )}
        </section>
      )}

      {f.step === "confirm" && f.ctx && f.startsAt && (
        <section className="space-y-4" aria-labelledby="c-title">
          <h2 id="c-title" className="font-bold">تأیید و ثبت نوبت</h2>
          <p className="text-sm leading-7 text-muted">
            نوبت شما برای {formatWeekdayDate(f.startsAt, f.ctx.timezone)} ساعت {formatTime(f.startsAt, f.ctx.timezone)}
            {f.ctx.salonAddress ? ` در ${f.ctx.salonName} (${f.ctx.salonAddress})` : " (نوبت مستقل)"} ثبت می‌شود و پس از تأیید آرایشگر یا سالن قطعی است.
          </p>
          {session ? (
            <BookingConfirmForm
              stylistId={f.ctx.stylistId}
              serviceId={f.ctx.serviceId}
              date={f.date!}
              time={f.time!}
              changeHref={bookHref({ ...base, salon: f.salon?.slug ?? params.salon, service: f.ctx.serviceId, date: f.date })}
            />
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-surface p-5 text-center">
              <p className="text-sm">برای ثبت نوبت وارد حساب خود شوید؛ پس از ورود به همین مرحله برمی‌گردید.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link href={`/login?next=${encodeURIComponent(bookHref({ ...base, salon: f.salon?.slug ?? params.salon, service: f.ctx.serviceId, date: f.date, time: f.time }))}`} className={buttonVariants({})}>
                  ورود و ادامه رزرو
                </Link>
                <Link href="/register" className={buttonVariants({ variant: "outline" })}>ثبت‌نام</Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
