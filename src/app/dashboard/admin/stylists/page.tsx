import type { Metadata } from "next";
import Link from "next/link";
import { ScissorsIcon } from "@/components/icons";
import { Badge, EmptyState, PageHeader, Rating } from "@/components/ui";
import { db } from "@/db";
import { FilterBar, param } from "@/features/dashboard/components/filter-bar";
import { formatDate } from "@/lib/format/datetime";
import { toPersianDigits } from "@/lib/utils";
import { listStylistsAdmin } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";
import { formatPhoneForDisplay } from "@/server/otp/phone";

export const metadata: Metadata = { title: "مدیریت آرایشگران" };

export default async function AdminStylists({ searchParams }: PageProps<"/dashboard/admin/stylists">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const q = param(sp, "q");
  const status = param(sp, "status");
  const rows = await listStylistsAdmin(db, actor, q, { status });
  return (
    <>
      <PageHeader title="آرایشگران" description="آرایشگر غیرفعال در جستجو و رزرو نمایش داده نمی‌شود. برای جزئیات و اقدام، آرایشگر را باز کنید." />
      <FilterBar
        q={q}
        qPlaceholder="نام آرایشگر، نشانی صفحه یا موبایل"
        selects={[{ name: "status", label: "وضعیت", value: status, options: [{ value: "", label: "همه" }, { value: "active", label: "فعال" }, { value: "inactive", label: "غیرفعال" }] }]}
        resetHref="/dashboard/admin/stylists"
      />
      {rows.length === 0 ? <EmptyState icon={<ScissorsIcon />} title="آرایشگری پیدا نشد" /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((s) => (
            <li key={s.id}>
              <Link href={`/dashboard/admin/stylists/${s.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted/60">
                <div className="min-w-0">
                  <p className="font-medium">{s.name} {!s.isActive && <Badge tone="neutral">غیرفعال</Badge>} {s.acceptsIndependent && <Badge tone="gold">مستقل</Badge>}</p>
                  <p className="text-xs text-muted">
                    {s.specialties.slice(0, 3).join("، ") || "بدون تخصص ثبت‌شده"} · {toPersianDigits(s.salonCount)} سالن · <span dir="ltr">{s.phone ? formatPhoneForDisplay(s.phone) : ""}</span> · {formatDate(s.createdAt)}
                  </p>
                </div>
                {s.ratingCount > 0 ? <Rating value={s.ratingAvg} count={s.ratingCount} /> : <span className="text-xs text-muted">بدون نظر</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
