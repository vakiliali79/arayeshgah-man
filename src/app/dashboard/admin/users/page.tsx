import type { Metadata } from "next";
import { UsersIcon } from "@/components/icons";
import { Badge, EmptyState, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ROLE_META, USER_ROLES } from "@/config/roles";
import { db } from "@/db";
import { setUserRoleAction } from "@/features/dashboard/actions/admin";
import { FilterBar } from "@/features/dashboard/components/filter-bar";
import { formatDate } from "@/lib/format/datetime";
import { listUsers } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";
import { formatPhoneForDisplay } from "@/server/otp/phone";
import { SUPER_ADMIN_PHONE } from "@/server/profiles/service";

export const metadata: Metadata = { title: "مدیریت کاربران" };

export default async function AdminUsers({ searchParams }: PageProps<"/dashboard/admin/users">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const role = typeof sp.role === "string" ? sp.role : undefined;
  const rows = await listUsers(db, actor, { q, role });
  return (
    <>
      <PageHeader title="کاربران" description="جستجو با نام یا شماره موبایل؛ تغییر نقش (مدیر کل اصلی قابل تغییر نیست)" />
      <FilterBar q={q} qPlaceholder="نام یا شماره موبایل" selects={[{ name: "role", value: role, options: [{ value: "", label: "همه نقش‌ها" }, ...USER_ROLES.map((r) => ({ value: r, label: ROLE_META[r].label }))] }]} />
      {rows.length === 0 ? <EmptyState icon={<UsersIcon />} title="کاربری پیدا نشد" /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((u) => {
            const isSuper = u.phone === SUPER_ADMIN_PHONE;
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{u.name} {isSuper && <Badge tone="gold">مدیر کل اصلی</Badge>}</p>
                  <p className="text-xs text-muted"><span dir="ltr">{u.phone ? formatPhoneForDisplay(u.phone) : "—"}</span> · عضویت {formatDate(u.createdAt)}</p>
                </div>
                {isSuper || u.id === actor.userId ? (
                  <Badge tone="primary">{ROLE_META[u.role].label}</Badge>
                ) : (
                  <ActionForm action={setUserRoleAction} submitLabel="ثبت" submitSize="sm" inline hideMessage confirmText="نقش این کاربر تغییر کند؟">
                    <input type="hidden" name="userId" value={u.id} />
                    <Select name="role" defaultValue={u.role} aria-label="نقش" className="h-9 w-auto min-w-32 text-sm">
                      {USER_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                    </Select>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
