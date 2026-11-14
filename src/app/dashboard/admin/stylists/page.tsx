import type { Metadata } from "next";
import Link from "next/link";
import { ScissorsIcon } from "@/components/icons";
import { Badge, EmptyState, PageHeader, Rating } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { stylistActiveAction } from "@/features/dashboard/actions/admin";
import { FilterBar } from "@/features/dashboard/components/filter-bar";
import { listStylistsAdmin } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "مدیریت آرایشگران" };

export default async function AdminStylists({ searchParams }: PageProps<"/dashboard/admin/stylists">) {
  const { actor } = await requireSession(["admin"]);
  const { q } = await searchParams;
  const rows = await listStylistsAdmin(db, actor, typeof q === "string" ? q : undefined);
  return (
    <>
      <PageHeader title="آرایشگران" description="آرایشگر غیرفعال در جستجو و رزرو نمایش داده نمی‌شود." />
      <FilterBar q={typeof q === "string" ? q : undefined} qPlaceholder="نام آرایشگر" />
      {rows.length === 0 ? <EmptyState icon={<ScissorsIcon />} title="آرایشگری پیدا نشد" /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={`/stylists/${s.slug}`} className="font-medium hover:text-primary-700">{s.name}</Link> {!s.isActive && <Badge tone="neutral">غیرفعال</Badge>}
                <p className="text-xs text-muted">{s.city ?? "—"} · <Rating value={s.ratingAvg} count={s.ratingCount} /></p>
              </div>
              <ActionForm action={stylistActiveAction} submitLabel={s.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"} submitVariant={s.isActive ? "outline" : "primary"} submitSize="sm" inline hideMessage>
                <input type="hidden" name="stylistId" value={s.id} />
                <input type="hidden" name="isActive" value={String(!s.isActive)} />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
