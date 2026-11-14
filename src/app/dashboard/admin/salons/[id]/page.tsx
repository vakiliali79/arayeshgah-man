import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, BookingStatusBadge, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, StatCard, Textarea } from "@/components/ui";
import { db } from "@/db";
import type { BookingStatus } from "@/db/types";
import { adminUpdateSalonAction, reviewSalonAction, salonActiveAction } from "@/features/dashboard/actions/admin";
import { AccountStatusBadge, AuditHistory, ReasonAction, SalonAdminBadge } from "@/features/dashboard/components/admin-ui";
import { formatDate, formatDateTime } from "@/lib/format/datetime";
import { BOOKING_STATUS_LABEL, MEMBER_ROLE_LABEL, MEMBERSHIP_STATUS_LABEL } from "@/lib/format/labels";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { getSalonDetailAdmin } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";
import { NotFoundError } from "@/server/errors";
import { formatPhoneForDisplay } from "@/server/otp/phone";

export const metadata: Metadata = { title: "جزئیات سالن" };

export default async function AdminSalonDetail({ params }: PageProps<"/dashboard/admin/salons/[id]">) {
  const { actor } = await requireSession(["admin"]);
  const { id } = await params;
  let d;
  try {
    d = await getSalonDetailAdmin(db, actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const s = d.salon;
  const totalBookings = Object.values(d.bookingCounts).reduce((a, b) => a + b, 0);
  const activeTeam = d.team.filter((m) => m.status === "active");

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/salons" className="text-sm text-primary-700 hover:underline">← همه سالن‌ها</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{s.name}</h1>
          <p className="mt-1 text-sm text-muted">
            <span dir="ltr">/{s.slug}</span> · ثبت {formatDate(s.createdAt)}{s.reviewedAt ? ` · آخرین بررسی ${formatDateTime(s.reviewedAt)}` : ""}
          </p>
        </div>
        <span className="flex items-center gap-2">
          <SalonAdminBadge isActive={s.isActive} isVerified={s.isVerified} rejectionReason={s.rejectionReason} />
          {s.isActive && s.isVerified && <Link href={`/salons/${s.slug}`} className="text-sm text-primary-700 hover:underline">صفحه عمومی</Link>}
        </span>
      </header>

      {s.rejectionReason && !s.isVerified && <Alert tone="danger">درخواست این سالن رد شده است. دلیل (به مالک نمایش داده می‌شود): {s.rejectionReason}. با ویرایش اطلاعات توسط مالک، سالن دوباره «در انتظار تأیید» می‌شود.</Alert>}

      <Card>
        <CardHeader><CardTitle>بررسی و وضعیت</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start">
          {s.isActive && !s.isVerified && (
            <ReasonAction id="approve" action={reviewSalonAction} fields={{ salonId: s.id, decision: "approve" }} summary="تأیید سالن" submitLabel="تأیید و نمایش در سایت" required={false} reasonLabel="توضیح" />
          )}
          {s.isActive && !s.isVerified && !s.rejectionReason && (
            <ReasonAction id="reject" action={reviewSalonAction} fields={{ salonId: s.id, decision: "reject" }} summary="رد درخواست ثبت" submitLabel="رد درخواست" variant="danger" reasonLabel="دلیل رد (برای مالک نمایش داده می‌شود)" />
          )}
          {s.isActive && s.isVerified && (
            <ReasonAction id="revoke" action={reviewSalonAction} fields={{ salonId: s.id, decision: "revoke" }} summary="لغو تأیید" submitLabel="لغو تأیید و حذف از جستجو" variant="danger" />
          )}
          {s.isActive ? (
            <ReasonAction id="deactivate" action={salonActiveAction} fields={{ salonId: s.id, isActive: "false" }} summary="غیرفعال‌سازی سالن" submitLabel="غیرفعال‌سازی" variant="danger" confirmText="سالن غیرفعال شود؟ در سایت نمایش داده نمی‌شود و نوبت جدید نمی‌گیرد." />
          ) : (
            <ReasonAction id="activate" action={salonActiveAction} fields={{ salonId: s.id, isActive: "true" }} summary="فعال‌سازی دوباره" submitLabel="فعال‌سازی" required={false} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="آرایشگران فعال" value={activeTeam.filter((m) => m.role === "stylist").length} />
        <StatCard label="خدمات" value={d.services.length} hint={`${toPersianDigits(d.services.filter((x) => x.isActive).length)} فعال`} />
        <StatCard label="نوبت‌ها" value={totalBookings} hint={d.bookingCounts.completed ? `${toPersianDigits(d.bookingCounts.completed)} انجام‌شده` : undefined} />
        <StatCard label="امتیاز" value={s.ratingCount ? `${toPersianDigits(s.ratingAvg.toFixed(1))} از ${toPersianDigits(s.ratingCount)} نظر` : "بدون نظر"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>مالک و اطلاعات تماس</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>مالک: <Link href={`/dashboard/admin/users/${s.ownerId}`} className="font-medium text-primary-700 hover:underline">{d.ownerName}</Link> {d.ownerStatus && <AccountStatusBadge status={d.ownerStatus} />}</p>
            <p>موبایل مالک: <span dir="ltr">{d.ownerPhone ? formatPhoneForDisplay(d.ownerPhone) : "—"}</span></p>
            <p>تلفن سالن: <span dir="ltr">{s.phone ? toPersianDigits(s.phone) : "—"}</span></p>
            <p>نشانی: {s.city}{s.district ? `، ${s.district}` : ""} — {s.address}</p>
            {s.description && <p className="whitespace-pre-line leading-7 text-muted">{s.description}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ویرایش اطلاعات (با ثبت در تاریخچه)</CardTitle></CardHeader>
          <CardContent>
            <ReasonAction id="edit" action={adminUpdateSalonAction} fields={{ salonId: s.id }} summary="اصلاح اطلاعات سالن" submitLabel="ذخیره تغییرات" reasonLabel="دلیل اصلاح (برای مالک ارسال می‌شود)">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm"><span className="text-muted">نام</span><Input name="name" defaultValue={s.name} required minLength={2} maxLength={120} /></label>
                <label className="space-y-1 text-sm"><span className="text-muted">تلفن ثابت</span><Input name="phone" defaultValue={s.phone ?? ""} dir="ltr" maxLength={11} placeholder="02112345678" /></label>
                <label className="space-y-1 text-sm"><span className="text-muted">شهر</span><Input name="city" defaultValue={s.city} required maxLength={60} /></label>
                <label className="space-y-1 text-sm"><span className="text-muted">منطقه</span><Input name="district" defaultValue={s.district ?? ""} maxLength={60} /></label>
              </div>
              <label className="block space-y-1 text-sm"><span className="text-muted">نشانی</span><Input name="address" defaultValue={s.address} required maxLength={300} /></label>
              <label className="block space-y-1 text-sm"><span className="text-muted">توضیحات</span><Textarea name="description" defaultValue={s.description ?? ""} maxLength={2000} className="min-h-24" /></label>
            </ReasonAction>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>اعضای سالن</CardTitle></CardHeader>
        <CardContent>
          {d.team.length === 0 ? <EmptyState title="عضوی ندارد" className="py-6" /> : (
            <ul className="divide-y divide-border text-sm">
              {d.team.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <Link href={`/dashboard/admin/users/${m.userId}`} className="font-medium hover:underline">{m.name}</Link>{" "}
                    <span className="text-muted" dir="ltr">{m.phone ? formatPhoneForDisplay(m.phone) : ""}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    {MEMBER_ROLE_LABEL[m.role]} · {MEMBERSHIP_STATUS_LABEL[m.status]}
                    {m.stylistSlug && <Link href={`/stylists/${m.stylistSlug}`} className="text-primary-700 hover:underline">صفحه عمومی</Link>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>خدمات سالن</CardTitle></CardHeader>
        <CardContent>
          {d.services.length === 0 ? <EmptyState title="خدمتی ثبت نشده است" className="py-6" /> : (
            <ul className="divide-y divide-border text-sm">
              {d.services.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{x.name} {!x.isActive && <Badge tone="neutral">غیرفعال</Badge>}</span>
                  <span className="text-xs text-muted">
                    {toPersianDigits(x.durationMinutes)} دقیقه · {formatToman(x.priceToman)} · آرایشگران: {x.stylists.filter((a) => a.isActive).map((a) => a.name).join("، ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>آخرین نوبت‌ها</CardTitle>
          {totalBookings > 0 && <Link href={`/dashboard/admin/bookings?salonId=${s.id}`} className="text-sm text-primary-700 hover:underline">همه نوبت‌های سالن</Link>}
        </CardHeader>
        <CardContent>
          {d.bookings.rows.length === 0 ? <EmptyState title="نوبتی ثبت نشده است" className="py-6" /> : (
            <>
              <p className="mb-2 text-xs text-muted">{Object.entries(d.bookingCounts).map(([k, v]) => `${BOOKING_STATUS_LABEL[k as BookingStatus]}: ${toPersianDigits(v)}`).join(" · ")}</p>
              <ul className="divide-y divide-border text-sm">
                {d.bookings.rows.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/dashboard/admin/bookings/${b.id}`} className="hover:underline">{b.customerName} — {b.serviceName} با {b.stylistName} — {formatDateTime(b.startsAt, b.timezone)}</Link>
                    <BookingStatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>تاریخچه تأیید و تغییرات</CardTitle></CardHeader>
        <CardContent><AuditHistory rows={d.history} /></CardContent>
      </Card>
    </div>
  );
}
