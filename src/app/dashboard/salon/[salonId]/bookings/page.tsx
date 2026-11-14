import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { TabLinks } from "@/components/ui";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { ProviderBookingList } from "@/features/dashboard/components/provider-bookings";
import { PROVIDER_TABS } from "@/features/dashboard/components/provider-tabs";
import { getSalonContext } from "@/server/dashboard/salon-context";
import { listSalonBookingsByTab } from "@/server/salons/dashboard";
import { countByTab } from "@/server/stylists/dashboard";
import { currentTime } from "@/server/time";

export const metadata: Metadata = { title: "نوبت‌های سالن" };

export default async function SalonBookingsPage({ params, searchParams }: PageProps<"/dashboard/salon/[salonId]/bookings">) {
  const { salonId } = await params;
  const { tab: raw } = await searchParams;
  const { salon, access } = await getSalonContext(salonId);
  if (!access.permissions.has("manage_bookings")) return <p className="text-sm text-muted">برای مدیریت نوبت‌ها به مجوز «مدیریت نوبت‌ها» نیاز دارید.</p>;
  const tab = PROVIDER_TABS.find((t) => t.key === raw)?.key ?? "pending";
  const now = currentTime();
  const [rows, counts] = await Promise.all([listSalonBookingsByTab(db, salon.id, tab, now), countByTab(db, eq(bookings.salonId, salon.id), now)]);
  return (
    <>
      <TabLinks active={tab} tabs={PROVIDER_TABS.map((t) => ({ key: t.key, label: t.label, href: `?tab=${t.key}`, count: counts[t.key] }))} />
      <ProviderBookingList rows={rows} empty={PROVIDER_TABS.find((t) => t.key === tab)!.empty} now={now} />
    </>
  );
}
