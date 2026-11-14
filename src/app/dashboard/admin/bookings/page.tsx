import type { Metadata } from "next";
import { CalendarIcon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { BookingCard } from "@/features/dashboard/components/booking-card";
import { FilterBar } from "@/features/dashboard/components/filter-bar";
import { BOOKING_STATUS_LABEL } from "@/lib/format/labels";
import { listAllBookings } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";
import type { BookingStatus } from "@/db/types";

export const metadata: Metadata = { title: "نوبت‌های سیستم" };

export default async function AdminBookings({ searchParams }: PageProps<"/dashboard/admin/bookings">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const rows = await listAllBookings(db, actor, { q, status });
  return (
    <>
      <PageHeader title="نوبت‌های کل سیستم" />
      <FilterBar q={q} qPlaceholder="کد پیگیری (مثل AM-…)" selects={[{ name: "status", value: status, options: [{ value: "", label: "همه وضعیت‌ها" }, ...Object.entries(BOOKING_STATUS_LABEL).map(([value, label]) => ({ value, label }))] }]} />
      {rows.length === 0 ? <EmptyState icon={<CalendarIcon />} title="نوبتی پیدا نشد" /> : (
        <div className="space-y-3">{rows.map((b) => <BookingCard key={b.id} b={{ ...b, status: b.status as BookingStatus }} />)}</div>
      )}
    </>
  );
}
