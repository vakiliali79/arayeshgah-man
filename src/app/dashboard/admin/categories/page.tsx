import type { Metadata } from "next";
import { Checkbox, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { categoryAction } from "@/features/dashboard/actions/admin";
import { requireSession } from "@/server/auth/current";
import { listAllCategories } from "@/server/catalog/categories";

export const metadata: Metadata = { title: "دسته‌بندی خدمات" };

export default async function AdminCategories() {
  await requireSession(["admin"]);
  const rows = await listAllCategories(db);
  return (
    <>
      <PageHeader title="دسته‌بندی خدمات" description="نام نمایشی، ترتیب و نمایش هر دسته در فیلترها و فرم‌ها. افزودن دسته کاملاً جدید نیاز به به‌روزرسانی سیستم دارد." />
      <ul className="space-y-3">
        {rows.map((c) => (
          <li key={c.key} className="rounded-lg border border-border bg-surface p-4">
            <ActionForm action={categoryAction} submitLabel="ذخیره" submitSize="sm" className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_auto_auto] sm:space-y-0">
              <input type="hidden" name="key" value={c.key} />
              <label className="space-y-1 text-sm"><span className="text-muted">نام نمایشی <span dir="ltr">({c.key})</span></span><Input name="label" defaultValue={c.label} required maxLength={60} /></label>
              <label className="space-y-1 text-sm"><span className="text-muted">ترتیب</span><Input name="sortOrder" type="number" dir="ltr" min={0} max={999} defaultValue={c.sortOrder} /></label>
              <Checkbox name="isActive" defaultChecked={c.isActive} label="فعال" className="pb-3" />
            </ActionForm>
          </li>
        ))}
      </ul>
    </>
  );
}
