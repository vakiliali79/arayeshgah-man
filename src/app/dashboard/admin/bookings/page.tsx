import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon } from "@/components/icons";
import { BookingStatusBadge, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { bookingStatus } from "@/db/schema";
import { FilterBar, param } from "@/features/dashboard/components/filter-bar";
import { Pagination } from "@/features/public/components/search-filters";
import { formatDateTime } from "@/lib/format/datetime";
import { BOOKING_STATUS_LABEL } from "@/lib/format/labels";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { BOOKINGS_PAGE_SIZE, listAllBookings } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "مدیریت نوبت‌ها" };

export default async function AdminBookings({ searchParams }: PageProps<"/dashboard/admin/bookings">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const f = {
    q: param(sp, "q"), status: param(sp, "status"), from: param(sp, "from"), to: param(sp, "to"),
    salonId: param(sp, "salonId"), stylistId: param(sp, "stylistId"), customerId: param(sp, "customerId"),
  };
  const page = Math.max(1, Number(param(sp, "page")) || 1);
  const { rows, total } = await listAllBookings(db, actor, { ...f, page });
  const scoped = f.salonId || f.stylistId || f.customerId;
  return (
    <>
      <PageHeader title="نوبت‌ها" description={`${toPersianDigits(total)} نوبت — جستجو با کد پیگیری یا نام/موبایل مشتری`} />
      {scoped && (
        <p className="mb-3 text-sm">
          فیلتر روی {f.salonId ? "یک سالن" : f.stylistId ? "یک آرایشگر" : "یک مشتری"} فعال است. <Link href="/dashboard/admin/bookings" className="text-primary-700 hover:underline">نمایش همه</Link>
        </p>
      )}
      <FilterBar
        q={f.q}
        qPlaceholder="کد پیگیری (AM-…)، نام یا موبایل مشتری"
        selects={[{ name: "status", label: "وضعیت", value: f.status, options: [{ value: "", label: "همه وضعیت‌ها" }, ...bookingStatus.enumValues.map((s) => ({ value: s, label: BOOKING_STATUS_LABEL[s] }))] }]}
        dates={{ from: f.from, to: f.to }}
        dateLabel="تاریخ نوبت"
        hidden={{ salonId: f.salonId, stylistId: f.stylistId, customerId: f.customerId }}
        resetHref="/dashboard/admin/bookings"
      />
      {rows.length === 0 ? <EmptyState icon={<CalendarIcon />} title="نوبتی پیدا نشد" /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((b) => (
            <li key={b.id}>
              <Link href={`/dashboard/admin/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-muted/60">
                <div className="min-w-0">
                  <p className="font-medium">{b.serviceName} — {formatDateTime(b.startsAt, b.timezone)}</p>
                  <p className="text-xs text-muted">
                    مشتری: {b.customerName} · آرایشگر: {b.stylistName}{b.salonName ? ` · ${b.salonName}` : " · مستقل"} · {formatToman(b.priceToman)} · <span dir="ltr">{b.trackingCode}</span>
                  </p>
                </div>
                <BookingStatusBadge status={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination total={total} page={page} pageSize={BOOKINGS_PAGE_SIZE} basePath="/dashboard/admin/bookings" params={sp} />
    </>
  );
}
