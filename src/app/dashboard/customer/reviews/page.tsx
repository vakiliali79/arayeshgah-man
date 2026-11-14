import type { Metadata } from "next";
import Link from "next/link";
import { StarIcon } from "@/components/icons";
import { Badge, EmptyState, PageHeader, Rating } from "@/components/ui";
import { db } from "@/db";
import { formatDate } from "@/lib/format/datetime";
import { requireSession } from "@/server/auth/current";
import { listCustomerReviews } from "@/server/customer/queries";

export const metadata: Metadata = { title: "نظرات من" };

export default async function CustomerReviewsPage() {
  const { actor } = await requireSession();
  const rows = await listCustomerReviews(db, actor);
  return (
    <>
      <PageHeader title="نظرات من" description="نظر و امتیازهایی که برای نوبت‌های انجام‌شده ثبت کرده‌اید" />
      {rows.length === 0 ? (
        <EmptyState icon={<StarIcon />} title="هنوز نظری ثبت نکرده‌اید" description="پس از انجام هر نوبت، از صفحه جزئیات آن می‌توانید نظر و امتیاز ثبت کنید." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/dashboard/customer/bookings/${r.bookingId}`} className="font-bold hover:text-primary-700">{r.serviceName}</Link>
                <div className="flex items-center gap-2">
                  {r.isHidden && <Badge tone="neutral">پنهان‌شده توسط مدیریت</Badge>}
                  <Rating value={r.rating} />
                </div>
              </div>
              <p className="mt-1 text-xs text-muted">{r.stylistName}{r.salonName ? ` · ${r.salonName}` : ""} · {formatDate(r.createdAt)}</p>
              {r.comment && <p className="mt-2 text-sm leading-7">{r.comment}</p>}
              {r.reply && <p className="mt-2 rounded-md bg-surface-muted p-3 text-sm leading-7"><span className="font-semibold">پاسخ: </span>{r.reply}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
