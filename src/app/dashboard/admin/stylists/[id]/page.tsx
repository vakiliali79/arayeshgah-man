import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, BookingStatusBadge, Card, CardContent, CardHeader, CardTitle, EmptyState, Rating, StatCard } from "@/components/ui";
import { db } from "@/db";
import type { BookingStatus } from "@/db/types";
import { stylistActiveAction } from "@/features/dashboard/actions/admin";
import { AccountStatusBadge, AuditHistory, ReasonAction } from "@/features/dashboard/components/admin-ui";
import { fileUrl } from "@/lib/files";
import { formatDate, formatDateTime } from "@/lib/format/datetime";
import { BOOKING_STATUS_LABEL, MEMBER_ROLE_LABEL, MEMBERSHIP_STATUS_LABEL } from "@/lib/format/labels";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { getStylistDetailAdmin } from "@/server/admin/service";
import { requireSession } from "@/server/auth/current";
import { NotFoundError } from "@/server/errors";
import { formatPhoneForDisplay } from "@/server/otp/phone";

export const metadata: Metadata = { title: "جزئیات آرایشگر" };

export default async function AdminStylistDetail({ params }: PageProps<"/dashboard/admin/stylists/[id]">) {
  const { actor } = await requireSession(["admin"]);
  const { id } = await params;
  let d;
  try {
    d = await getStylistDetailAdmin(db, actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const st = d.stylist;
  const totalBookings = Object.values(d.bookingCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/stylists" className="text-sm text-primary-700 hover:underline">← همه آرایشگران</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{st.displayName}</h1>
          <p className="mt-1 text-sm text-muted">
            <Link href={`/dashboard/admin/users/${st.userId}`} className="text-primary-700 hover:underline">حساب کاربری</Link> · <span dir="ltr">{d.phone ? formatPhoneForDisplay(d.phone) : "—"}</span> · ثبت {formatDate(st.createdAt)}
          </p>
        </div>
        <span className="flex items-center gap-2">
          {st.isActive ? <Badge tone="success">پروفایل فعال</Badge> : <Badge tone="neutral">پروفایل غیرفعال</Badge>}
          {d.accountStatus && <AccountStatusBadge status={d.accountStatus} />}
          <Link href={`/stylists/${st.slug}`} className="text-sm text-primary-700 hover:underline">صفحه عمومی</Link>
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="امتیاز" value={st.ratingCount ? `${toPersianDigits(st.ratingAvg.toFixed(1))} از ${toPersianDigits(st.ratingCount)} نظر` : "بدون نظر"} />
        <StatCard label="نوبت‌ها" value={totalBookings} hint={d.bookingCounts.completed ? `${toPersianDigits(d.bookingCounts.completed)} انجام‌شده` : undefined} />
        <StatCard label="خدمات" value={d.services.length} />
        <StatCard label="سابقه" value={st.yearsExperience ? `${toPersianDigits(st.yearsExperience)} سال` : "—"} />
      </div>

      <Card>
        <CardHeader><CardTitle>وضعیت پروفایل</CardTitle></CardHeader>
        <CardContent>
          {st.isActive ? (
            <ReasonAction id="deactivate" action={stylistActiveAction} fields={{ stylistId: st.id, isActive: "false" }} summary="غیرفعال‌سازی پروفایل آرایشگر" submitLabel="غیرفعال‌سازی" variant="danger" confirmText="آرایشگر از جستجو و رزرو حذف شود؟" />
          ) : (
            <ReasonAction id="activate" action={stylistActiveAction} fields={{ stylistId: st.id, isActive: "true" }} summary="فعال‌سازی پروفایل" submitLabel="فعال‌سازی" required={false} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>پروفایل حرفه‌ای</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>تخصص‌ها: {st.specialties.length ? st.specialties.join("، ") : "—"}</p>
            <p>موقعیت: {[st.city, st.district].filter(Boolean).join("، ") || "—"}</p>
            <p>نوبت مستقل: {st.acceptsIndependentBookings ? "می‌پذیرد" : "نمی‌پذیرد"}</p>
            {st.bio && <p className="whitespace-pre-line leading-7 text-muted">{st.bio}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>سالن‌های مرتبط</CardTitle></CardHeader>
          <CardContent>
            {d.memberships.length === 0 ? <p className="text-sm text-muted">عضو سالنی نیست.</p> : (
              <ul className="space-y-1.5 text-sm">
                {d.memberships.map((m) => (
                  <li key={m.id}><Link href={`/dashboard/admin/salons/${m.salonId}`} className="text-primary-700 hover:underline">{m.salonName}</Link> · {MEMBER_ROLE_LABEL[m.role]} · {MEMBERSHIP_STATUS_LABEL[m.status]}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>خدمات</CardTitle></CardHeader>
        <CardContent>
          {d.services.length === 0 ? <EmptyState title="خدمتی به این آرایشگر سپرده نشده است" className="py-6" /> : (
            <ul className="divide-y divide-border text-sm">
              {d.services.map((x) => (
                <li key={x.serviceId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{x.name} <span className="text-muted">— {x.salonName ?? "مستقل"}</span> {(!x.serviceActive || !x.assignmentActive) && <Badge tone="neutral">غیرفعال</Badge>}</span>
                  <span className="text-xs text-muted">{toPersianDigits(x.customDuration ?? x.baseDuration)} دقیقه · {formatToman(x.customPrice ?? x.basePrice)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>نمونه‌کارها</CardTitle></CardHeader>
        <CardContent>
          {d.portfolio.length === 0 ? <p className="text-sm text-muted">نمونه‌کاری ثبت نشده است.</p> : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {d.portfolio.map((p) => (
                <li key={p.id} className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-muted">
                  <Image src={fileUrl(p.fileId)!} alt={p.title ?? "نمونه‌کار"} fill unoptimized sizes="120px" className="object-cover" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>آخرین نوبت‌ها</CardTitle>
            {totalBookings > 0 && <Link href={`/dashboard/admin/bookings?stylistId=${st.id}`} className="text-sm text-primary-700 hover:underline">همه</Link>}
          </CardHeader>
          <CardContent>
            {d.bookings.rows.length === 0 ? <p className="text-sm text-muted">نوبتی ندارد.</p> : (
              <>
                <p className="mb-2 text-xs text-muted">{Object.entries(d.bookingCounts).map(([k, v]) => `${BOOKING_STATUS_LABEL[k as BookingStatus]}: ${toPersianDigits(v)}`).join(" · ")}</p>
                <ul className="divide-y divide-border text-sm">
                  {d.bookings.rows.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/dashboard/admin/bookings/${b.id}`} className="hover:underline">{b.customerName} — {b.serviceName} — {formatDateTime(b.startsAt, b.timezone)}</Link>
                      <BookingStatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>نظرات</CardTitle>
            <Link href="/dashboard/admin/reviews?view=all" className="text-sm text-primary-700 hover:underline">مدیریت نظرات</Link>
          </CardHeader>
          <CardContent>
            {d.reviews.length === 0 ? <p className="text-sm text-muted">نظری ندارد.</p> : (
              <ul className="space-y-3 text-sm">
                {d.reviews.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    <p className="flex items-center gap-2"><Rating value={r.rating} /> <span className="text-muted">{r.customerName} · {formatDate(r.createdAt)}</span> {r.isHidden && <Badge tone="neutral">مخفی</Badge>}</p>
                    {r.comment && <p className="mt-1 leading-7">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>تاریخچه اقدامات مدیریتی</CardTitle></CardHeader>
        <CardContent><AuditHistory rows={d.history} /></CardContent>
      </Card>
    </div>
  );
}
