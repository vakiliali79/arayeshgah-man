import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { Alert, BookingStatusBadge, Card, CardContent, CardHeader, CardTitle, FormField, Textarea } from "@/components/ui";
import { db } from "@/db";
import { cancelMyBookingAction, submitReviewAction } from "@/features/dashboard/actions/customer";
import { StarInput } from "@/features/dashboard/components/star-input";
import { formatDateTime } from "@/lib/format/datetime";
import { BOOKING_STATUS_LABEL } from "@/lib/format/labels";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { requireSession } from "@/server/auth/current";
import { BOOKING_RULES, canCustomerCancel } from "@/server/bookings/rules";
import { getCustomerBooking } from "@/server/customer/queries";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = { title: "جزئیات نوبت" };

export default async function CustomerBookingDetail({ params, searchParams }: PageProps<"/dashboard/customer/bookings/[id]">) {
  const { actor } = await requireSession();
  const { id } = await params;
  const { created } = await searchParams;
  let data;
  try {
    data = await getCustomerBooking(db, actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { booking: b, events, review } = data;
  const cancellable = canCustomerCancel(b);
  const reviewable = b.status === "completed" && !review;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/dashboard/customer/bookings" className="text-sm text-primary-700 hover:underline">← بازگشت به نوبت‌ها</Link>

      {created === "1" && (
        <Alert tone="success">
          نوبت شما ثبت شد و در انتظار تأیید آرایشگر یا سالن است. کد پیگیری: <span dir="ltr" className="font-bold">{b.trackingCode}</span>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{b.serviceName}</CardTitle>
            <p className="mt-1 text-sm text-muted">
              کد پیگیری: <span dir="ltr" className="font-semibold text-foreground">{b.trackingCode}</span>
            </p>
          </div>
          <BookingStatusBadge status={b.status} />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">زمان</dt><dd className="font-medium">{formatDateTime(b.startsAt, b.timezone)}</dd></div>
            <div><dt className="text-muted">مدت</dt><dd className="font-medium">{toPersianDigits(b.durationMinutes)} دقیقه</dd></div>
            <div>
              <dt className="text-muted">آرایشگر</dt>
              <dd><Link href={`/stylists/${b.stylistSlug}`} className="font-medium text-primary-700 hover:underline">{b.stylistName}</Link></dd>
            </div>
            <div>
              <dt className="text-muted">محل</dt>
              <dd className="font-medium">
                {b.salonSlug ? <Link href={`/salons/${b.salonSlug}`} className="text-primary-700 hover:underline">{b.salonName}</Link> : "خدمت مستقل آرایشگر"}
              </dd>
            </div>
            {b.salonAddress && <div className="sm:col-span-2"><dt className="text-muted">نشانی</dt><dd>{b.salonAddress}</dd></div>}
            <div><dt className="text-muted">مبلغ</dt><dd className="font-medium">{formatToman(b.priceToman)}</dd></div>
            {b.customerNote && <div className="sm:col-span-2"><dt className="text-muted">توضیح شما</dt><dd>{b.customerNote}</dd></div>}
            {b.cancellationReason && <div className="sm:col-span-2"><dt className="text-muted">علت لغو/رد</dt><dd>{b.cancellationReason}</dd></div>}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">پیگیری وضعیت</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3">
                <span>{BOOKING_STATUS_LABEL[e.toStatus]}</span>
                <span className="text-muted">{formatDateTime(e.createdAt, b.timezone)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {cancellable && (
        <Card>
          <CardHeader><CardTitle className="text-base">لغو نوبت</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={cancelMyBookingAction} submitLabel="لغو نوبت" submitVariant="danger" confirmText="آیا از لغو این نوبت مطمئن هستید؟">
              <input type="hidden" name="bookingId" value={b.id} />
              <FormField id="reason" label="علت لغو (اختیاری)">
                <Textarea id="reason" name="reason" maxLength={500} className="min-h-20" />
              </FormField>
              <p className="text-xs text-muted">لغو تا {toPersianDigits(BOOKING_RULES.customerCancelCutoffMinutes / 60)} ساعت پیش از شروع نوبت امکان‌پذیر است.</p>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      {reviewable && (
        <Card>
          <CardHeader><CardTitle className="text-base">ثبت نظر و امتیاز</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={submitReviewAction} submitLabel="ثبت نظر">
              <input type="hidden" name="bookingId" value={b.id} />
              <StarInput />
              <FormField id="comment" label="نظر شما (اختیاری)">
                <Textarea id="comment" name="comment" maxLength={2000} placeholder="تجربه خود را برای دیگران بنویسید…" />
              </FormField>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      {review && (
        <Card>
          <CardHeader><CardTitle className="text-base">نظر شما</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>امتیاز: {toPersianDigits(review.rating)} از ۵</p>
            {review.comment && <p className="leading-7">{review.comment}</p>}
            {review.reply && <p className="rounded-md bg-surface-muted p-3 leading-7"><span className="font-semibold">پاسخ: </span>{review.reply}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
