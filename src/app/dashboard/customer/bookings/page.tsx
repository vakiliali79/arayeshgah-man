import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon } from "@/components/icons";
import { buttonVariants, EmptyState, PageHeader, TabLinks } from "@/components/ui";
import { db } from "@/db";
import { BookingCard } from "@/features/dashboard/components/booking-card";
import { requireSession } from "@/server/auth/current";
import { countCustomerBookings, listCustomerBookings, type CustomerBookingTab } from "@/server/customer/queries";

export const metadata: Metadata = { title: "نوبت‌های من" };

const TABS: { key: CustomerBookingTab; label: string; empty: string }[] = [
  { key: "upcoming", label: "پیش‌رو", empty: "نوبت پیش‌رویی ندارید." },
  { key: "past", label: "انجام‌شده و گذشته", empty: "هنوز نوبتی انجام نشده است." },
  { key: "cancelled", label: "لغو یا ردشده", empty: "نوبت لغوشده‌ای ندارید." },
];

export default async function CustomerBookingsPage({ searchParams }: PageProps<"/dashboard/customer/bookings">) {
  const { actor } = await requireSession();
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.key === raw)?.key ?? "upcoming";
  const [rows, counts] = await Promise.all([listCustomerBookings(db, actor, tab), countCustomerBookings(db, actor)]);

  return (
    <>
      <PageHeader title="نوبت‌های من" actions={<Link href="/salons" className={buttonVariants({ size: "sm" })}>رزرو نوبت جدید</Link>} />
      <TabLinks active={tab} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `?tab=${t.key}`, count: counts[t.key] }))} />
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarIcon />} title={TABS.find((t) => t.key === tab)!.empty} />
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <BookingCard key={b.id} b={b} href={`/dashboard/customer/bookings/${b.id}`} />
          ))}
        </div>
      )}
    </>
  );
}
