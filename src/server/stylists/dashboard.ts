import { and, asc, count, desc, eq, gte, inArray, lt, or, sql, sum } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { bookings, profiles, reviews, salonMembers, salons, services, stylistServices, stylists, users, workingHours, workingTimeOff } from "@/db/schema";
import type { BookingStatus } from "@/db/types";

export type ProviderBookingTab = "pending" | "upcoming" | "past" | "cancelled";

export function providerTabWhere(tab: ProviderBookingTab, now: Date) {
  switch (tab) {
    case "pending":
      return and(eq(bookings.status, "pending"), gte(bookings.startsAt, now));
    case "upcoming":
      return and(eq(bookings.status, "confirmed"), gte(bookings.endsAt, now));
    case "past":
      return or(inArray(bookings.status, ["completed", "no_show"]), and(inArray(bookings.status, ["pending", "confirmed"] as BookingStatus[]), lt(bookings.startsAt, now)));
    case "cancelled":
      return inArray(bookings.status, ["cancelled", "rejected"]);
  }
}

/** ستون‌های نمای ارائه‌دهنده: نام و شماره تماس مشتری فقط برای نوبت‌های همین آرایشگر/سالن */
export const providerBookingColumns = {
  id: bookings.id,
  trackingCode: bookings.trackingCode,
  status: bookings.status,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  timezone: bookings.timezone,
  serviceName: bookings.serviceName,
  durationMinutes: bookings.durationMinutes,
  priceToman: bookings.priceToman,
  customerNote: bookings.customerNote,
  stylistId: bookings.stylistId,
  salonId: bookings.salonId,
  stylistName: stylists.displayName,
  salonName: salons.name,
  customerName: sql<string>`coalesce(${profiles.fullName}, ${users.name})`,
  customerPhone: sql<string | null>`coalesce(${profiles.phone}, '0' || substr(${users.phoneNumber}, 4))`,
};

export function providerBookingsQuery(db: DbOrTx) {
  return db
    .select(providerBookingColumns)
    .from(bookings)
    .innerJoin(stylists, eq(stylists.id, bookings.stylistId))
    .leftJoin(salons, eq(salons.id, bookings.salonId))
    .innerJoin(users, eq(users.id, bookings.customerId))
    .leftJoin(profiles, eq(profiles.userId, bookings.customerId));
}

export async function listStylistBookingsByTab(db: DbOrTx, stylistId: string, tab: ProviderBookingTab, now = new Date()) {
  return providerBookingsQuery(db)
    .where(and(eq(bookings.stylistId, stylistId), providerTabWhere(tab, now)))
    .orderBy(tab === "past" || tab === "cancelled" ? desc(bookings.startsAt) : asc(bookings.startsAt))
    .limit(100);
}

export async function countByTab(db: DbOrTx, scope: ReturnType<typeof eq>, now = new Date()) {
  const out = {} as Record<ProviderBookingTab, number>;
  for (const tab of ["pending", "upcoming", "past", "cancelled"] as ProviderBookingTab[]) {
    const [r] = await db.select({ n: count() }).from(bookings).where(and(scope, providerTabWhere(tab, now)));
    out[tab] = r?.n ?? 0;
  }
  return out;
}

/** آمار آرایشگر: درآمد فقط از نوبت‌های «انجام‌شده» محاسبه می‌شود */
export async function getStylistStats(db: DbOrTx, stylistId: string, now = new Date()) {
  const counts = await countByTab(db, eq(bookings.stylistId, stylistId), now);
  const monthStart = new Date(now.getTime() - 30 * 86_400_000);
  const [rev] = await db
    .select({ total: sum(bookings.priceToman), n: count() })
    .from(bookings)
    .where(and(eq(bookings.stylistId, stylistId), eq(bookings.status, "completed")));
  const [rev30] = await db
    .select({ total: sum(bookings.priceToman), n: count() })
    .from(bookings)
    .where(and(eq(bookings.stylistId, stylistId), eq(bookings.status, "completed"), gte(bookings.startsAt, monthStart)));
  return {
    counts,
    completed: rev?.n ?? 0,
    revenueTotal: Number(rev?.total ?? 0),
    revenue30d: Number(rev30?.total ?? 0),
    completed30d: rev30?.n ?? 0,
  };
}

/** خدمات آرایشگر: مستقل + تخصیص‌یافته از سالن‌ها */
export async function listStylistServices(db: DbOrTx, stylistId: string) {
  return db
    .select({
      serviceId: services.id,
      name: services.name,
      description: services.description,
      category: services.category,
      salonId: services.salonId,
      salonName: salons.name,
      basePrice: services.priceToman,
      baseDuration: services.durationMinutes,
      bufferMinutes: services.bufferMinutes,
      serviceActive: services.isActive,
      customPrice: stylistServices.customPriceToman,
      customDuration: stylistServices.customDurationMinutes,
      assignmentActive: stylistServices.isActive,
      isIndependent: sql<boolean>`${services.stylistId} is not null`,
    })
    .from(stylistServices)
    .innerJoin(services, eq(services.id, stylistServices.serviceId))
    .leftJoin(salons, eq(salons.id, services.salonId))
    .where(eq(stylistServices.stylistId, stylistId))
    .orderBy(asc(salons.name), asc(services.name));
}

export async function listStylistSchedule(db: DbOrTx, stylistId: string) {
  const hours = await db
    .select({ id: workingHours.id, salonId: workingHours.salonId, salonName: salons.name, dayOfWeek: workingHours.dayOfWeek, opensAt: workingHours.opensAt, closesAt: workingHours.closesAt })
    .from(workingHours)
    .leftJoin(salons, eq(salons.id, workingHours.salonId))
    .where(eq(workingHours.stylistId, stylistId))
    .orderBy(asc(workingHours.dayOfWeek), asc(workingHours.opensAt));
  const timeOff = await db
    .select({ id: workingTimeOff.id, salonId: workingTimeOff.salonId, salonName: salons.name, startsAt: workingTimeOff.startsAt, endsAt: workingTimeOff.endsAt, reason: workingTimeOff.reason })
    .from(workingTimeOff)
    .leftJoin(salons, eq(salons.id, workingTimeOff.salonId))
    .where(and(eq(workingTimeOff.stylistId, stylistId), gte(workingTimeOff.endsAt, new Date(Date.now() - 86_400_000))))
    .orderBy(asc(workingTimeOff.startsAt));
  return { hours, timeOff };
}

export async function listReviewsFor(db: DbOrTx, target: { stylistId?: string; salonId?: string }, includeHidden = true) {
  const cond = [target.stylistId ? eq(reviews.stylistId, target.stylistId) : eq(reviews.salonId, target.salonId!)];
  if (!includeHidden) cond.push(eq(reviews.isHidden, false));
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      reply: reviews.reply,
      isHidden: reviews.isHidden,
      createdAt: reviews.createdAt,
      serviceName: bookings.serviceName,
      stylistName: stylists.displayName,
      stylistSlug: stylists.slug,
      customerName: sql<string>`coalesce(${profiles.fullName}, 'مشتری')`,
    })
    .from(reviews)
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .innerJoin(stylists, eq(stylists.id, reviews.stylistId))
    .leftJoin(profiles, eq(profiles.userId, reviews.customerId))
    .where(and(...cond))
    .orderBy(desc(reviews.createdAt))
    .limit(100);
}

export async function listMyMemberships(db: DbOrTx, userId: string) {
  return db
    .select({ id: salonMembers.id, role: salonMembers.role, status: salonMembers.status, joinedAt: salonMembers.joinedAt, salonId: salons.id, salonName: salons.name, salonSlug: salons.slug, city: salons.city })
    .from(salonMembers)
    .innerJoin(salons, eq(salons.id, salonMembers.salonId))
    .where(and(eq(salonMembers.userId, userId), inArray(salonMembers.status, ["invited", "active", "requested", "suspended"])))
    .orderBy(asc(salons.name));
}
