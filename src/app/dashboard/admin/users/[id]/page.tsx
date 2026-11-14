import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, BookingStatusBadge, Card, CardContent, CardHeader, CardTitle, EmptyState, Select, StatCard } from "@/components/ui";
import { ROLE_META, USER_ROLES } from "@/config/roles";
import { db } from "@/db";
import type { BookingStatus } from "@/db/types";
import { setUserRoleAction, setUserStatusAction } from "@/features/dashboard/actions/admin";
import { AccountStatusBadge, AuditHistory, ReasonAction, SalonAdminBadge } from "@/features/dashboard/components/admin-ui";
import { formatDate, formatDateTime, formatTime } from "@/lib/format/datetime";
import { BOOKING_STATUS_LABEL, MEMBER_ROLE_LABEL, MEMBERSHIP_STATUS_LABEL } from "@/lib/format/labels";
import { formatToman, toPersianDigits } from "@/lib/utils";
import { getUserDetail } from "@/server/admin/users";
import { requireSession } from "@/server/auth/current";
import { NotFoundError } from "@/server/errors";
import { formatPhoneForDisplay } from "@/server/otp/phone";

export const metadata: Metadata = { title: "جزئیات کاربر" };

export default async function AdminUserDetail({ params }: PageProps<"/dashboard/admin/users/[id]">) {
  const { actor } = await requireSession(["admin"]);
  const { id } = await params;
  let d;
  try {
    d = await getUserDetail(db, actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { user, profile } = d;
  const name = profile.fullName ?? user.name;
  const isSelf = user.id === actor.userId;
  const locked = d.isSuperAdmin || isSelf;
  const totalBookings = Object.values(d.bookingCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/users" className="text-sm text-primary-700 hover:underline">← همه کاربران</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{name} {d.isSuperAdmin && <Badge tone="gold">مدیر کل اصلی</Badge>}</h1>
          <p className="mt-1 text-sm text-muted">
            <span dir="ltr">{user.phoneNumber ? formatPhoneForDisplay(user.phoneNumber) : "بدون شماره"}</span> · عضویت {formatDate(user.createdAt)}
          </p>
        </div>
        <span className="flex gap-2"><Badge tone="primary">{ROLE_META[profile.role].label}</Badge><AccountStatusBadge status={profile.status} /></span>
      </header>

      {profile.status === "suspended" && (
        <Alert tone="danger">این حساب از {profile.suspendedAt ? formatDateTime(profile.suspendedAt) : "—"} تعلیق است. دلیل: {profile.suspendedReason ?? "—"}</Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="آخرین فعالیت ثبت‌شده" value={d.lastActivity ? formatDate(d.lastActivity) : "—"} hint={d.lastActivity ? `ساعت ${formatTime(d.lastActivity)}` : "ورودی ثبت نشده"} />
        <StatCard label="نشست‌های فعال" value={d.activeSessions} />
        <StatCard label="نوبت‌ها (به‌عنوان مشتری)" value={totalBookings} hint={d.bookingCounts.completed ? `${toPersianDigits(d.bookingCounts.completed)} انجام‌شده` : undefined} />
        <StatCard label="شهر" value={profile.city ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>نقش و دسترسی</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {locked ? (
              <p className="text-sm text-muted">{d.isSuperAdmin ? "نقش و وضعیت مدیر کل اصلی قابل تغییر نیست." : "نقش و وضعیت حساب خودتان را نمی‌توانید تغییر دهید."}</p>
            ) : (
              <>
                <ReasonAction id="role" action={setUserRoleAction} fields={{ userId: user.id }} summary="تغییر نقش" submitLabel="ثبت نقش جدید" required={false} confirmText="نقش این کاربر تغییر کند؟">
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted">نقش جدید</span>
                    <Select name="role" defaultValue={profile.role}>{USER_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}</Select>
                  </label>
                  <p className="text-xs text-muted">اعطا یا سلب نقش «مدیر سیستم» فقط توسط مدیر کل اصلی ممکن است.</p>
                </ReasonAction>
                {profile.status === "active" ? (
                  <ReasonAction id="suspend" action={setUserStatusAction} fields={{ userId: user.id, status: "suspended" }} summary="تعلیق حساب" submitLabel="تعلیق و خروج از همه دستگاه‌ها" variant="danger" confirmText="حساب این کاربر تعلیق شود؟">
                    <p className="text-xs leading-6 text-muted">کاربر فوراً از همه دستگاه‌ها خارج می‌شود و تا فعال‌سازی دوباره نمی‌تواند وارد شود. پروفایل آرایشگری او هم از سایت پنهان می‌شود.</p>
                  </ReasonAction>
                ) : (
                  <ReasonAction id="activate" action={setUserStatusAction} fields={{ userId: user.id, status: "active" }} summary="فعال‌سازی دوباره حساب" submitLabel="فعال‌سازی" required={false} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>سالن‌ها و فعالیت حرفه‌ای</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {d.stylist ? (
              <p>پروفایل آرایشگری: <Link href={`/dashboard/admin/stylists/${d.stylist.id}`} className="font-medium text-primary-700 hover:underline">{d.stylist.displayName}</Link> {d.stylist.isActive ? <Badge tone="success">فعال</Badge> : <Badge tone="neutral">غیرفعال</Badge>}</p>
            ) : (
              <p className="text-muted">پروفایل آرایشگری ندارد.</p>
            )}
            {d.ownedSalons.length > 0 && (
              <div>
                <p className="mb-1 text-muted">سالن‌های تحت مالکیت</p>
                <ul className="space-y-1">{d.ownedSalons.map((s) => <li key={s.id}><Link href={`/dashboard/admin/salons/${s.id}`} className="text-primary-700 hover:underline">{s.name}</Link> <SalonAdminBadge {...s} /></li>)}</ul>
              </div>
            )}
            {d.memberships.length > 0 && (
              <div>
                <p className="mb-1 text-muted">عضویت در سالن‌ها</p>
                <ul className="space-y-1">{d.memberships.map((m) => <li key={m.id}><Link href={`/dashboard/admin/salons/${m.salonId}`} className="text-primary-700 hover:underline">{m.salonName}</Link> · {MEMBER_ROLE_LABEL[m.role]} · {MEMBERSHIP_STATUS_LABEL[m.status]}</li>)}</ul>
              </div>
            )}
            {!d.stylist && d.ownedSalons.length === 0 && d.memberships.length === 0 && <p className="text-muted">ارتباطی با سالن ندارد.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>نوبت‌های کاربر</CardTitle>
          {totalBookings > 0 && <Link href={`/dashboard/admin/bookings?customerId=${user.id}`} className="text-sm text-primary-700 hover:underline">همه نوبت‌ها</Link>}
        </CardHeader>
        <CardContent>
          {d.customerBookings.length === 0 ? <EmptyState title="نوبتی ثبت نکرده است" className="py-6" /> : (
            <>
              <p className="mb-2 text-xs text-muted">{Object.entries(d.bookingCounts).map(([k, v]) => `${BOOKING_STATUS_LABEL[k as BookingStatus]}: ${toPersianDigits(v)}`).join(" · ")}</p>
              <ul className="divide-y divide-border text-sm">
                {d.customerBookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/dashboard/admin/bookings/${b.id}`} className="hover:underline">
                      {b.serviceName} — {b.stylistName}{b.salonName ? ` · ${b.salonName}` : ""} — {formatDateTime(b.startsAt, b.timezone)}
                    </Link>
                    <span className="flex items-center gap-2 text-xs"><span dir="ltr">{b.trackingCode}</span> {formatToman(b.priceToman)} <BookingStatusBadge status={b.status} /></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>تاریخچه اقدامات مدیریتی</CardTitle></CardHeader>
        <CardContent><AuditHistory rows={d.history} /></CardContent>
      </Card>
    </div>
  );
}
