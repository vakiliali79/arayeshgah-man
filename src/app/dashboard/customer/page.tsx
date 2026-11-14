import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, HeartIcon, StarIcon } from "@/components/icons";
import { buttonVariants, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { db } from "@/db";
import { BookingCard } from "@/features/dashboard/components/booking-card";
import { WelcomeBanner } from "@/features/dashboard/components/welcome-banner";
import { requireSession } from "@/server/auth/current";
import { getCustomerOverview } from "@/server/customer/queries";

export const metadata: Metadata = { title: "حساب من" };

export default async function CustomerHome({ searchParams }: PageProps<"/dashboard/customer">) {
  const { actor, profile, user } = await requireSession();
  const { welcome } = await searchParams;
  const o = await getCustomerOverview(db, actor);

  return (
    <>
      <WelcomeBanner welcome={welcome} />
      <PageHeader
        title={`سلام، ${profile.fullName ?? user.name}`}
        description="خلاصه نوبت‌ها و فعالیت‌های شما"
        actions={<Link href="/salons" className={buttonVariants({ size: "sm" })}>رزرو نوبت جدید</Link>}
      />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="نوبت‌های پیش‌رو" value={o.counts.upcoming} icon={<CalendarIcon size={18} />} />
        <StatCard label="نوبت‌های انجام‌شده" value={o.counts.past} />
        <StatCard label="علاقه‌مندی‌ها" value={o.favorites} icon={<HeartIcon size={18} />} />
        <StatCard label="نظرات ثبت‌شده" value={o.reviews} icon={<StarIcon size={18} />} />
      </div>

      <section className="space-y-3">
        <h2 className="font-bold">نوبت بعدی شما</h2>
        {o.next ? (
          <BookingCard b={o.next} href={`/dashboard/customer/bookings/${o.next.id}`} />
        ) : (
          <EmptyState
            icon={<CalendarIcon />}
            title="نوبت پیش‌رویی ندارید"
            description="سالن یا آرایشگر دلخواهتان را پیدا کنید و در چند قدم نوبت بگیرید."
            action={<Link href="/salons" className={buttonVariants({ size: "sm" })}>جستجوی سالن‌ها</Link>}
          />
        )}
      </section>

      {o.awaitingReview > 0 && (
        <section className="mt-8 rounded-lg border border-gold-200 bg-gold-50 p-4 text-sm">
          <p className="font-semibold text-gold-600">{o.awaitingReview.toLocaleString("fa-IR")} نوبت انجام‌شده منتظر نظر شماست.</p>
          <Link href="/dashboard/customer/bookings?tab=past" className="mt-2 inline-block font-medium text-primary-700 hover:underline">
            ثبت نظر و امتیاز
          </Link>
        </section>
      )}
    </>
  );
}
