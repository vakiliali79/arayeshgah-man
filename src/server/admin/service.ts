import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "@/db/client";
import {
  bookingEvents, bookingStatus, bookings, notifications, profiles, reviews, salons, serviceCategories, services, stylistServices, stylists,
  subscriptionPlans, supportTicketMessages, supportTickets, users,
} from "@/db/schema";
import type { Actor } from "../auth/actor";
import { cancelBooking, completeBooking, confirmBooking, markNoShow } from "../bookings/service";
import { CATEGORY_KEY_RE } from "../catalog/service";
import { BusinessRuleError, ConflictError, NotFoundError, PG, findPgError } from "../errors";
import { normalizeIranMobile } from "../otp/phone";
import { listPortfolio } from "../portfolio/service";
import { refreshRatings } from "../reviews/service";
import { listSalonServices, listSalonTeam } from "../salons/dashboard";
import { listMyMemberships, listReviewsFor, listStylistServices } from "../stylists/dashboard";
import { parseInput } from "../validation";
import { assertAdmin, diffFields, historyFor, recordAudit } from "./audit";

export { assertAdmin } from "./audit";
export { listUsers } from "./users";

const likeTerm = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const tehranDayStart = (d: string) => new Date(`${d}T00:00:00+03:30`);
const uuidOrNull = (v: unknown) => (typeof v === "string" && z.uuid().safeParse(v).success ? v : null);
const reasonText = z.string().trim().min(5).max(1000);

/** اعلان داخلی برای کاربر (همان جدول notifications که داشبوردها نمایش می‌دهند) */
async function notify(db: DbOrTx, userId: string, title: string, body: string | null, data: Record<string, unknown> = {}) {
  await db.insert(notifications).values({ userId, type: "system", title, body, data });
}

// ================================================================== سالن‌ها

export type SalonAdminStatus = "pending" | "verified" | "rejected" | "inactive" | "all";

const salonStatusWhere = (status?: string) => {
  switch (status) {
    case "pending": return and(eq(salons.isActive, true), eq(salons.isVerified, false), isNull(salons.rejectionReason));
    case "verified": return and(eq(salons.isActive, true), eq(salons.isVerified, true));
    case "rejected": return and(eq(salons.isActive, true), eq(salons.isVerified, false), isNotNull(salons.rejectionReason));
    case "inactive": return eq(salons.isActive, false);
    default: return undefined;
  }
};

export async function listSalonsAdmin(db: DbOrTx, actor: Actor, filter: { status?: string; q?: string; city?: string }) {
  assertAdmin(actor);
  const cond = [salonStatusWhere(filter.status)];
  const q = filter.q?.trim();
  if (q) {
    const phone = normalizeIranMobile(q);
    cond.push(or(ilike(salons.name, likeTerm(q)), ilike(salons.slug, likeTerm(q)), ilike(profiles.fullName, likeTerm(q)), phone ? eq(users.phoneNumber, phone) : sql`false`));
  }
  if (filter.city?.trim()) cond.push(ilike(salons.city, likeTerm(filter.city.trim())));
  return db
    .select({
      id: salons.id, name: salons.name, slug: salons.slug, city: salons.city, district: salons.district, isActive: salons.isActive, isVerified: salons.isVerified,
      rejectionReason: salons.rejectionReason, createdAt: salons.createdAt, ownerId: salons.ownerId, ownerName: sql<string>`coalesce(${profiles.fullName}, ${users.name})`, ownerPhone: users.phoneNumber,
    })
    .from(salons)
    .innerJoin(users, eq(users.id, salons.ownerId))
    .leftJoin(profiles, eq(profiles.userId, salons.ownerId))
    .where(and(...cond))
    .orderBy(desc(salons.createdAt))
    .limit(200);
}

export async function salonStatusCounts(db: DbOrTx, actor: Actor) {
  assertAdmin(actor);
  const [r] = await db
    .select({
      all: count(),
      pending: sql<number>`count(*) filter (where ${salons.isActive} and not ${salons.isVerified} and ${salons.rejectionReason} is null)::int`,
      verified: sql<number>`count(*) filter (where ${salons.isActive} and ${salons.isVerified})::int`,
      rejected: sql<number>`count(*) filter (where ${salons.isActive} and not ${salons.isVerified} and ${salons.rejectionReason} is not null)::int`,
      inactive: sql<number>`count(*) filter (where not ${salons.isActive})::int`,
    })
    .from(salons);
  return r!;
}

async function lockSalon(db: DbOrTx, salonId: string) {
  if (!uuidOrNull(salonId)) throw new NotFoundError("Salon");
  const [s] = await db.select().from(salons).where(eq(salons.id, salonId)).for("update").limit(1);
  if (!s) throw new NotFoundError("Salon");
  return s;
}

const reviewSalonSchema = z
  .object({ salonId: z.uuid(), decision: z.enum(["approve", "reject", "revoke"]), reason: z.string().trim().max(1000).optional() })
  .strict()
  .refine((v) => v.decision === "approve" || (v.reason?.length ?? 0) >= 5, { message: "Reason is required", path: ["reason"] });

/**
 * بررسی درخواست ثبت سالن: تأیید (نمایش عمومی)، رد با دلیل (به مالک نمایش داده می‌شود؛ با ویرایش اطلاعات
 * توسط مالک دوباره «در انتظار» می‌شود) یا لغو تأیید سالن تأییدشده با دلیل.
 */
export async function reviewSalon(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { salonId, decision, reason } = parseInput(reviewSalonSchema, input);
  return db.transaction(async (tx) => {
    const s = await lockSalon(tx, salonId);
    if (!s.isActive) throw new BusinessRuleError("SALON_INACTIVE", "Activate the salon first");
    const patch =
      decision === "approve"
        ? { isVerified: true, rejectionReason: null, reviewedAt: new Date() }
        : { isVerified: false, rejectionReason: reason!, reviewedAt: new Date() };
    const [row] = await tx.update(salons).set(patch).where(eq(salons.id, salonId)).returning();
    await recordAudit(tx, actor, {
      action: `salon.${decision}`,
      targetType: "salon",
      targetId: salonId,
      summary: s.name,
      reason,
      changes: diffFields(s, { isVerified: patch.isVerified, rejectionReason: patch.rejectionReason }),
    });
    const title = decision === "approve" ? `سالن «${s.name}» تأیید شد` : decision === "reject" ? `درخواست ثبت سالن «${s.name}» رد شد` : `تأیید سالن «${s.name}» لغو شد`;
    await notify(tx, s.ownerId, title, decision === "approve" ? "سالن شما اکنون در جستجوی سایت نمایش داده می‌شود." : `دلیل: ${reason}`, { salonId });
    return row!;
  });
}

const salonActiveSchema = z
  .object({ salonId: z.uuid(), isActive: z.boolean(), reason: z.string().trim().max(1000).optional() })
  .strict()
  .refine((v) => v.isActive || (v.reason?.length ?? 0) >= 5, { message: "Reason is required", path: ["reason"] });

/** غیرفعال‌سازی (با دلیل) یا فعال‌سازی دوباره سالن */
export async function setSalonActive(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { salonId, isActive, reason } = parseInput(salonActiveSchema, input);
  return db.transaction(async (tx) => {
    const s = await lockSalon(tx, salonId);
    if (s.isActive === isActive) return s;
    const [row] = await tx.update(salons).set({ isActive }).where(eq(salons.id, salonId)).returning();
    await recordAudit(tx, actor, { action: isActive ? "salon.activate" : "salon.deactivate", targetType: "salon", targetId: salonId, summary: s.name, reason, changes: { isActive: { from: s.isActive, to: isActive } } });
    await notify(tx, s.ownerId, isActive ? `سالن «${s.name}» دوباره فعال شد` : `سالن «${s.name}» غیرفعال شد`, reason ? `دلیل: ${reason}` : null, { salonId });
    return row!;
  });
}

const legacySalonStatusSchema = z.object({ salonId: z.uuid(), isVerified: z.boolean().optional(), isActive: z.boolean().optional() }).strict();

/** سازگاری با فراخوانی‌های قبلی: تغییر مستقیم وضعیت (با ثبت در تاریخچه) */
export async function setSalonStatus(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { salonId, ...data } = parseInput(legacySalonStatusSchema, input);
  return db.transaction(async (tx) => {
    const s = await lockSalon(tx, salonId);
    const patch = { ...data, ...(data.isVerified !== undefined && { reviewedAt: new Date(), ...(data.isVerified && { rejectionReason: null }) }) };
    const [row] = await tx.update(salons).set(patch).where(eq(salons.id, salonId)).returning();
    await recordAudit(tx, actor, { action: "salon.status", targetType: "salon", targetId: salonId, summary: s.name, changes: diffFields(s, data) });
    return row!;
  });
}

const adminSalonEditSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).nullable(),
    phone: z.string().regex(/^0\d{10}$/).nullable(),
    city: z.string().trim().min(2).max(60),
    district: z.string().trim().min(2).max(60).nullable(),
    address: z.string().trim().min(5).max(300),
  })
  .partial()
  .extend({ reason: reasonText })
  .strict();

/** ویرایش اطلاعات سالن توسط مدیر؛ تغییرات فیلدبه‌فیلد با دلیل ثبت و به مالک اطلاع داده می‌شود */
export async function adminUpdateSalon(db: Database, actor: Actor, salonId: string, input: unknown) {
  assertAdmin(actor);
  const { reason, ...data } = parseInput(adminSalonEditSchema, input);
  return db.transaction(async (tx) => {
    const s = await lockSalon(tx, salonId);
    const changes = diffFields(s, data);
    if (Object.keys(changes).length === 0) return s;
    const [row] = await tx.update(salons).set(data).where(eq(salons.id, salonId)).returning();
    await recordAudit(tx, actor, { action: "salon.update", targetType: "salon", targetId: salonId, summary: s.name, reason, changes });
    await notify(tx, s.ownerId, `اطلاعات سالن «${s.name}» توسط مدیریت اصلاح شد`, `دلیل: ${reason}`, { salonId });
    return row!;
  });
}

/** جزئیات کامل سالن برای مدیر */
export async function getSalonDetailAdmin(db: DbOrTx, actor: Actor, salonId: string) {
  assertAdmin(actor);
  if (!uuidOrNull(salonId)) throw new NotFoundError("Salon");
  const [row] = await db
    .select({ salon: salons, ownerName: sql<string>`coalesce(${profiles.fullName}, ${users.name})`, ownerPhone: users.phoneNumber, ownerStatus: profiles.status })
    .from(salons)
    .innerJoin(users, eq(users.id, salons.ownerId))
    .leftJoin(profiles, eq(profiles.userId, salons.ownerId))
    .where(eq(salons.id, salonId))
    .limit(1);
  if (!row) throw new NotFoundError("Salon");
  const [team, salonServices, recent, counts, history] = await Promise.all([
    listSalonTeam(db, salonId),
    listSalonServices(db, salonId),
    listAllBookings(db, actor, { salonId, pageSize: 15 }),
    db.select({ status: bookings.status, n: count() }).from(bookings).where(eq(bookings.salonId, salonId)).groupBy(bookings.status),
    historyFor(db, actor, "salon", salonId),
  ]);
  return { ...row, team, services: salonServices, bookings: recent, bookingCounts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>, history };
}

// ================================================================== آرایشگران

export async function listStylistsAdmin(db: DbOrTx, actor: Actor, q?: string, filter: { status?: string; city?: string } = {}) {
  assertAdmin(actor);
  const cond = [];
  const term = q?.trim();
  if (term) {
    const phone = normalizeIranMobile(term);
    cond.push(or(ilike(stylists.displayName, likeTerm(term)), ilike(stylists.slug, likeTerm(term)), phone ? eq(users.phoneNumber, phone) : sql`false`));
  }
  if (filter.status === "active") cond.push(eq(stylists.isActive, true));
  if (filter.status === "inactive") cond.push(eq(stylists.isActive, false));
  if (filter.city?.trim()) cond.push(ilike(stylists.city, likeTerm(filter.city.trim())));
  return db
    .select({
      id: stylists.id, userId: stylists.userId, name: stylists.displayName, slug: stylists.slug, city: stylists.city, isActive: stylists.isActive, specialties: stylists.specialties,
      acceptsIndependent: stylists.acceptsIndependentBookings, ratingAvg: stylists.ratingAvg, ratingCount: stylists.ratingCount, phone: users.phoneNumber, createdAt: stylists.createdAt,
      salonCount: sql<number>`(select count(*)::int from salon_members sm where sm.user_id = "stylists"."user_id" and sm.status = 'active' and sm.role = 'stylist')`,
    })
    .from(stylists)
    .innerJoin(users, eq(users.id, stylists.userId))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(stylists.createdAt))
    .limit(200);
}

const stylistActiveSchema = z.object({ stylistId: z.uuid(), isActive: z.boolean(), reason: z.string().trim().min(5).max(1000).optional() }).strict();

export async function setStylistActive(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { stylistId, isActive, reason } = parseInput(stylistActiveSchema, input);
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(stylists).where(eq(stylists.id, stylistId)).for("update").limit(1);
    if (!s) throw new NotFoundError("Stylist");
    if (s.isActive === isActive) return s;
    const [row] = await tx.update(stylists).set({ isActive }).where(eq(stylists.id, stylistId)).returning();
    await recordAudit(tx, actor, { action: isActive ? "stylist.activate" : "stylist.deactivate", targetType: "stylist", targetId: stylistId, summary: s.displayName, reason, changes: { isActive: { from: s.isActive, to: isActive } } });
    await notify(tx, s.userId, isActive ? "پروفایل آرایشگری شما فعال شد" : "پروفایل آرایشگری شما غیرفعال شد", reason ? `دلیل: ${reason}` : null, { stylistId });
    return row!;
  });
}

export async function getStylistDetailAdmin(db: DbOrTx, actor: Actor, stylistId: string) {
  assertAdmin(actor);
  if (!uuidOrNull(stylistId)) throw new NotFoundError("Stylist");
  const [row] = await db
    .select({ stylist: stylists, phone: users.phoneNumber, accountStatus: profiles.status, avatarFileId: profiles.avatarFileId })
    .from(stylists)
    .innerJoin(users, eq(users.id, stylists.userId))
    .leftJoin(profiles, eq(profiles.userId, stylists.userId))
    .where(eq(stylists.id, stylistId))
    .limit(1);
  if (!row) throw new NotFoundError("Stylist");
  const [svc, memberships, portfolio, stylistReviews, recent, counts, history] = await Promise.all([
    listStylistServices(db, stylistId),
    listMyMemberships(db, row.stylist.userId),
    listPortfolio(db, { stylistId }, false),
    listReviewsFor(db, { stylistId }, true),
    listAllBookings(db, actor, { stylistId, pageSize: 15 }),
    db.select({ status: bookings.status, n: count() }).from(bookings).where(eq(bookings.stylistId, stylistId)).groupBy(bookings.status),
    historyFor(db, actor, "stylist", stylistId),
  ]);
  return { ...row, services: svc, memberships, portfolio, reviews: stylistReviews, bookings: recent, bookingCounts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>, history };
}

// ================================================================== نوبت‌ها

export const BOOKINGS_PAGE_SIZE = 30;

export interface AdminBookingFilter {
  q?: string;
  status?: string;
  salonId?: string;
  stylistId?: string;
  customerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/**
 * همه نوبت‌ها با فیلتر: کد پیگیری یا نام/موبایل مشتری، وضعیت، سالن، آرایشگر، مشتری، بازه تاریخ نوبت (به وقت تهران).
 */
export async function listAllBookings(db: DbOrTx, actor: Actor, filter: AdminBookingFilter) {
  assertAdmin(actor);
  const cond = [];
  if (filter.status && (bookingStatus.enumValues as readonly string[]).includes(filter.status)) cond.push(eq(bookings.status, filter.status as never));
  const q = filter.q?.trim();
  if (q) {
    const phone = normalizeIranMobile(q);
    cond.push(or(eq(bookings.trackingCode, q.toUpperCase()), phone ? eq(users.phoneNumber, phone) : sql`false`, ilike(profiles.fullName, likeTerm(q))));
  }
  const salonId = uuidOrNull(filter.salonId);
  const stylistId = uuidOrNull(filter.stylistId);
  const customerId = uuidOrNull(filter.customerId);
  if (salonId) cond.push(eq(bookings.salonId, salonId));
  if (stylistId) cond.push(eq(bookings.stylistId, stylistId));
  if (customerId) cond.push(eq(bookings.customerId, customerId));
  if (filter.from && DATE_RE.test(filter.from)) cond.push(gte(bookings.startsAt, tehranDayStart(filter.from)));
  if (filter.to && DATE_RE.test(filter.to)) cond.push(lt(bookings.startsAt, new Date(tehranDayStart(filter.to).getTime() + 86_400_000)));
  const where = cond.length ? and(...cond) : undefined;
  const size = filter.pageSize ?? BOOKINGS_PAGE_SIZE;
  const page = Math.max(1, filter.page ?? 1);
  const base = () =>
    db
      .select({
        id: bookings.id, trackingCode: bookings.trackingCode, status: bookings.status, startsAt: bookings.startsAt, timezone: bookings.timezone,
        serviceName: bookings.serviceName, durationMinutes: bookings.durationMinutes, priceToman: bookings.priceToman, createdAt: bookings.createdAt,
        stylistId: bookings.stylistId, stylistName: stylists.displayName, salonId: bookings.salonId, salonName: salons.name,
        customerId: bookings.customerId, customerName: sql<string>`coalesce(${profiles.fullName}, ${users.name})`, customerPhone: users.phoneNumber,
      })
      .from(bookings)
      .innerJoin(stylists, eq(stylists.id, bookings.stylistId))
      .leftJoin(salons, eq(salons.id, bookings.salonId))
      .innerJoin(users, eq(users.id, bookings.customerId))
      .leftJoin(profiles, eq(profiles.userId, bookings.customerId));
  const [rows, [total]] = await Promise.all([
    base().where(where).orderBy(desc(bookings.startsAt)).limit(size).offset((page - 1) * size),
    db
      .select({ n: count() })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.customerId))
      .leftJoin(profiles, eq(profiles.userId, bookings.customerId))
      .where(where),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export async function getBookingDetailAdmin(db: DbOrTx, actor: Actor, bookingId: string) {
  assertAdmin(actor);
  if (!uuidOrNull(bookingId)) throw new NotFoundError("Booking");
  const [row] = await db
    .select({
      booking: bookings, stylistName: stylists.displayName, stylistSlug: stylists.slug, salonName: salons.name, salonSlug: salons.slug,
      customerName: sql<string>`coalesce(${profiles.fullName}, ${users.name})`, customerPhone: users.phoneNumber,
    })
    .from(bookings)
    .innerJoin(stylists, eq(stylists.id, bookings.stylistId))
    .leftJoin(salons, eq(salons.id, bookings.salonId))
    .innerJoin(users, eq(users.id, bookings.customerId))
    .leftJoin(profiles, eq(profiles.userId, bookings.customerId))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) throw new NotFoundError("Booking");
  const actorProfile = sql<string | null>`(select coalesce(p.full_name, u.name) from users u left join profiles p on p.user_id = u.id where u.id = ${bookingEvents.actorUserId})`;
  const [events, [review], history] = await Promise.all([
    db.select({ id: bookingEvents.id, fromStatus: bookingEvents.fromStatus, toStatus: bookingEvents.toStatus, actorType: bookingEvents.actorType, actorName: actorProfile, note: bookingEvents.note, createdAt: bookingEvents.createdAt })
      .from(bookingEvents).where(eq(bookingEvents.bookingId, bookingId)).orderBy(asc(bookingEvents.createdAt)),
    db.select().from(reviews).where(eq(reviews.bookingId, bookingId)).limit(1),
    historyFor(db, actor, "booking", bookingId),
  ]);
  return { ...row, events, review: review ?? null, history };
}

const bookingActionSchema = z
  .object({ bookingId: z.uuid(), action: z.enum(["cancel", "confirm", "complete", "no_show"]), reason: z.string().trim().max(500).optional() })
  .strict()
  .refine((v) => v.action !== "cancel" || (v.reason?.length ?? 0) >= 5, { message: "Reason is required", path: ["reason"] });

/**
 * اقدام مدیر روی نوبت؛ همه قوانین ماشین وضعیت و زمانی رزرو (همان سرویس نوبت‌ها) اعمال می‌شود.
 * لغو نیازمند دلیل است. تغییر زمان/خدمت نوبت پشتیبانی نمی‌شود (برای جلوگیری از دور زدن بررسی تداخل).
 */
export async function adminBookingAction(db: Database, actor: Actor, input: unknown, clock: { now?: Date } = {}) {
  assertAdmin(actor);
  const { bookingId, action, reason } = parseInput(bookingActionSchema, input);
  const fn = { cancel: cancelBooking, confirm: confirmBooking, complete: completeBooking, no_show: markNoShow }[action];
  const [before] = await db.select({ status: bookings.status, code: bookings.trackingCode }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!before) throw new NotFoundError("Booking");
  // سرویس نوبت تراکنش و قفل سطری خودش را دارد؛ ثبت تاریخچه پس از موفقیت آن انجام می‌شود
  const updated = await fn(db, actor, { bookingId, ...(reason ? { reason } : {}) }, clock);
  await recordAudit(db, actor, { action: `booking.${action}`, targetType: "booking", targetId: bookingId, summary: before.code, reason, changes: { status: { from: before.status, to: updated.status } } });
  return updated;
}

// ================================================================== نظرات

export async function listReviewsAdmin(db: DbOrTx, actor: Actor, filter: { view?: string; rating?: string | number }) {
  assertAdmin(actor);
  const reports = sql<number>`(select count(*)::int from ${supportTickets} t where t.review_id = "reviews"."id" and t.kind = 'review_report' and t.status in ('open','in_progress'))`;
  const cond = [filter.view === "hidden" ? eq(reviews.isHidden, true) : filter.view === "reported" ? sql`${reports} > 0` : undefined];
  const rating = Number(filter.rating);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) cond.push(eq(reviews.rating, rating));
  return db
    .select({
      id: reviews.id, rating: reviews.rating, comment: reviews.comment, reply: reviews.reply, isHidden: reviews.isHidden, hiddenReason: reviews.hiddenReason, createdAt: reviews.createdAt,
      bookingId: reviews.bookingId, stylistId: reviews.stylistId, stylistName: stylists.displayName, salonId: reviews.salonId, salonName: salons.name,
      customerName: sql<string>`coalesce(${profiles.fullName}, 'مشتری')`, reports,
    })
    .from(reviews)
    .innerJoin(stylists, eq(stylists.id, reviews.stylistId))
    .leftJoin(salons, eq(salons.id, reviews.salonId))
    .leftJoin(profiles, eq(profiles.userId, reviews.customerId))
    .where(and(...cond))
    .orderBy(desc(reports), desc(reviews.createdAt))
    .limit(200);
}

/** گزارش‌های باز یک نظر (برای نمایش متن گزارش‌ها به مدیر) */
export async function listOpenReports(db: DbOrTx, actor: Actor, reviewIds: string[]) {
  assertAdmin(actor);
  if (reviewIds.length === 0) return [];
  return db
    .select({ id: supportTickets.id, reviewId: supportTickets.reviewId, name: supportTickets.name, message: supportTickets.message, createdAt: supportTickets.createdAt })
    .from(supportTickets)
    .where(and(eq(supportTickets.kind, "review_report"), inArray(supportTickets.status, ["open", "in_progress"]), inArray(supportTickets.reviewId, reviewIds)))
    .orderBy(asc(supportTickets.createdAt));
}

const moderateSchema = z
  .object({ reviewId: z.uuid(), decision: z.enum(["hide", "show", "dismiss_reports"]), reason: z.string().trim().max(1000).optional() })
  .strict()
  .refine((v) => v.decision === "show" || (v.reason?.length ?? 0) >= 5, { message: "Reason is required", path: ["reason"] });

/**
 * رسیدگی به نظر: مخفی‌سازی با دلیل (گزارش‌های باز «رسیدگی‌شده» می‌شوند)، نمایش دوباره،
 * یا رد گزارش‌ها بدون مخفی‌سازی. امتیاز سالن/آرایشگر دوباره محاسبه و همه چیز در تاریخچه ثبت می‌شود.
 */
export async function moderateReview(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { reviewId, decision, reason } = parseInput(moderateSchema, input);
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(reviews).where(eq(reviews.id, reviewId)).for("update").limit(1);
    if (!r) throw new NotFoundError("Review");
    if (decision !== "dismiss_reports") {
      const hidden = decision === "hide";
      await tx.update(reviews).set({ isHidden: hidden, hiddenReason: hidden ? reason! : null }).where(eq(reviews.id, reviewId));
      await refreshRatings(tx, r.stylistId, r.salonId);
    }
    const open = await tx
      .update(supportTickets)
      .set({ status: decision === "dismiss_reports" ? "closed" : "resolved" })
      .where(and(eq(supportTickets.reviewId, reviewId), eq(supportTickets.kind, "review_report"), inArray(supportTickets.status, ["open", "in_progress"])))
      .returning({ id: supportTickets.id });
    if (open.length && decision !== "show") {
      await tx.insert(supportTicketMessages).values(
        open.map((t) => ({ ticketId: t.id, authorId: actor.userId, kind: "status" as const, body: decision === "hide" ? `نظر مخفی شد. دلیل: ${reason}` : `گزارش رد شد. دلیل: ${reason}` })),
      );
    }
    await recordAudit(tx, actor, {
      action: decision === "hide" ? "review.hide" : decision === "show" ? "review.show" : "review.dismiss_reports",
      targetType: "review",
      targetId: reviewId,
      reason,
      changes: { ...(decision !== "dismiss_reports" && { isHidden: { from: r.isHidden, to: decision === "hide" } }), ...(open.length && { reportsClosed: { from: open.length, to: 0 } }) },
    });
    return { hidden: decision === "dismiss_reports" ? r.isHidden : decision === "hide", reportsClosed: open.length };
  });
}

// ================================================================== دسته‌بندی‌ها

export async function listCategoriesAdmin(db: DbOrTx, actor: Actor) {
  assertAdmin(actor);
  return db
    .select({
      key: serviceCategories.key, label: serviceCategories.label, description: serviceCategories.description, sortOrder: serviceCategories.sortOrder, isActive: serviceCategories.isActive,
      services: sql<number>`(select count(*)::int from ${services} s where s.category = "service_categories"."key")`,
      activeServices: sql<number>`(select count(*)::int from ${services} s where s.category = "service_categories"."key" and s.is_active)`,
      salons: sql<number>`(select count(distinct s.salon_id)::int from ${services} s where s.category = "service_categories"."key" and s.salon_id is not null)`,
      stylists: sql<number>`(select count(distinct ss.stylist_id)::int from ${services} s join ${stylistServices} ss on ss.service_id = s.id where s.category = "service_categories"."key" and ss.is_active)`,
    })
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.label));
}

const categoryFields = {
  label: z.string().trim().min(2).max(60),
  sortOrder: z.number().int().min(0).max(999),
  isActive: z.boolean(),
  description: z.string().trim().max(300).optional(),
};
const categorySchema = z.object({ key: z.string().trim().toLowerCase().regex(CATEGORY_KEY_RE), ...categoryFields }).strict();

/** افزودن دسته‌بندی جدید (کلید لاتین یکتا؛ بعداً قابل تغییر نیست) */
export async function createCategory(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const data = parseInput(categorySchema, input);
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(serviceCategories).values(data).returning();
      await recordAudit(tx, actor, { action: "category.create", targetType: "category", targetId: data.key, summary: data.label });
      return row!;
    });
  } catch (err) {
    if (findPgError(err)?.code === PG.UNIQUE_VIOLATION) throw new ConflictError("CATEGORY_TAKEN", "Category key already exists");
    throw err;
  }
}

export async function updateCategory(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { key, ...data } = parseInput(categorySchema, input);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(serviceCategories).where(eq(serviceCategories.key, key)).for("update").limit(1);
    if (!before) throw new NotFoundError("Category");
    const [row] = await tx.update(serviceCategories).set(data).where(eq(serviceCategories.key, key)).returning();
    const changes = diffFields(before, data);
    if (Object.keys(changes).length) await recordAudit(tx, actor, { action: "category.update", targetType: "category", targetId: key, summary: row!.label, changes });
    return row!;
  });
}

// ================================================================== پلن‌ها

const planSchema = z
  .object({
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(500).optional(),
    audience: z.enum(["salon", "stylist"]),
    priceMonthlyToman: z.number().int().min(0).max(1_000_000_000),
    features: z.array(z.string().trim().min(2).max(120)).max(20).default([]),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(999).default(0),
  })
  .strict();

export async function listPlans(db: DbOrTx, onlyActive: boolean) {
  return db.select().from(subscriptionPlans).where(onlyActive ? eq(subscriptionPlans.isActive, true) : undefined).orderBy(asc(subscriptionPlans.audience), asc(subscriptionPlans.sortOrder));
}

export async function savePlan(db: Database, actor: Actor, input: unknown, planId?: string) {
  assertAdmin(actor);
  const data = parseInput(planSchema, input);
  try {
    return await db.transaction(async (tx) => {
      if (planId) {
        const [before] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).for("update").limit(1);
        if (!before) throw new NotFoundError("Plan");
        const [row] = await tx.update(subscriptionPlans).set(data).where(eq(subscriptionPlans.id, planId)).returning();
        const changes = diffFields(before, data);
        if (Object.keys(changes).length) await recordAudit(tx, actor, { action: "plan.update", targetType: "plan", targetId: planId, summary: row!.name, changes });
        return row!;
      }
      const [row] = await tx.insert(subscriptionPlans).values(data).returning();
      await recordAudit(tx, actor, { action: "plan.create", targetType: "plan", targetId: row!.id, summary: row!.name });
      return row!;
    });
  } catch (err) {
    if (findPgError(err)?.code === PG.UNIQUE_VIOLATION) throw new ConflictError("SLUG_TAKEN", "Plan slug taken");
    throw err;
  }
}

export async function deletePlan(db: Database, actor: Actor, planId: string) {
  assertAdmin(actor);
  await db.transaction(async (tx) => {
    const rows = await tx.delete(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).returning({ id: subscriptionPlans.id, name: subscriptionPlans.name });
    if (rows.length === 0) throw new NotFoundError("Plan");
    await recordAudit(tx, actor, { action: "plan.delete", targetType: "plan", targetId: planId, summary: rows[0]!.name });
  });
}
