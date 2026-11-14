import type { Metadata } from "next";
import { ScissorsIcon } from "@/components/icons";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, FormField, Input, Select } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { addSalonServiceAction, assignStylistAction, toggleAssignmentAction } from "@/features/dashboard/actions/salon";
import { updateServiceAction } from "@/features/dashboard/actions/stylist";
import { ServiceFields } from "@/features/dashboard/components/service-fields";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { listActiveCategories } from "@/server/catalog/categories";
import { getSalonContext } from "@/server/dashboard/salon-context";
import { listSalonServices, listSalonStylists } from "@/server/salons/dashboard";

export const metadata: Metadata = { title: "خدمات سالن" };

export default async function SalonServicesPage({ params }: PageProps<"/dashboard/salon/[salonId]/services">) {
  const { salonId } = await params;
  const { salon, access } = await getSalonContext(salonId);
  const canManage = access.permissions.has("manage_services");
  const [rows, team, categories] = await Promise.all([listSalonServices(db, salon.id), listSalonStylists(db, salon.id), listActiveCategories(db)]);

  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <EmptyState icon={<ScissorsIcon />} title="هنوز خدمتی تعریف نشده است" description="خدمات، قیمت و مدت زمان را تعریف کنید و آرایشگران ارائه‌دهنده را انتخاب کنید." />
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{s.name} {!s.isActive && <Badge tone="neutral">غیرفعال</Badge>}</p>
                  <p className="text-sm text-muted">{formatToman(s.priceToman)} · {toPersianDigits(s.durationMinutes)} دقیقه{s.bufferMinutes ? ` + ${toPersianDigits(s.bufferMinutes)} دقیقه آماده‌سازی` : ""}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.stylists.length === 0 && <span className="text-xs text-warning">هیچ آرایشگری این خدمت را ارائه نمی‌دهد؛ قابل رزرو نیست.</span>}
                {s.stylists.map((a) => (
                  <span key={a.stylistId} className="flex items-center gap-2 rounded-full bg-surface-muted py-1 ps-3 pe-1 text-xs">
                    {a.name}{a.customPrice ? ` (${formatToman(a.customPrice)})` : ""}{!a.isActive && " — متوقف"}
                    {canManage && (
                      <ActionForm action={toggleAssignmentAction} submitLabel={a.isActive ? "توقف" : "فعال"} submitVariant="ghost" submitSize="sm" inline hideMessage>
                        <input type="hidden" name="serviceId" value={s.id} />
                        <input type="hidden" name="stylistId" value={a.stylistId} />
                        <input type="hidden" name="isActive" value={String(!a.isActive)} />
                      </ActionForm>
                    )}
                  </span>
                ))}
              </div>
              {canManage && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary-700">ویرایش خدمت / افزودن آرایشگر</summary>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    <ActionForm action={updateServiceAction} submitLabel="ذخیره" submitSize="sm">
                      <input type="hidden" name="serviceId" value={s.id} />
                      <ServiceFields categories={categories} defaults={s} />
                    </ActionForm>
                    <div className="space-y-4">
                      {team.length > 0 && (
                        <ActionForm action={assignStylistAction} submitLabel="افزودن آرایشگر" submitSize="sm">
                          <input type="hidden" name="serviceId" value={s.id} />
                          <FormField id={`st-${s.id}`} label="آرایشگر">
                            <Select id={`st-${s.id}`} name="stylistId">{team.map((t) => <option key={t.stylistId} value={t.stylistId}>{t.name}</option>)}</Select>
                          </FormField>
                          <FormField id={`cp-${s.id}`} label="قیمت اختصاصی (اختیاری، تومان)">
                            <Input id={`cp-${s.id}`} name="customPriceToman" type="number" dir="ltr" min={0} step={1000} />
                          </FormField>
                        </ActionForm>
                      )}
                      <ActionForm action={updateServiceAction} submitLabel={s.isActive ? "غیرفعال کردن خدمت" : "فعال کردن خدمت"} submitVariant="outline" submitSize="sm" inline hideMessage>
                        <input type="hidden" name="serviceId" value={s.id} />
                        <input type="hidden" name="isActive" value={String(!s.isActive)} />
                      </ActionForm>
                    </div>
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">افزودن خدمت</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={addSalonServiceAction} submitLabel="افزودن خدمت" resetOnSuccess>
              <input type="hidden" name="salonId" value={salon.id} />
              <ServiceFields categories={categories} />
            </ActionForm>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
