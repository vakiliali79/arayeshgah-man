import type { Metadata } from "next";
import Link from "next/link";
import { Alert, PageHeader, StatCard } from "@/components/ui";
import { db } from "@/db";
import { WelcomeBanner } from "@/features/dashboard/components/welcome-banner";
import { BOOKING_STATUS_LABEL } from "@/lib/format/labels";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { getPlatformStats } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";
import type { BookingStatus } from "@/db/types";

export const metadata: Metadata = { title: "مدیریت کل" };

export default async function AdminHome({ searchParams }: PageProps<"/dashboard/admin">) {
  const { actor } = await requireSession(["admin"]);
  const { welcome } = await searchParams;
  const s = await getPlatformStats(db, actor);
  const totalBookings = Object.values(s.bookings).reduce((a, b) => a + b, 0);
  return (
    <>
      <WelcomeBanner welcome={welcome} />
      <PageHeader title="مدیریت کل پلتفرم" description="آمار و وضعیت کلی آرایشگاه من" />
      {(s.salons.pending > 0 || s.openTickets > 0) && (
        <Alert tone="warning" className="mb-6">
          {s.salons.pending > 0 && <><Link href="/dashboard/admin/salons?status=pending" className="font-semibold underline">{toPersianDigits(s.salons.pending)} سالن</Link> منتظر تأیید. </>}
          {s.openTickets > 0 && <><Link href="/dashboard/admin/tickets?status=open" className="font-semibold underline">{toPersianDigits(s.openTickets)} پیام</Link> بررسی‌نشده.</>}
        </Alert>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="کل کاربران" value={s.users} />
        <StatCard label="مشتریان" value={s.roles.customer ?? 0} />
        <StatCard label="آرایشگران (پروفایل)" value={s.stylists} hint={`${toPersianDigits(s.roles.stylist ?? 0)} کاربر با نقش آرایشگر`} />
        <StatCard label="سالن‌ها" value={s.salons.total} hint={`${toPersianDigits(s.salons.verified)} تأییدشده · ${toPersianDigits(s.salons.pending)} در انتظار`} />
        <StatCard label="کل نوبت‌ها" value={totalBookings} />
        <StatCard label="درآمد نوبت‌های انجام‌شده" value={formatToman(s.revenue)} />
        <StatCard label="پیام‌های باز" value={s.openTickets} />
        <StatCard label="نظرات گزارش‌شده" value={s.reportedReviews} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 font-bold">نوبت‌ها بر اساس وضعیت</h2>
          {totalBookings === 0 ? <p className="text-sm text-muted">هنوز نوبتی ثبت نشده است.</p> : (
            <ul className="space-y-1.5 text-sm">{Object.entries(s.bookings).map(([k, v]) => <li key={k} className="flex justify-between"><span>{BOOKING_STATUS_LABEL[k as BookingStatus]}</span><span>{toPersianDigits(v)}</span></li>)}</ul>
          )}
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 font-bold">نوبت‌های ثبت‌شده (ماهانه، ۶ ماه اخیر)</h2>
          {s.monthly.length === 0 ? <p className="text-sm text-muted">داده‌ای وجود ندارد.</p> : (
            <ul className="space-y-1.5 text-sm">{s.monthly.map((m) => <li key={m.month} className="flex justify-between"><span dir="ltr">{toPersianDigits(m.month)}</span><span>{toPersianDigits(m.n)}</span></li>)}</ul>
          )}
        </section>
      </div>
    </>
  );
}
