import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import { bookings, notifications } from "@/db/schema";
import type { Actor } from "../auth/actor";

/** اعلان‌های خود کاربر (فقط مال خودش) + مقصد مناسب هر اعلان بر اساس رابطه او با نوبت */
export async function listMyNotifications(db: DbOrTx, actor: Actor, limit = 50) {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      data: notifications.data,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      bookingCustomerId: bookings.customerId,
    })
    .from(notifications)
    .leftJoin(bookings, sql`${bookings.id}::text = ${notifications.data}->>'bookingId'`)
    .where(eq(notifications.userId, actor.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map(({ bookingCustomerId, ...n }) => ({ ...n, href: notificationHref(n.type, n.data, bookingCustomerId === actor.userId) }));
}

const uuid = (v: unknown) => (typeof v === "string" && z.uuid().safeParse(v).success ? v : null);

/** مسیر داخلی مرتبط با اعلان (فقط شناسه‌های معتبر؛ دسترسی واقعی در صفحه مقصد بررسی می‌شود) */
export function notificationHref(type: string, data: Record<string, unknown>, isCustomer: boolean): string | null {
  const bookingId = uuid(data.bookingId);
  if (bookingId) return isCustomer ? `/dashboard/customer/bookings/${bookingId}` : "/dashboard/stylist/bookings";
  if (type === "review_received") return "/dashboard/stylist/reviews";
  if (uuid(data.salonId)) return `/dashboard/salon/${data.salonId}`;
  if (uuid(data.stylistId)) return "/dashboard/stylist/profile";
  if (uuid(data.ticketId)) return "/dashboard/customer/support";
  if (type === "membership_invited" || type === "membership_updated") return "/dashboard/stylist/salons";
  return null;
}

export async function unreadNotificationCount(db: DbOrTx, actor: Actor) {
  const [r] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

/** خوانده‌شدن همه اعلان‌های خود کاربر */
export async function markAllNotificationsRead(db: DbOrTx, actor: Actor) {
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
}
