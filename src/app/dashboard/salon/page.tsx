import type { Metadata } from "next";
import Link from "next/link";
import { StoreIcon } from "@/components/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { createSalonAction } from "@/features/dashboard/actions/salon";
import { SalonFields } from "@/features/dashboard/components/salon-fields";
import { WelcomeBanner } from "@/features/dashboard/components/welcome-banner";
import { SalonStatusBadge } from "@/features/dashboard/components/salon-status-badge";
import { requireSession } from "@/server/auth/current";
import { getManagedSalons } from "@/server/dashboard/access";

export const metadata: Metadata = { title: "سالن‌های من" };


export default async function SalonsHome({ searchParams }: PageProps<"/dashboard/salon">) {
  const { actor } = await requireSession();
  const { welcome } = await searchParams;
  const salons = await getManagedSalons(db, actor);
  const canCreate = actor.role === "salon_owner" || actor.role === "admin";

  return (
    <>
      <WelcomeBanner welcome={welcome} />
      <PageHeader title="سالن‌های من" description="مدیریت سالن‌هایی که مالک یا مدیر آن‌ها هستید" />
      {salons.length === 0 ? (
        <EmptyState icon={<StoreIcon />} title="هنوز سالنی ثبت نکرده‌اید" description="با فرم زیر سالن خود را ثبت کنید. پس از تأیید مدیریت، در جستجوی سایت نمایش داده می‌شود." className="mb-6" />
      ) : (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2">
          {salons.map((s) => (
            <li key={s.id}>
              <Link href={`/dashboard/salon/${s.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-soft hover:shadow-lift">
                <span className="font-bold">{s.name}</span>
                <SalonStatusBadge isActive={s.isActive} isVerified={s.isVerified} rejectionReason={s.rejectionReason} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {canCreate && (
        <Card id="new">
          <CardHeader>
            <CardTitle>ثبت سالن جدید</CardTitle>
            <CardDescription>اطلاعات پایه را وارد کنید؛ خدمات، تیم، ساعات کاری و تصاویر را بعداً اضافه می‌کنید.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={createSalonAction} submitLabel="ثبت سالن">
              <SalonFields withSlug />
            </ActionForm>
          </CardContent>
        </Card>
      )}
    </>
  );
}
