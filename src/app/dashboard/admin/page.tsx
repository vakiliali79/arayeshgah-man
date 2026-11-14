import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Input, PageHeader, StatCard } from "@/components/ui";
import { db } from "@/db";
import type { BookingStatus } from "@/db/types";
import { LabeledBars, TimeBarChart, type ChartPoint } from "@/features/dashboard/components/admin-charts";
import { WelcomeBanner } from "@/features/dashboard/components/welcome-banner";
import { formatDate } from "@/lib/format/datetime";
import { BOOKING_STATUS_LABEL } from "@/lib/format/labels";
import { cn, toPersianDigits } from "@/lib/utils";
import { getAdminDashboard, parseRange, RANGE_PRESETS, type SeriesPoint } from "@/server/admin/stats";
import { requireSession } from "@/server/auth/current";
import { currentTime } from "@/server/time";

export const metadata: Metadata = { title: "مدیریت کل" };

const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions) => formatDate(`${key}T12:00:00Z`, "UTC", opts);

export default async function AdminHome({ searchParams }: PageProps<"/dashboard/admin">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const range = parseRange(sp, currentTime());
  const { totals: t, series, byStatus } = await getAdminDashboard(db, actor, range, currentTime());
  const week = range.unit === "week";
  const points = (k: keyof Omit<SeriesPoint, "bucket">): ChartPoint[] =>
    series.map((p) => ({
      label: week ? `هفته از ${dayLabel(p.bucket, { year: "numeric" })}` : dayLabel(p.bucket, { weekday: "short" }),
      short: dayLabel(p.bucket, { year: undefined, month: "numeric" }),
      value: p[k],
    }));
  const rangeText = `${dayLabel(range.from, {})} تا ${dayLabel(range.to, {})}`;

  return (
    <>
      <WelcomeBanner welcome={typeof sp.welcome === "string" ? sp.welcome : undefined} />
      <PageHeader title="مدیریت کل پلتفرم" description="همه اعداد مستقیماً از دیتابیس خوانده می‌شوند." />

      {(t.salons_pending > 0 || t.tickets_open > 0 || t.reports_open > 0) && (
        <Alert tone="warning" className="mb-6">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {t.salons_pending > 0 && <Link href="/dashboard/admin/salons?status=pending" className="font-semibold underline">{toPersianDigits(t.salons_pending)} سالن منتظر تأیید</Link>}
            {t.tickets_open > 0 && <Link href="/dashboard/admin/tickets?status=open" className="font-semibold underline">{toPersianDigits(t.tickets_open)} درخواست پشتیبانی باز</Link>}
            {t.reports_open > 0 && <Link href="/dashboard/admin/reviews?view=reported" className="font-semibold underline">{toPersianDigits(t.reports_open)} گزارش نظر بررسی‌نشده</Link>}
          </span>
        </Alert>
      )}

      <h2 className="mb-3 font-bold">وضعیت کلی</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="کل کاربران" value={t.users} hint={t.suspended ? `${toPersianDigits(t.suspended)} حساب تعلیق‌شده` : undefined} />
        <StatCard label="مشتریان" value={t.customers} />
        <StatCard label="آرایشگران" value={t.stylists} hint={`${toPersianDigits(t.stylist_profiles)} پروفایل حرفه‌ای`} />
        <StatCard label="سالن‌داران" value={t.salon_owners} />
        <StatCard label="سالن‌های ثبت‌شده" value={t.salons} hint={t.salons_inactive ? `${toPersianDigits(t.salons_inactive)} غیرفعال` : undefined} />
        <StatCard label="سالن‌های تأییدشده" value={t.salons_verified} />
        <StatCard label="در انتظار تأیید" value={t.salons_pending} hint={t.salons_rejected ? `${toPersianDigits(t.salons_rejected)} ردشده` : undefined} />
        <StatCard label="کل نوبت‌ها" value={t.bookings} hint={t.bookings_pending ? `${toPersianDigits(t.bookings_pending)} در انتظار تأیید` : undefined} />
        <StatCard label="نوبت‌های امروز" value={t.bookings_today} hint="بدون لغوشده و ردشده" />
        <StatCard label="نوبت‌های انجام‌شده" value={t.bookings_completed} />
        <StatCard label="نوبت‌های لغوشده" value={t.bookings_cancelled} />
        <StatCard label="خدمات" value={t.services} hint={`${toPersianDigits(t.services_active)} فعال`} />
        <StatCard label="درخواست‌های پشتیبانی" value={t.tickets} hint={`${toPersianDigits(t.tickets_open)} باز`} />
      </div>

      <section aria-labelledby="reports-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="reports-title" className="font-bold">گزارش بازه زمانی</h2>
            <p className="text-xs text-muted">{rangeText} · {week ? "تفکیک هفتگی (از شنبه)" : "تفکیک روزانه"}</p>
          </div>
          <form className="flex flex-wrap items-end gap-2" aria-label="بازه گزارش">
            <nav className="flex flex-wrap gap-1" aria-label="بازه‌های آماده">
              {Object.entries(RANGE_PRESETS).map(([k, label]) => (
                <Link key={k} href={`?range=${k}`} aria-current={range.preset === k ? "true" : undefined} className={cn("rounded-md border px-3 py-2 text-xs", range.preset === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-surface-muted")}>
                  {label}
                </Link>
              ))}
            </nav>
            <label className="flex flex-col text-xs text-muted">از (میلادی)<Input type="date" name="from" defaultValue={range.from} dir="ltr" className="h-9 w-36 text-xs" /></label>
            <label className="flex flex-col text-xs text-muted">تا<Input type="date" name="to" defaultValue={range.to} dir="ltr" className="h-9 w-36 text-xs" /></label>
            <button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs text-primary-foreground">نمایش</button>
          </form>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TimeBarChart title="رشد کاربران (ثبت‌نام جدید)" unit="کاربر" points={points("users")} />
          <TimeBarChart title="ثبت سالن‌های جدید" unit="سالن" points={points("salons")} />
          <TimeBarChart title="نوبت‌های ثبت‌شده" unit="نوبت" points={points("bookings")} />
          <TimeBarChart title="کاربران فعال (رزرو، نظر یا درخواست)" unit="کاربر" points={points("active")} />
          <LabeledBars title="تفکیک نوبت‌های ثبت‌شده بر اساس وضعیت" rows={byStatus.map((b) => ({ label: BOOKING_STATUS_LABEL[b.status as BookingStatus] ?? b.status, value: b.n }))} />
        </div>
        <p className="mt-3 text-xs leading-6 text-muted">
          «کاربران فعال» = کاربرانی که در آن روز/هفته نوبت ثبت کرده‌اند، نظر نوشته‌اند یا درخواست پشتیبانی فرستاده‌اند (مجموع بازه برای این نمودار جمع سطل‌هاست و یک کاربر ممکن است در چند سطل شمرده شود).
        </p>
      </section>
    </>
  );
}
