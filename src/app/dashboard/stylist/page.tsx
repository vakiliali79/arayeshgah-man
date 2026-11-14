import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, InboxIcon, StarIcon } from "@/components/icons";
import { Badge, buttonVariants, PageHeader, StatCard } from "@/components/ui";
import { db } from "@/db";
import { ProviderBookingList } from "@/features/dashboard/components/provider-bookings";
import { StylistOnboarding } from "@/features/dashboard/components/stylist-onboarding";
import { WelcomeBanner } from "@/features/dashboard/components/welcome-banner";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { getStylistContext } from "@/server/dashboard/stylist-context";
import { getStylistStats, listMyMemberships, listStylistBookingsByTab } from "@/server/stylists/dashboard";
import { currentTime } from "@/server/time";

export const metadata: Metadata = { title: "پنل آرایشگر" };

export default async function StylistHome({ searchParams }: PageProps<"/dashboard/stylist">) {
  const { stylist, actor } = await getStylistContext();
  const { welcome } = await searchParams;
  if (!stylist) return (<><WelcomeBanner welcome={welcome} /><StylistOnboarding /></>);
  const now = currentTime();
  const [stats, pending, memberships] = await Promise.all([
    getStylistStats(db, stylist.id, now),
    listStylistBookingsByTab(db, stylist.id, "pending", now),
    listMyMemberships(db, actor.userId),
  ]);
  const invites = memberships.filter((m) => m.status === "invited").length;

  return (
    <>
      <WelcomeBanner welcome={welcome} />
      <PageHeader
        title={`سلام، ${stylist.displayName}`}
        description="خلاصه فعالیت و نوبت‌های شما"
        actions={<Link href={`/stylists/${stylist.slug}`} className={buttonVariants({ size: "sm", variant: "outline" })}>مشاهده صفحه عمومی</Link>}
      />
      {!stylist.isActive && <p className="mb-4 rounded-md bg-warning-soft p-3 text-sm text-warning">پروفایل شما توسط مدیریت غیرفعال شده و در جستجو نمایش داده نمی‌شود.</p>}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="درخواست‌های در انتظار" value={stats.counts.pending} icon={<InboxIcon size={18} />} />
        <StatCard label="نوبت‌های تأییدشده پیش‌رو" value={stats.counts.upcoming} icon={<CalendarIcon size={18} />} />
        <StatCard label="نوبت‌های انجام‌شده" value={stats.completed} hint={`${toPersianDigits(stats.completed30d)} مورد در ۳۰ روز اخیر`} />
        <StatCard label="امتیاز" value={stylist.ratingCount ? toPersianDigits(stylist.ratingAvg.toFixed(1)) : "—"} icon={<StarIcon size={18} />} hint={`${toPersianDigits(stylist.ratingCount)} نظر`} />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <StatCard label="درآمد نوبت‌های انجام‌شده (کل)" value={formatToman(stats.revenueTotal)} />
        <StatCard label="درآمد ۳۰ روز اخیر" value={formatToman(stats.revenue30d)} />
      </div>
      {invites > 0 && (
        <p className="mb-6 rounded-lg border border-gold-200 bg-gold-50 p-4 text-sm">
          <Badge tone="gold">{toPersianDigits(invites)}</Badge> دعوت عضویت در سالن دارید.{" "}
          <Link href="/dashboard/stylist/salons" className="font-medium text-primary-700 hover:underline">مشاهده</Link>
        </p>
      )}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">درخواست‌های نوبت</h2>
          <Link href="/dashboard/stylist/bookings" className="text-sm text-primary-700 hover:underline">همه نوبت‌ها</Link>
        </div>
        <ProviderBookingList rows={pending.slice(0, 5)} empty="درخواست نوبت جدیدی ندارید." now={now} />
      </section>
    </>
  );
}
