import type { Metadata } from "next";
import { Alert, EmptyState, StatCard } from "@/components/ui";
import { ChartIcon } from "@/components/icons";
import { db } from "@/db";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { BOOKING_STATUS_LABEL } from "@/lib/format/labels";
import { getSalonContext } from "@/server/dashboard/salon-context";
import { getSalonReport, hasPendingRequests } from "@/server/salons/dashboard";
import type { BookingStatus } from "@/db/types";

export const metadata: Metadata = { title: "خلاصه سالن" };

const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
/** «۲۰۲۶-۱۱» (میلادی) → نام ماه شمسی تقریبی بر اساس روز پانزدهم */
function monthLabel(key: string) {
  const d = new Date(`${key}-15T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-u-ca-persian", { month: "numeric", year: "numeric", timeZone: "Asia/Tehran" }).formatToParts(d);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  return `${MONTHS_FA[m - 1]} ${toPersianDigits(y.replace(/\D/g, ""))}`;
}

export default async function SalonOverview({ params, searchParams }: PageProps<"/dashboard/salon/[salonId]">) {
  const { salonId } = await params;
  const { created } = await searchParams;
  const { salon, access } = await getSalonContext(salonId);
  const canReport = access.permissions.has("view_reports");
  const pendingReq = access.permissions.has("manage_members") ? await hasPendingRequests(db, salon.id) : 0;

  return (
    <div className="space-y-6">
      {created === "1" && <Alert tone="success">سالن ثبت شد و پس از بررسی مدیریت در جستجو نمایش داده می‌شود. اکنون خدمات، تیم و ساعات کاری را اضافه کنید.</Alert>}
      {!salon.isVerified && salon.isActive && <Alert tone="warning">این سالن در انتظار تأیید مدیریت است و هنوز در جستجوی عمومی دیده نمی‌شود.</Alert>}
      {pendingReq > 0 && <Alert tone="warning">{toPersianDigits(pendingReq)} درخواست عضویت آرایشگر منتظر بررسی است (بخش «تیم»).</Alert>}
      {!canReport ? (
        <p className="text-sm text-muted">برای مشاهده گزارش‌ها به مجوز «مشاهده گزارش‌ها» نیاز دارید.</p>
      ) : (
        <Report salonId={salon.id} />
      )}
    </div>
  );
}

async function Report({ salonId }: { salonId: string }) {
  const r = await getSalonReport(db, salonId);
  const total = Object.values(r.status).reduce((a, b) => a + b, 0);
  if (total === 0) return <EmptyState icon={<ChartIcon />} title="هنوز نوبتی برای این سالن ثبت نشده است" description="پس از ثبت اولین نوبت‌ها، آمار و درآمد اینجا نمایش داده می‌شود." />;
  const max = Math.max(1, ...r.monthly.map((m) => m.bookings));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="کل نوبت‌ها" value={total} />
        <StatCard label="در انتظار تأیید" value={r.status.pending ?? 0} />
        <StatCard label="انجام‌شده" value={r.completed} />
        <StatCard label="درآمد (نوبت‌های انجام‌شده)" value={formatToman(r.revenue)} />
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-4 font-bold">نوبت‌ها در ۶ ماه اخیر</h2>
        <ul className="space-y-2">
          {r.monthly.map((m) => (
            <li key={m.month} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm">
              <span className="text-muted">{monthLabel(m.month)}</span>
              <span className="h-2.5 rounded-full bg-primary-100"><span className="block h-full rounded-full bg-primary-500" style={{ width: `${(m.bookings / max) * 100}%` }} /></span>
              <span className="whitespace-nowrap">{toPersianDigits(m.bookings)} نوبت · {formatToman(m.revenue)}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 font-bold">وضعیت نوبت‌ها</h2>
          <ul className="space-y-1.5 text-sm">
            {Object.entries(r.status).map(([k, v]) => (
              <li key={k} className="flex justify-between"><span>{BOOKING_STATUS_LABEL[k as BookingStatus]}</span><span>{toPersianDigits(v)}</span></li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 font-bold">عملکرد آرایشگران</h2>
          <ul className="space-y-1.5 text-sm">
            {r.byStylist.map((s) => (
              <li key={s.name} className="flex justify-between gap-2"><span>{s.name}</span><span className="text-muted">{toPersianDigits(s.n)} نوبت · {formatToman(s.revenue)}</span></li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="mb-3 font-bold">پرطرفدارترین خدمات</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {r.topServices.map((s) => <li key={s.name} className="rounded-full bg-surface-muted px-3 py-1">{s.name} ({toPersianDigits(s.n)})</li>)}
          </ul>
        </section>
      </div>
    </>
  );
}
