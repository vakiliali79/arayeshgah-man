import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database, Transaction } from "@/db/client";
import { bookings, notifications, reviews, salons, stylists } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { hasSalonPermission } from "../auth/permissions";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, PG, findPgError } from "../errors";
import { parseInput } from "../validation";

const createReviewSchema = z
  .object({
    bookingId: z.uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  })
  .strict();

export async function refreshRatings(tx: Transaction, stylistId: string, salonId: string | null) {
  await tx
    .update(stylists)
    .set({
      ratingAvg: sql`coalesce((select round(avg(rating)::numeric, 2) from ${reviews} where stylist_id = ${stylistId} and not is_hidden), 0)`,
      ratingCount: sql`(select count(*) from ${reviews} where stylist_id = ${stylistId} and not is_hidden)`,
    })
    .where(eq(stylists.id, stylistId));
  if (salonId) {
    await tx
      .update(salons)
      .set({
        ratingAvg: sql`coalesce((select round(avg(rating)::numeric, 2) from ${reviews} where salon_id = ${salonId} and not is_hidden), 0)`,
        ratingCount: sql`(select count(*) from ${reviews} where salon_id = ${salonId} and not is_hidden)`,
      })
      .where(eq(salons.id, salonId));
  }
}

/** ثبت نظر فقط برای نوبت «انجام‌شده» خود مشتری؛ یک نظر برای هر نوبت */
export async function createReview(db: Database, actor: Actor, input: unknown) {
  const data = parseInput(createReviewSchema, input);
  try {
    return await db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, data.bookingId)).for("update").limit(1);
      if (!booking) throw new NotFoundError("Booking");
      if (booking.customerId !== actor.userId) throw new ForbiddenError();
      if (booking.status !== "completed") throw new BusinessRuleError("NOT_COMPLETED", "Only completed bookings can be reviewed");

      const [review] = await tx
        .insert(reviews)
        .values({
          bookingId: booking.id,
          customerId: actor.userId,
          stylistId: booking.stylistId,
          salonId: booking.salonId,
          rating: data.rating,
          comment: data.comment,
        })
        .returning();
      await refreshRatings(tx, booking.stylistId, booking.salonId);

      const [stylist] = await tx.select({ userId: stylists.userId }).from(stylists).where(and(eq(stylists.id, booking.stylistId))).limit(1);
      if (stylist) {
        await tx.insert(notifications).values({
          userId: stylist.userId,
          type: "review_received",
          title: "نظر جدید ثبت شد",
          data: { reviewId: review!.id, rating: data.rating },
        });
      }
      return review!;
    });
  } catch (err) {
    if (findPgError(err)?.code === PG.UNIQUE_VIOLATION) throw new ConflictError("ALREADY_REVIEWED", "This booking has already been reviewed");
    throw err;
  }
}

const replySchema = z.object({ reviewId: z.uuid(), reply: z.string().trim().min(2).max(2000) }).strict();

/** پاسخ به نظر: آرایشگر همان نوبت، دارنده manage_salon سالن، یا ادمین */
export async function replyToReview(db: Database, actor: Actor, input: unknown) {
  const { reviewId, reply } = parseInput(replySchema, input);
  return db.transaction(async (tx) => {
    const [review] = await tx.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
    if (!review) throw new NotFoundError("Review");
    let allowed = actor.role === "admin";
    if (!allowed) {
      const [st] = await tx.select({ userId: stylists.userId }).from(stylists).where(eq(stylists.id, review.stylistId)).limit(1);
      allowed = st?.userId === actor.userId;
    }
    if (!allowed && review.salonId) allowed = await hasSalonPermission(tx, actor, review.salonId, "manage_salon");
    if (!allowed) throw new ForbiddenError();
    const [row] = await tx.update(reviews).set({ reply, repliedAt: new Date() }).where(eq(reviews.id, reviewId)).returning();
    return row!;
  });
}

/** پنهان/نمایش نظر نامناسب — فقط ادمین؛ امتیازها دوباره محاسبه می‌شوند */
export async function setReviewHidden(db: Database, actor: Actor, input: { reviewId: string; hidden: boolean }) {
  if (actor.role !== "admin") throw new ForbiddenError();
  return db.transaction(async (tx) => {
    const [row] = await tx.update(reviews).set({ isHidden: input.hidden }).where(eq(reviews.id, input.reviewId)).returning();
    if (!row) throw new NotFoundError("Review");
    await refreshRatings(tx, row.stylistId, row.salonId);
    return row;
  });
}
