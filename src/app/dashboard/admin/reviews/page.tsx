import type { Metadata } from "next";
import Link from "next/link";
import { StarIcon } from "@/components/icons";
import { Badge, EmptyState, PageHeader, Rating, TabLinks } from "@/components/ui";
import { db } from "@/db";
import { moderateReviewAction } from "@/features/dashboard/actions/admin";
import { QuickAction, ReasonAction } from "@/features/dashboard/components/admin-ui";
import { FilterBar, param } from "@/features/dashboard/components/filter-bar";
import { formatDate } from "@/lib/format/datetime";
import { toPersianDigits } from "@/lib/utils";
import { listOpenReports, listReviewsAdmin } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "مدیریت نظرات" };
const TABS = [{ key: "reported", label: "گزارش‌شده" }, { key: "hidden", label: "مخفی‌شده" }, { key: "all", label: "همه" }] as const;

export default async function AdminReviews({ searchParams }: PageProps<"/dashboard/admin/reviews">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const view = TABS.find((t) => t.key === param(sp, "view"))?.key ?? "reported";
  const rating = param(sp, "rating");
  const rows = await listReviewsAdmin(db, actor, { view, rating });
  const reports = await listOpenReports(db, actor, rows.filter((r) => r.reports > 0).map((r) => r.id));
  return (
    <>
      <PageHeader title="نظرات و گزارش‌ها" description="مخفی‌سازی با ثبت دلیل انجام می‌شود؛ امتیاز سالن و آرایشگر دوباره محاسبه و اقدام در تاریخچه ثبت می‌شود." />
      <TabLinks active={view} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `?view=${t.key}${rating ? `&rating=${rating}` : ""}` }))} />
      <FilterBar
        selects={[{ name: "rating", label: "امتیاز", value: rating, options: [{ value: "", label: "همه امتیازها" }, ...[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${toPersianDigits(r)} ستاره` }))] }]}
        hidden={{ view }}
      />
      {rows.length === 0 ? <EmptyState icon={<StarIcon />} title="نظری در این دسته نیست" /> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const mine = reports.filter((x) => x.reviewId === r.id);
            return (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-bold">{r.customerName} <Rating value={r.rating} /></p>
                  <span className="flex items-center gap-2">
                    {r.reports > 0 && <Badge tone="gold">{toPersianDigits(r.reports)} گزارش باز</Badge>}
                    {r.isHidden && <Badge tone="neutral">مخفی</Badge>}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  <Link href={`/dashboard/admin/stylists/${r.stylistId}`} className="hover:underline">{r.stylistName}</Link>
                  {r.salonName && r.salonId ? <> · <Link href={`/dashboard/admin/salons/${r.salonId}`} className="hover:underline">{r.salonName}</Link></> : null} · {formatDate(r.createdAt)} ·{" "}
                  <Link href={`/dashboard/admin/bookings/${r.bookingId}`} className="hover:underline">نوبت مرتبط</Link>
                </p>
                {r.comment && <p className="mt-2 text-sm leading-7">{r.comment}</p>}
                {r.reply && <p className="mt-2 rounded-md bg-surface-muted px-3 py-2 text-sm"><span className="font-semibold">پاسخ: </span>{r.reply}</p>}
                {r.isHidden && r.hiddenReason && <p className="mt-2 text-xs text-muted">دلیل مخفی‌سازی: {r.hiddenReason}</p>}
                {mine.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-md border border-gold-200 bg-gold-50 p-3 text-xs">
                    {mine.map((x) => <li key={x.id}><span className="font-semibold">{x.name}</span> ({formatDate(x.createdAt)}): {x.message}</li>)}
                  </ul>
                )}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
                  {r.isHidden ? (
                    <QuickAction action={moderateReviewAction} fields={{ reviewId: r.id, decision: "show" }} label="نمایش دوباره" confirmText="این نظر دوباره نمایش داده شود؟" />
                  ) : (
                    <ReasonAction id={`hide-${r.id}`} action={moderateReviewAction} fields={{ reviewId: r.id, decision: "hide" }} summary="مخفی کردن" submitLabel="مخفی کن" variant="danger" />
                  )}
                  {r.reports > 0 && !r.isHidden && (
                    <ReasonAction id={`dismiss-${r.id}`} action={moderateReviewAction} fields={{ reviewId: r.id, decision: "dismiss_reports" }} summary="رد گزارش‌ها (نظر بماند)" submitLabel="رد گزارش‌ها" variant="outline" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
