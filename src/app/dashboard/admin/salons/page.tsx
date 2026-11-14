import type { Metadata } from "next";
import Link from "next/link";
import { StoreIcon } from "@/components/icons";
import { EmptyState, PageHeader, TabLinks } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { salonStatusAction } from "@/features/dashboard/actions/admin";
import { SalonStatusBadge } from "@/features/dashboard/components/salon-status-badge";
import { formatDate } from "@/lib/format/datetime";
import { listSalonsAdmin } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "مدیریت سالن‌ها" };
const TABS = [
  { key: "pending", label: "در انتظار تأیید" },
  { key: "verified", label: "تأییدشده" },
  { key: "inactive", label: "غیرفعال/ردشده" },
  { key: "all", label: "همه" },
];

function Op({ salonId, field, value, label, variant }: { salonId: string; field: "isVerified" | "isActive"; value: boolean; label: string; variant?: "primary" | "outline" | "danger" }) {
  return (
    <ActionForm action={salonStatusAction} submitLabel={label} submitVariant={variant} submitSize="sm" inline hideMessage>
      <input type="hidden" name="salonId" value={salonId} />
      <input type="hidden" name={field} value={String(value)} />
    </ActionForm>
  );
}

export default async function AdminSalons({ searchParams }: PageProps<"/dashboard/admin/salons">) {
  const { actor } = await requireSession(["admin"]);
  const { status: raw } = await searchParams;
  const status = TABS.find((t) => t.key === raw)?.key ?? "pending";
  const rows = await listSalonsAdmin(db, actor, { status });
  return (
    <>
      <PageHeader title="سالن‌ها" description="سالن‌ها فقط پس از تأیید در جستجوی عمومی دیده می‌شوند." />
      <TabLinks active={status} tabs={TABS.map((t) => ({ ...t, href: `?status=${t.key}` }))} />
      {rows.length === 0 ? <EmptyState icon={<StoreIcon />} title="سالنی در این دسته نیست" /> : (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="font-bold">{s.name} <SalonStatusBadge isActive={s.isActive} isVerified={s.isVerified} /></p>
                <p className="text-xs text-muted">{s.city}{s.district ? `، ${s.district}` : ""} · مالک: {s.ownerName} · {formatDate(s.createdAt)} · <span dir="ltr">{s.slug}</span></p>
                {s.isActive && s.isVerified && <Link href={`/salons/${s.slug}`} className="text-xs text-primary-700 hover:underline">صفحه عمومی</Link>}
              </div>
              <div className="flex flex-wrap gap-2">
                {s.isActive && !s.isVerified && <Op salonId={s.id} field="isVerified" value label="تأیید سالن" />}
                {s.isActive && s.isVerified && <Op salonId={s.id} field="isVerified" value={false} label="لغو تأیید" variant="outline" />}
                {s.isActive ? <Op salonId={s.id} field="isActive" value={false} label={s.isVerified ? "غیرفعال‌سازی" : "رد سالن"} variant="danger" /> : <Op salonId={s.id} field="isActive" value label="فعال‌سازی دوباره" variant="outline" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
