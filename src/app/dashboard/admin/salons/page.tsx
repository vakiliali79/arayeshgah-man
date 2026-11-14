import type { Metadata } from "next";
import Link from "next/link";
import { StoreIcon } from "@/components/icons";
import { EmptyState, PageHeader, TabLinks } from "@/components/ui";
import { db } from "@/db";
import { SalonAdminBadge } from "@/features/dashboard/components/admin-ui";
import { FilterBar, param } from "@/features/dashboard/components/filter-bar";
import { formatDate } from "@/lib/format/datetime";
import { toPersianDigits } from "@/lib/utils";
import { listSalonsAdmin, salonStatusCounts } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";
import { formatPhoneForDisplay } from "@/server/otp/phone";

export const metadata: Metadata = { title: "مدیریت سالن‌ها" };
const TABS = [
  { key: "pending", label: "در انتظار تأیید" },
  { key: "verified", label: "تأییدشده" },
  { key: "rejected", label: "ردشده" },
  { key: "inactive", label: "غیرفعال" },
  { key: "all", label: "همه" },
] as const;

export default async function AdminSalons({ searchParams }: PageProps<"/dashboard/admin/salons">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const status = TABS.find((t) => t.key === param(sp, "status"))?.key ?? "pending";
  const q = param(sp, "q");
  const city = param(sp, "city");
  const [rows, counts] = await Promise.all([listSalonsAdmin(db, actor, { status, q, city }), salonStatusCounts(db, actor)]);
  const qs = (k: string) => `?status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}${city ? `&city=${encodeURIComponent(city)}` : ""}`;
  return (
    <>
      <PageHeader title="سالن‌ها" description="سالن‌ها فقط پس از تأیید در جستجوی عمومی دیده می‌شوند. برای بررسی، اقدام و تاریخچه، سالن را باز کنید." />
      <TabLinks active={status} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: qs(t.key), count: counts[t.key] }))} />
      <FilterBar q={q} qPlaceholder="نام سالن، نشانی صفحه، نام یا موبایل مالک" selects={[]} hidden={{ status }} resetHref={`?status=${status}`} />
      {rows.length === 0 ? <EmptyState icon={<StoreIcon />} title="سالنی در این دسته نیست" /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((s) => (
            <li key={s.id}>
              <Link href={`/dashboard/admin/salons/${s.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted/60">
                <div className="min-w-0">
                  <p className="font-bold">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.city}{s.district ? `، ${s.district}` : ""} · مالک: {s.ownerName} <span dir="ltr">({s.ownerPhone ? formatPhoneForDisplay(s.ownerPhone) : "—"})</span> · ثبت {formatDate(s.createdAt)}
                  </p>
                  {s.rejectionReason && !s.isVerified && <p className="mt-1 text-xs text-danger">دلیل رد: {s.rejectionReason}</p>}
                </div>
                <SalonAdminBadge isActive={s.isActive} isVerified={s.isVerified} rejectionReason={s.rejectionReason} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 200 && <p className="mt-3 text-xs text-muted">{toPersianDigits(200)} نتیجه اول نمایش داده شده است؛ برای یافتن بقیه جستجو کنید.</p>}
    </>
  );
}
