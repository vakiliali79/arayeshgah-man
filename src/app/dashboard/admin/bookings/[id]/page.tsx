import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, BookingStatusBadge, Card, CardContent, CardHeader, CardTitle, Rating } from "@/components/ui";
import { db } from "@/db";
import { bookingAdminAction } from "@/features/dashboard/actions/admin";
import { AuditHistory, ReasonAction } from "@/features/dashboard/components/admin-ui";
import { formatDateTime } from "@/lib/format/datetime";
import { BOOKING_STATUS_LABEL } from "@/lib/format/labels";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { getBookingDetailAdmin } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";
import { NotFoundError } from "@/server/errors";
import { formatPhoneForDisplay } from "@/server/otp/phone";
import { currentTime } from "@/server/time";

export const metadata: Metadata = { title: "جزئیات نوبت" };

const ACTOR_LABEL: Record<string, string> = { customer: "مشتری", stylist: "آرایشگر", salon: "سالن", admin: "مدیریت", system: "سیستم" };

export default async function AdminBookingDetail({ params }: PageProps<"/dashboard/admin/bookings/[id]">) {
  const { actor } = await requireSession(["admin"]);
  const { id } = await params;
  let d;
  try {
    d = await getBookingDetailAdmin(db, actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const b = d.booking;
  const now = currentTime();
  const started = b.startsAt <= now;
  const active = b.status === "pending" || b.status === "confirmed";

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/bookings" className="text-sm text-primary-700 hover:underline">← همه نوبت‌ها</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{b.serviceName}</h1>
          <p className="mt-1 text-sm text-muted">کد پیگیری <span dir="ltr" className="font-semibold text-foreground">{b.trackingCode}</span> · ثبت {formatDateTime(b.createdAt, b.timezone)}</p>
        </div>
        <BookingStatusBadge status={b.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>جزئیات</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>زمان: {formatDateTime(b.startsAt, b.timezone)} ({toPersianDigits(b.durationMinutes)} دقیقه)</p>
            <p>مبلغ: {formatToman(b.priceToman)}</p>
            <p>مشتری: <Link href={`/dashboard/admin/users/${b.customerId}`} className="text-primary-700 hover:underline">{d.customerName}</Link> <span dir="ltr" className="text-muted">{d.customerPhone ? formatPhoneForDisplay(d.customerPhone) : ""}</span></p>
            <p>آرایشگر: <Link href={`/dashboard/admin/stylists/${b.stylistId}`} className="text-primary-700 hover:underline">{d.stylistName}</Link></p>
            <p>محل: {b.salonId ? <Link href={`/dashboard/admin/salons/${b.salonId}`} className="text-primary-700 hover:underline">{d.salonName}</Link> : "نوبت مستقل"}</p>
            {b.customerNote && <p>توضیح مشتری: {b.customerNote}</p>}
            {b.cancellationReason && <p>دلیل لغو/رد: {b.cancellationReason}{b.cancelledBy ? ` (${ACTOR_LABEL[b.cancelledBy]})` : ""}</p>}
            {d.review && <p className="flex items-center gap-2">نظر مشتری: <Rating value={d.review.rating} /> {d.review.isHidden && "(مخفی)"}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>اقدام مدیریت</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!active ? (
              <p className="text-sm text-muted">این نوبت در وضعیت «{BOOKING_STATUS_LABEL[b.status]}» است و تغییر دیگری روی آن مجاز نیست.</p>
            ) : (
              <>
                <Alert tone="warning">اقدامات طبق قوانین رزرو انجام می‌شوند؛ تغییر زمان یا خدمت نوبت ممکن نیست (مشتری باید نوبت جدید بگیرد).</Alert>
                {!started && b.status === "pending" && <ReasonAction id="confirm" action={bookingAdminAction} fields={{ bookingId: b.id, action: "confirm" }} summary="تأیید نوبت" submitLabel="تأیید" required={false} />}
                {!started && <ReasonAction id="cancel" action={bookingAdminAction} fields={{ bookingId: b.id, action: "cancel" }} summary="لغو نوبت" submitLabel="لغو نوبت" variant="danger" reasonLabel="دلیل لغو (به مشتری اطلاع داده می‌شود)" confirmText="این نوبت لغو شود؟" />}
                {started && <ReasonAction id="complete" action={bookingAdminAction} fields={{ bookingId: b.id, action: "complete" }} summary="ثبت انجام نوبت" submitLabel="ثبت انجام‌شده" required={false} />}
                {started && <ReasonAction id="noshow" action={bookingAdminAction} fields={{ bookingId: b.id, action: "no_show" }} summary="ثبت عدم مراجعه" submitLabel="ثبت عدم مراجعه" variant="outline" required={false} />}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>تاریخچه تغییر وضعیت</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {d.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span>
                  {e.fromStatus ? `${BOOKING_STATUS_LABEL[e.fromStatus]} ← ` : ""}<strong>{BOOKING_STATUS_LABEL[e.toStatus]}</strong>
                  <span className="text-muted"> — {ACTOR_LABEL[e.actorType]}{e.actorName ? ` (${e.actorName})` : ""}</span>
                  {e.note && <span className="block text-xs text-muted">{e.note}</span>}
                </span>
                <span className="text-xs text-muted">{formatDateTime(e.createdAt, b.timezone)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>اقدامات مدیریتی روی این نوبت</CardTitle></CardHeader>
        <CardContent><AuditHistory rows={d.history} /></CardContent>
      </Card>
    </div>
  );
}
