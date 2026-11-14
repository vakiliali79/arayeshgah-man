import type { Metadata } from "next";
import { StarIcon } from "@/components/icons";
import { Badge, EmptyState, PageHeader, Rating, TabLinks } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { reviewHiddenAction } from "@/features/dashboard/actions/admin";
import { formatDate } from "@/lib/format/datetime";
import { toPersianDigits } from "@/lib/utils";
import { listReviewsAdmin } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "مدیریت نظرات" };
const TABS = [{ key: "reported", label: "گزارش‌شده" }, { key: "hidden", label: "پنهان‌شده" }, { key: "all", label: "همه" }];

export default async function AdminReviews({ searchParams }: PageProps<"/dashboard/admin/reviews">) {
  const { actor } = await requireSession(["admin"]);
  const { view: raw } = await searchParams;
  const view = TABS.find((t) => t.key === raw)?.key ?? "reported";
  const rows = await listReviewsAdmin(db, actor, { view });
  return (
    <>
      <PageHeader title="نظرات" description="نظرات نامناسب را پنهان کنید؛ امتیاز سالن و آرایشگر دوباره محاسبه می‌شود." />
      <TabLinks active={view} tabs={TABS.map((t) => ({ ...t, href: `?view=${t.key}` }))} />
      {rows.length === 0 ? <EmptyState icon={<StarIcon />} title="نظری در این دسته نیست" /> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{r.customerName} <Rating value={r.rating} /></p>
                <div className="flex items-center gap-2">
                  {r.reports > 0 && <Badge tone="gold">{toPersianDigits(r.reports)} گزارش</Badge>}
                  {r.isHidden && <Badge tone="neutral">پنهان</Badge>}
                  <ActionForm action={reviewHiddenAction} submitLabel={r.isHidden ? "نمایش دوباره" : "پنهان کردن"} submitVariant={r.isHidden ? "outline" : "danger"} submitSize="sm" inline hideMessage>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <input type="hidden" name="hidden" value={String(!r.isHidden)} />
                  </ActionForm>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted">{r.stylistName}{r.salonName ? ` · ${r.salonName}` : ""} · {formatDate(r.createdAt)}</p>
              {r.comment && <p className="mt-2 text-sm leading-7">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
