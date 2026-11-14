import type { Metadata } from "next";
import Link from "next/link";
import { StoreIcon } from "@/components/icons";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, FormField, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { membershipAction } from "@/features/dashboard/actions/stylist";
import { StylistOnboarding } from "@/features/dashboard/components/stylist-onboarding";
import { MEMBER_ROLE_LABEL, MEMBERSHIP_STATUS_LABEL } from "@/lib/format/labels";
import { getStylistContext } from "@/server/dashboard/stylist-context";
import { listMyMemberships } from "@/server/stylists/dashboard";

export const metadata: Metadata = { title: "سالن‌های من" };

function Op({ id, op, label, variant, confirm }: { id: string; op: string; label: string; variant?: "primary" | "outline" | "danger"; confirm?: string }) {
  return (
    <ActionForm action={membershipAction} submitLabel={label} submitVariant={variant} submitSize="sm" inline hideMessage confirmText={confirm}>
      <input type="hidden" name="membershipId" value={id} />
      <input type="hidden" name="op" value={op} />
    </ActionForm>
  );
}

export default async function StylistSalonsPage() {
  const { stylist, actor } = await getStylistContext();
  if (!stylist) return <StylistOnboarding />;
  const rows = await listMyMemberships(db, actor.userId);
  return (
    <>
      <PageHeader title="سالن‌های من" description="عضویت در سالن‌ها، دعوت‌ها و درخواست‌های همکاری" />
      {rows.length === 0 ? (
        <EmptyState icon={<StoreIcon />} title="عضو هیچ سالنی نیستید" description="می‌توانید مستقل کار کنید یا با نشانی صفحه یک سالن، درخواست همکاری بدهید." />
      ) : (
        <ul className="mb-6 space-y-3">
          {rows.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
              <div>
                <Link href={`/salons/${m.salonSlug}`} className="font-bold hover:text-primary-700">{m.salonName}</Link>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                  {m.city} · {MEMBER_ROLE_LABEL[m.role]} <Badge tone={m.status === "active" ? "success" : "gold"}>{MEMBERSHIP_STATUS_LABEL[m.status]}</Badge>
                </p>
              </div>
              <div className="flex gap-2">
                {m.status === "invited" && (<><Op id={m.id} op="accept" label="پذیرش دعوت" /><Op id={m.id} op="decline" label="رد" variant="outline" /></>)}
                {m.status === "requested" && <Op id={m.id} op="leave" label="لغو درخواست" variant="outline" />}
                {m.status === "active" && m.role !== "owner" && <Op id={m.id} op="leave" label="خروج از سالن" variant="outline" confirm="از این سالن خارج می‌شوید؟" />}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">درخواست همکاری با یک سالن</CardTitle>
          <CardDescription>نشانی صفحه سالن را وارد کنید (بخش آخر آدرس، مثلاً rose-gold در arayeshgahman.ir/salons/rose-gold).</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={membershipAction} submitLabel="ارسال درخواست" resetOnSuccess>
            <input type="hidden" name="op" value="request" />
            <FormField id="salonSlug" label="نشانی سالن"><Input id="salonSlug" name="salonSlug" dir="ltr" required placeholder="rose-gold" /></FormField>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
