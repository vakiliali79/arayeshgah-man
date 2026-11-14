import type { Metadata } from "next";
import Link from "next/link";
import { UsersIcon } from "@/components/icons";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, EmptyState, FormField, Input, Select } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { salonPermission } from "@/db/schema";
import { inviteMemberAction, removeMemberAction, respondRequestAction, updatePermissionsAction } from "@/features/dashboard/actions/salon";
import { MEMBER_ROLE_LABEL, MEMBERSHIP_STATUS_LABEL, PERMISSION_LABEL } from "@/lib/format/labels";
import { getSalonContext } from "@/server/dashboard/salon-context";
import { listSalonTeam } from "@/server/salons/dashboard";

export const metadata: Metadata = { title: "تیم سالن" };

export default async function SalonTeamPage({ params }: PageProps<"/dashboard/salon/[salonId]/team">) {
  const { salonId } = await params;
  const { salon, access, actor } = await getSalonContext(salonId);
  const canManage = access.permissions.has("manage_members");
  const team = await listSalonTeam(db, salon.id);
  const requests = team.filter((m) => m.status === "requested");
  const members = team.filter((m) => m.status !== "requested");

  return (
    <div className="space-y-6">
      {canManage && requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">درخواست‌های همکاری آرایشگران</h2>
          <ul className="space-y-2">
            {requests.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold-200 bg-gold-50 p-3">
                <span className="font-medium">{m.name} {m.stylistSlug && <Link href={`/stylists/${m.stylistSlug}`} className="text-xs text-primary-700 hover:underline">(مشاهده صفحه)</Link>}</span>
                <span className="flex gap-2">
                  {[["true", "پذیرش", "primary"], ["false", "رد", "outline"]].map(([approve, label, variant]) => (
                    <ActionForm key={approve} action={respondRequestAction} submitLabel={label!} submitVariant={variant as "primary" | "outline"} submitSize="sm" inline hideMessage>
                      <input type="hidden" name="membershipId" value={m.id} />
                      <input type="hidden" name="approve" value={approve} />
                    </ActionForm>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-bold">اعضای تیم</h2>
        {members.length === 0 ? (
          <EmptyState icon={<UsersIcon />} title="عضوی ثبت نشده است" />
        ) : (
          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    {m.name} <span className="text-xs font-normal text-muted">{MEMBER_ROLE_LABEL[m.role]}</span>{" "}
                    <Badge tone={m.status === "active" ? "success" : "gold"}>{MEMBERSHIP_STATUS_LABEL[m.status]}</Badge>
                  </p>
                  {canManage && m.role !== "owner" && m.userId !== actor.userId && (
                    <ActionForm action={removeMemberAction} submitLabel="حذف از تیم" submitVariant="ghost" submitSize="sm" inline hideMessage confirmText="این عضو از تیم حذف شود؟">
                      <input type="hidden" name="membershipId" value={m.id} />
                    </ActionForm>
                  )}
                </div>
                {canManage && m.role !== "owner" && m.userId !== actor.userId ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-primary-700">سطح دسترسی</summary>
                    <ActionForm action={updatePermissionsAction} submitLabel="ذخیره دسترسی‌ها" submitSize="sm" className="mt-2">
                      <input type="hidden" name="membershipId" value={m.id} />
                      <div className="grid gap-2 sm:grid-cols-2">
                        {salonPermission.enumValues.map((p) => (
                          <Checkbox key={p} name="permissions" value={p} defaultChecked={m.permissions.includes(p)} disabled={!access.permissions.has(p)} label={PERMISSION_LABEL[p]} />
                        ))}
                      </div>
                    </ActionForm>
                  </details>
                ) : (
                  <p className="mt-1 text-xs text-muted">{m.role === "owner" ? "دسترسی کامل" : m.permissions.map((p) => PERMISSION_LABEL[p]).join("، ") || "بدون دسترسی مدیریتی"}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">دعوت عضو جدید</CardTitle>
            <CardDescription>فرد باید در آرایشگاه من با همین شماره موبایل ثبت‌نام کرده باشد؛ آرایشگران باید پروفایل حرفه‌ای داشته باشند.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={inviteMemberAction} submitLabel="ارسال دعوت" resetOnSuccess>
              <input type="hidden" name="salonId" value={salon.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="phone" label="شماره موبایل"><Input id="phone" name="phone" type="tel" dir="ltr" required placeholder="09121234567" /></FormField>
                <FormField id="role" label="نقش در سالن">
                  <Select id="role" name="role" defaultValue="stylist">
                    <option value="stylist">آرایشگر</option>
                    <option value="manager">مدیر</option>
                    <option value="receptionist">پذیرش</option>
                  </Select>
                </FormField>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
