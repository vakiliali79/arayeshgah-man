import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { categoryAction } from "@/features/dashboard/actions/admin";
import { toPersianDigits } from "@/lib/utils";
import { listCategoriesAdmin } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "دسته‌بندی خدمات" };

export default async function AdminCategories() {
  const { actor } = await requireSession(["admin"]);
  const rows = await listCategoriesAdmin(db, actor);
  return (
    <>
      <PageHeader title="دسته‌بندی خدمات" description="دسته‌بندی‌ها در فرم خدمات سالن‌ها و آرایشگران، فیلتر جستجو و صفحه اصلی استفاده می‌شوند." />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>افزودن دسته‌بندی</CardTitle>
          <CardDescription>کلید لاتین یکتا است و بعداً تغییر نمی‌کند (مثلاً <span dir="ltr">hair_treatment</span>). دسته‌بندی در حال استفاده حذف نمی‌شود؛ می‌توانید غیرفعالش کنید.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={categoryAction} submitLabel="افزودن" resetOnSuccess className="grid items-end gap-3 sm:grid-cols-[10rem_1fr_6rem_auto_auto] sm:space-y-0">
            <input type="hidden" name="mode" value="create" />
            <label className="space-y-1 text-sm"><span className="text-muted">کلید (لاتین)</span><Input name="key" required dir="ltr" pattern="[a-z][a-z0-9_]{1,31}" maxLength={32} placeholder="hair_treatment" /></label>
            <label className="space-y-1 text-sm"><span className="text-muted">نام نمایشی</span><Input name="label" required minLength={2} maxLength={60} /></label>
            <label className="space-y-1 text-sm"><span className="text-muted">ترتیب</span><Input name="sortOrder" type="number" dir="ltr" min={0} max={999} defaultValue={rows.length + 1} /></label>
            <Checkbox name="isActive" defaultChecked label="فعال" className="pb-3" />
          </ActionForm>
        </CardContent>
      </Card>
      <ul className="space-y-3">
        {rows.map((c) => (
          <li key={c.key} className="rounded-lg border border-border bg-surface p-4">
            <ActionForm action={categoryAction} submitLabel="ذخیره" submitSize="sm" className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_auto_auto] sm:space-y-0">
              <input type="hidden" name="key" value={c.key} />
              <label className="space-y-1 text-sm"><span className="text-muted">نام نمایشی <span dir="ltr">({c.key})</span></span><Input name="label" defaultValue={c.label} required maxLength={60} /></label>
              <label className="space-y-1 text-sm"><span className="text-muted">ترتیب</span><Input name="sortOrder" type="number" dir="ltr" min={0} max={999} defaultValue={c.sortOrder} /></label>
              <Checkbox name="isActive" defaultChecked={c.isActive} label="فعال" className="pb-3" />
            </ActionForm>
            <p className="mt-2 text-xs text-muted">
              {toPersianDigits(c.services)} خدمت ({toPersianDigits(c.activeServices)} فعال) · {toPersianDigits(c.salons)} سالن · {toPersianDigits(c.stylists)} آرایشگر ·{" "}
              <Link href={`/salons?category=${c.key}`} className="text-primary-700 hover:underline">نمایش در جستجو</Link>
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
