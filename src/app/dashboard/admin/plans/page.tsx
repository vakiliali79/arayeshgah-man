import type { Metadata } from "next";
import { GridIcon } from "@/components/icons";
import { Badge, Card, CardContent, CardHeader, CardTitle, Checkbox, EmptyState, FormField, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import type { SubscriptionPlan } from "@/db/types";
import { deletePlanAction, planAction } from "@/features/dashboard/actions/admin";
import { formatToman } from "@/lib/utils";
import { listPlans } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "تعرفه‌ها و پلن‌ها" };

function PlanFields({ p }: { p?: SubscriptionPlan }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField id={`name-${p?.id ?? "new"}`} label="نام پلن"><Input id={`name-${p?.id ?? "new"}`} name="name" defaultValue={p?.name} required maxLength={60} /></FormField>
      <FormField id={`slug-${p?.id ?? "new"}`} label="شناسه (انگلیسی)"><Input id={`slug-${p?.id ?? "new"}`} name="slug" dir="ltr" defaultValue={p?.slug} required maxLength={60} /></FormField>
      <FormField id={`aud-${p?.id ?? "new"}`} label="مخاطب">
        <Select id={`aud-${p?.id ?? "new"}`} name="audience" defaultValue={p?.audience ?? "salon"}><option value="salon">سالن‌ها</option><option value="stylist">آرایشگران</option></Select>
      </FormField>
      <FormField id={`price-${p?.id ?? "new"}`} label="قیمت ماهانه (تومان، ۰ = رایگان)"><Input id={`price-${p?.id ?? "new"}`} name="priceMonthlyToman" type="number" dir="ltr" min={0} defaultValue={p?.priceMonthlyToman ?? 0} required /></FormField>
      <div className="sm:col-span-2"><FormField id={`desc-${p?.id ?? "new"}`} label="توضیح کوتاه"><Input id={`desc-${p?.id ?? "new"}`} name="description" defaultValue={p?.description ?? ""} maxLength={500} /></FormField></div>
      <div className="sm:col-span-2"><FormField id={`feat-${p?.id ?? "new"}`} label="امکانات (هر خط یک مورد)"><Textarea id={`feat-${p?.id ?? "new"}`} name="features" defaultValue={p?.features.join("\n")} /></FormField></div>
      <FormField id={`sort-${p?.id ?? "new"}`} label="ترتیب"><Input id={`sort-${p?.id ?? "new"}`} name="sortOrder" type="number" dir="ltr" min={0} defaultValue={p?.sortOrder ?? 0} /></FormField>
      <div className="flex items-end gap-4 pb-3">
        <Checkbox name="isActive" defaultChecked={p?.isActive ?? true} label="فعال" />
        <Checkbox name="isFeatured" defaultChecked={p?.isFeatured ?? false} label="پیشنهاد ویژه" />
      </div>
    </div>
  );
}

export default async function AdminPlans() {
  await requireSession(["admin"]);
  const plans = await listPlans(db, false);
  return (
    <>
      <PageHeader title="تعرفه‌ها و پلن‌های اشتراک" description="پلن‌های فعال در صفحه «تعرفه‌ها» نمایش داده می‌شوند. پرداخت آنلاین هنوز فعال نیست." />
      {plans.length === 0 ? <EmptyState icon={<GridIcon />} title="هنوز پلنی تعریف نشده است" description="تا زمانی که پلنی تعریف نشود، صفحه تعرفه‌ها پیام «به‌زودی» نمایش می‌دهد." className="mb-6" /> : (
        <ul className="mb-6 space-y-3">
          {plans.map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-surface p-4">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{p.name} {!p.isActive && <Badge tone="neutral">غیرفعال</Badge>} {p.isFeatured && <Badge tone="gold">ویژه</Badge>}</span>
                  <span className="text-sm text-muted">{p.audience === "salon" ? "سالن" : "آرایشگر"} · {p.priceMonthlyToman ? formatToman(p.priceMonthlyToman) : "رایگان"}</span>
                </summary>
                <ActionForm action={planAction} submitLabel="ذخیره پلن" submitSize="sm" className="mt-4">
                  <input type="hidden" name="planId" value={p.id} />
                  <PlanFields p={p} />
                </ActionForm>
                <ActionForm action={deletePlanAction} submitLabel="حذف پلن" submitVariant="danger" submitSize="sm" inline hideMessage confirmText="این پلن حذف شود؟" className="mt-3">
                  <input type="hidden" name="planId" value={p.id} />
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">پلن جدید</CardTitle></CardHeader>
        <CardContent><ActionForm action={planAction} submitLabel="افزودن پلن" resetOnSuccess><PlanFields /></ActionForm></CardContent>
      </Card>
    </>
  );
}
