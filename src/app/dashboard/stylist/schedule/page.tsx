import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { addMyHoursAction, addMyTimeOffAction } from "@/features/dashboard/actions/stylist";
import { HoursEditor, TimeOffEditor } from "@/features/dashboard/components/schedule-editor";
import { StylistOnboarding } from "@/features/dashboard/components/stylist-onboarding";
import { getStylistContext } from "@/server/dashboard/stylist-context";
import { listStylistSchedule } from "@/server/stylists/dashboard";

export const metadata: Metadata = { title: "برنامه کاری" };

export default async function StylistSchedulePage() {
  const { stylist } = await getStylistContext();
  if (!stylist) return <StylistOnboarding />;
  const { hours, timeOff } = await listStylistSchedule(db, stylist.id);
  const independent = hours.filter((h) => !h.salonId);
  const salonHours = hours.filter((h) => h.salonId);

  return (
    <>
      <PageHeader title="برنامه کاری و زمان‌های قابل رزرو" description="زمان‌های آزاد برای رزرو از روی همین برنامه، منهای نوبت‌ها و تعطیلی‌ها محاسبه می‌شود." />
      <div className="grid gap-8 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-bold">ساعات کاری مستقل</h2>
          <HoursEditor rows={independent} addAction={addMyHoursAction} emptyText="برای نوبت‌های مستقل ساعتی تعریف نشده است." />
        </section>
        <section className="space-y-3">
          <h2 className="font-bold">شیفت‌های شما در سالن‌ها</h2>
          <p className="text-xs text-muted">این شیفت‌ها توسط مدیر هر سالن تنظیم می‌شوند.</p>
          <HoursEditor rows={salonHours.map((h) => ({ ...h, label: h.salonName, editable: false }))} emptyText="شیفتی در سالن‌ها برای شما ثبت نشده است." />
        </section>
        <section className="space-y-3 xl:col-span-2">
          <h2 className="font-bold">مرخصی و روزهای تعطیل</h2>
          <TimeOffEditor
            rows={timeOff.map((t) => ({ ...t, label: t.salonName, editable: !t.salonId }))}
            addAction={addMyTimeOffAction}
            tz={stylist.timezone}
          />
        </section>
      </div>
    </>
  );
}
