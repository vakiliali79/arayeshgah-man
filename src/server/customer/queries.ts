import { and, asc, count, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { bookingEvents, bookings, favorites, reviews, salons, stylists } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { NotFoundError } from "../errors";

/** ستون‌های مشترک نمایش نوبت (همراه نام و نشانی سالن/آرایشگر) */
export const bookingCardColumns = {
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
  cancellationReason: bookings.cancellationReason,
  customerId: bookings.customerId,
  stylistId: bookings.stylistId,
  salonId: bookings.salonId,
  stylistName: stylists.displayName,
  stylistSlug: stylists.slug,
  salonName: salons.name,
  salonSlug: salons.slug,
  salonAddress: salons.address,
};

export type BookingCardRow = Awaited<ReturnType<typeof listCustomerBookings>>[number];

export type CustomerBookingTab = "upcoming" | "past" | "cancelled";

function tabWhere(tab: CustomerBookingTab, now: Date) {
  switch (tab) {
    case "upcoming":
      return and(inArray(bookings.status, ["pending", "confirmed"]), gte(bookings.endsAt, now));
    case "past":
      return or(inArray(bookings.status, ["completed", "no_show"]), and(inArray(bookings.status, ["pending", "confirmed"]), lt(bookings.endsAt, now)));
    case "cancelled":
      return inArray(bookings.status, ["cancelled", "rejected"]);
  }
}

/** نوبت‌های خود مشتری (فقط customer_id = کاربر جاری) */
export async function listCustomerBookings(db: DbOrTx, actor: Actor, tab: CustomerBookingTab, now = new Date()) {
  return db
    .select(bookingCardColumns)
    .from(bookings)
    .innerJoin(stylists, eq(stylists.id, bookings.stylistId))
    .leftJoin(salons, eq(salons.id, bookings.salonId))
    .where(and(eq(bookings.customerId, actor.userId), tabWhere(tab, now)))
    .orderBy(tab === "upcoming" ? asc(bookings.startsAt) : desc(bookings.startsAt))
    .limit(100);
}

export async function countCustomerBookings(db: DbOrTx, actor: Actor, now = new Date()) {
  const tabs: CustomerBookingTab[] = ["upcoming", "past", "cancelled"];
  const out = {} as Record<CustomerBookingTab, number>;
  for (const tab of tabs) {
    const [r] = await db.select({ n: count() }).from(bookings).where(and(eq(bookings.customerId, actor.userId), tabWhere(tab, now)));
    out[tab] = r?.n ?? 0;
  }
  return out;
}

/** جزئیات یک نوبت خود مشتری + تاریخچه وضعیت + نظر ثبت‌شده */
export async function getCustomerBooking(db: DbOrTx, actor: Actor, bookingId: string) {
  const [row] = await db
    .select(bookingCardColumns)
    .from(bookings)
    .innerJoin(stylists, eq(stylists.id, bookings.stylistId))
    .leftJoin(salons, eq(salons.id, bookings.salonId))
    .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, actor.userId)))
    .limit(1);
  if (!row) throw new NotFoundError("Booking");
  const events = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, bookingId)).orderBy(asc(bookingEvents.createdAt));
  const [review] = await db.select().from(reviews).where(eq(reviews.bookingId, bookingId)).limit(1);
  return { booking: row, events, review: review ?? null };
}

export async function getCustomerOverview(db: DbOrTx, actor: Actor, now = new Date()) {
  const counts = await countCustomerBookings(db, actor, now);
  const [next] = await listCustomerBookings(db, actor, "upcoming", now);
  const [fav] = await db.select({ n: count() }).from(favorites).where(eq(favorites.customerId, actor.userId));
  const [rev] = await db.select({ n: count() }).from(reviews).where(eq(reviews.customerId, actor.userId));
  // نوبت‌های انجام‌شده‌ای که هنوز نظر ندارند
  const [pendingReviews] = await db
    .select({ n: count() })
    .from(bookings)
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(and(eq(bookings.customerId, actor.userId), eq(bookings.status, "completed"), sql`${reviews.id} is null`));
  return { counts, next: next ?? null, favorites: fav?.n ?? 0, reviews: rev?.n ?? 0, awaitingReview: pendingReviews?.n ?? 0 };
}

export async function listCustomerFavorites(db: DbOrTx, actor: Actor) {
  const salonRows = await db
    .select({ id: salons.id, name: salons.name, slug: salons.slug, city: salons.city, district: salons.district, ratingAvg: salons.ratingAvg, ratingCount: salons.ratingCount, coverFileId: salons.coverFileId })
    .from(favorites)
    .innerJoin(salons, eq(salons.id, favorites.salonId))
    .where(eq(favorites.customerId, actor.userId))
    .orderBy(desc(favorites.createdAt));
  const stylistRows = await db
    .select({ id: stylists.id, name: stylists.displayName, slug: stylists.slug, specialties: stylists.specialties, ratingAvg: stylists.ratingAvg, ratingCount: stylists.ratingCount })
    .from(favorites)
    .innerJoin(stylists, eq(stylists.id, favorites.stylistId))
    .where(eq(favorites.customerId, actor.userId))
    .orderBy(desc(favorites.createdAt));
  return { salons: salonRows, stylists: stylistRows };
}

export async function listCustomerReviews(db: DbOrTx, actor: Actor) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      reply: reviews.reply,
      isHidden: reviews.isHidden,
      createdAt: reviews.createdAt,
      bookingId: reviews.bookingId,
      serviceName: bookings.serviceName,
      stylistName: stylists.displayName,
      stylistSlug: stylists.slug,
      salonName: salons.name,
      salonSlug: salons.slug,
    })
    .from(reviews)
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .innerJoin(stylists, eq(stylists.id, reviews.stylistId))
    .leftJoin(salons, eq(salons.id, reviews.salonId))
    .where(eq(reviews.customerId, actor.userId))
    .orderBy(desc(reviews.createdAt));
}
