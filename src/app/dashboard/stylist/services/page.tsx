import type { Metadata } from "next";
import { ScissorsIcon } from "@/components/icons";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { createIndependentServiceAction, toggleMyServiceAction, updateServiceAction } from "@/features/dashboard/actions/stylist";
import { ServiceFields } from "@/features/dashboard/components/service-fields";
import { StylistOnboarding } from "@/features/dashboard/components/stylist-onboarding";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { listActiveCategories } from "@/server/catalog/categories";
import { getStylistContext } from "@/server/dashboard/stylist-context";
import { listStylistServices } from "@/server/stylists/dashboard";

export const metadata: Metadata = { title: "خدمات من" };

export default async function StylistServicesPage() {
  const { stylist } = await getStylistContext();
  if (!stylist) return <StylistOnboarding />;
  const [rows, categories] = await Promise.all([listStylistServices(db, stylist.id), listActiveCategories(db)]);
  const independent = rows.filter((r) => r.isIndependent);
  const salonRows = rows.filter((r) => !r.isIndependent);

  return (
    <>
      <PageHeader title="خدمات" description="خدمات مستقل شما و خدماتی که سالن‌ها به شما سپرده‌اند" />

      <section className="mb-8 space-y-3">
        <h2 className="font-bold">خدمات مستقل</h2>
        {!stylist.acceptsIndependentBookings && (
          <p className="rounded-md bg-surface-muted p-3 text-sm text-muted">برای دریافت نوبت مستقل، در «پروفایل حرفه‌ای» گزینه پذیرش نوبت مستقل را فعال کنید.</p>
        )}
        {independent.length === 0 ? (
          <EmptyState icon={<ScissorsIcon />} title="خدمت مستقلی تعریف نکرده‌اید" />
        ) : (
          <ul className="space-y-3">
            {independent.map((s) => (
              <li key={s.serviceId} className="rounded-lg border border-border bg-surface p-4">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{s.name}</span>
                    <span className="flex items-center gap-2 text-sm text-muted">
                      {formatToman(s.basePrice)} · {toPersianDigits(s.baseDuration)} دقیقه
                      {!s.serviceActive && <Badge tone="neutral">غیرفعال</Badge>}
                    </span>
                  </summary>
                  <ActionForm action={updateServiceAction} submitLabel="ذخیره خدمت" submitSize="sm" className="mt-4">
                    <input type="hidden" name="serviceId" value={s.serviceId} />
                    <ServiceFields categories={categories} defaults={{ ...s, durationMinutes: s.baseDuration, priceToman: s.basePrice }} />
                  </ActionForm>
                  <ActionForm action={updateServiceAction} submitLabel={s.serviceActive ? "غیرفعال کردن خدمت" : "فعال کردن خدمت"} submitVariant="outline" submitSize="sm" inline hideMessage className="mt-3">
                    <input type="hidden" name="serviceId" value={s.serviceId} />
                    <input type="hidden" name="isActive" value={String(!s.serviceActive)} />
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        )}
        <Card>
          <CardHeader><CardTitle className="text-base">افزودن خدمت مستقل</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={createIndependentServiceAction} submitLabel="افزودن خدمت" resetOnSuccess>
              <ServiceFields categories={categories} />
            </ActionForm>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">خدمات سالن‌ها</h2>
        {salonRows.length === 0 ? (
          <p className="text-sm text-muted">هنوز خدمتی از طرف سالن به شما سپرده نشده است. قیمت و مدت این خدمات توسط سالن تعیین می‌شود.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {salonRows.map((s) => (
              <li key={s.serviceId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted">{s.salonName} · {formatToman(s.customPrice ?? s.basePrice)} · {toPersianDigits(s.customDuration ?? s.baseDuration)} دقیقه</p>
                </div>
                {s.assignmentActive ? (
                  <ActionForm action={toggleMyServiceAction} submitLabel="توقف ارائه" submitVariant="outline" submitSize="sm" inline hideMessage confirmText="ارائه این خدمت متوقف شود؟ فعال‌سازی دوباره با سالن است.">
                    <input type="hidden" name="serviceId" value={s.serviceId} />
                    <input type="hidden" name="isActive" value="false" />
                  </ActionForm>
                ) : (
                  <Badge tone="neutral">متوقف‌شده</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
