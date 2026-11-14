import type { Metadata } from "next";
import { PageHeader, TabLinks } from "@/components/ui";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { ProviderBookingList } from "@/features/dashboard/components/provider-bookings";
import { StylistOnboarding } from "@/features/dashboard/components/stylist-onboarding";
import { getStylistContext } from "@/server/dashboard/stylist-context";
import { countByTab, listStylistBookingsByTab } from "@/server/stylists/dashboard";
import { PROVIDER_TABS } from "@/features/dashboard/components/provider-tabs";
import { currentTime } from "@/server/time";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "نوبت‌های آرایشگر" };


export default async function StylistBookingsPage({ searchParams }: PageProps<"/dashboard/stylist/bookings">) {
  const { stylist } = await getStylistContext();
  if (!stylist) return <StylistOnboarding />;
  const { tab: raw } = await searchParams;
  const tab = PROVIDER_TABS.find((t) => t.key === raw)?.key ?? "pending";
  const now = currentTime();
  const [rows, counts] = await Promise.all([listStylistBookingsByTab(db, stylist.id, tab, now), countByTab(db, eq(bookings.stylistId, stylist.id), now)]);
  return (
    <>
      <PageHeader title="نوبت‌ها" description="تأیید، رد و پیگیری نوبت‌های شما در همه سالن‌ها و خدمات مستقل" />
      <TabLinks active={tab} tabs={PROVIDER_TABS.map((t) => ({ key: t.key, label: t.label, href: `?tab=${t.key}`, count: counts[t.key] }))} />
      <ProviderBookingList rows={rows} empty={PROVIDER_TABS.find((t) => t.key === tab)!.empty} now={now} />
    </>
  );
}
