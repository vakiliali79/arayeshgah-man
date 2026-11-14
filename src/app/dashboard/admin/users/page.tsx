import type { Metadata } from "next";
import Link from "next/link";
import { UsersIcon } from "@/components/icons";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { ROLE_META, USER_ROLES } from "@/config/roles";
import { db } from "@/db";
import { AccountStatusBadge } from "@/features/dashboard/components/admin-ui";
import { FilterBar, param } from "@/features/dashboard/components/filter-bar";
import { Pagination } from "@/features/public/components/search-filters";
import { formatDate, formatDateTime } from "@/lib/format/datetime";
import { toPersianDigits } from "@/lib/utils";
import { listUsers, USERS_PAGE_SIZE } from "@/server/admin/users";
import { requireSession } from "@/server/auth/current";
import { formatPhoneForDisplay } from "@/server/otp/phone";
import { SUPER_ADMIN_PHONE } from "@/server/profiles/service";

export const metadata: Metadata = { title: "مدیریت کاربران" };

export default async function AdminUsers({ searchParams }: PageProps<"/dashboard/admin/users">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const f = { q: param(sp, "q"), role: param(sp, "role"), status: param(sp, "status"), from: param(sp, "from"), to: param(sp, "to") };
  const page = Math.max(1, Number(param(sp, "page")) || 1);
  const { rows, total } = await listUsers(db, actor, { ...f, page });
  return (
    <>
      <PageHeader title="کاربران" description={`${toPersianDigits(total)} کاربر — جستجو با نام یا موبایل، فیلتر نقش، وضعیت و تاریخ ثبت‌نام`} />
      <FilterBar
        q={f.q}
        qPlaceholder="نام یا شماره موبایل"
        selects={[
          { name: "role", label: "نقش", value: f.role, options: [{ value: "", label: "همه نقش‌ها" }, ...USER_ROLES.map((r) => ({ value: r, label: ROLE_META[r].label }))] },
          { name: "status", label: "وضعیت حساب", value: f.status, options: [{ value: "", label: "همه وضعیت‌ها" }, { value: "active", label: "فعال" }, { value: "suspended", label: "تعلیق‌شده" }] },
        ]}
        dates={{ from: f.from, to: f.to }}
        dateLabel="ثبت‌نام"
        resetHref="/dashboard/admin/users"
      />
      {rows.length === 0 ? <EmptyState icon={<UsersIcon />} title="کاربری پیدا نشد" description="فیلترها را تغییر دهید." /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((u) => (
            <li key={u.id}>
              <Link href={`/dashboard/admin/users/${u.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted/60">
                <div className="min-w-0">
                  <p className="font-medium">
                    {u.name} {u.phone === SUPER_ADMIN_PHONE && <Badge tone="gold">مدیر کل اصلی</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    <span dir="ltr">{u.phone ? formatPhoneForDisplay(u.phone) : "—"}</span> · عضویت {formatDate(u.createdAt)}
                    {u.lastActivity ? ` · آخرین فعالیت ${formatDateTime(u.lastActivity)}` : ""}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <Badge tone="primary">{ROLE_META[u.role].label}</Badge>
                  <AccountStatusBadge status={u.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination total={total} page={page} pageSize={USERS_PAGE_SIZE} basePath="/dashboard/admin/users" params={sp} />
    </>
  );
}
