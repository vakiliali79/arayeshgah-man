import { and, asc, count, desc, eq, ilike, inArray, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import {
  bookings, profiles, reviews, salons, serviceCategories, serviceCategory, stylists, subscriptionPlans, supportTickets, users, userRole, bookingStatus,
} from "@/db/schema";
import type { Actor } from "../auth/actor";
import { ConflictError, ForbiddenError, NotFoundError, PG, findPgError } from "../errors";
import { normalizeIranMobile } from "../otp/phone";
import { parseInput } from "../validation";

export function assertAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new ForbiddenError();
}

const likeTerm = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

/** آمار کلی پلتفرم (همه از داده واقعی) */
export async function getPlatformStats(db: DbOrTx, actor: Actor) {
  assertAdmin(actor);
  const roles = await db.select({ role: profiles.role, n: count() }).from(profiles).groupBy(profiles.role);
  const [salonAgg] = await db
    .select({
      total: count(),
      verified: sql<number>`count(*) filter (where ${salons.isVerified} and ${salons.isActive})::int`,
      pending: sql<number>`count(*) filter (where not ${salons.isVerified} and ${salons.isActive})::int`,
      inactive: sql<number>`count(*) filter (where not ${salons.isActive})::int`,
    })
    .from(salons);
  const [stylistAgg] = await db.select({ n: count() }).from(stylists);
  const byStatus = await db.select({ status: bookings.status, n: count() }).from(bookings).groupBy(bookings.status);
  const [rev] = await db.select({ total: sum(bookings.priceToman) }).from(bookings).where(eq(bookings.status, "completed"));
  const [openTickets] = await db.select({ n: count() }).from(supportTickets).where(inArray(supportTickets.status, ["open", "in_progress"]));
  const [reportedReviews] = await db.select({ n: count() }).from(supportTickets).where(and(eq(supportTickets.kind, "review_report"), eq(supportTickets.status, "open")));
  const monthly = await db
    .select({ month: sql<string>`to_char(${bookings.createdAt} at time zone 'Asia/Tehran', 'YYYY-MM')`, n: count() })
    .from(bookings)
    .where(sql`${bookings.createdAt} > now() - interval '180 days'`)
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const roleCounts = Object.fromEntries(roles.map((r) => [r.role, r.n])) as Record<string, number>;
  return {
    users: roles.reduce((a, r) => a + r.n, 0),
    roles: roleCounts,
    salons: { total: salonAgg?.total ?? 0, verified: salonAgg?.verified ?? 0, pending: salonAgg?.pending ?? 0, inactive: salonAgg?.inactive ?? 0 },
    stylists: stylistAgg?.n ?? 0,
    bookings: Object.fromEntries(byStatus.map((b) => [b.status, b.n])) as Record<string, number>,
    revenue: Number(rev?.total ?? 0),
    openTickets: openTickets?.n ?? 0,
    reportedReviews: reportedReviews?.n ?? 0,
    monthly,
  };
}

export async function listUsers(db: DbOrTx, actor: Actor, filter: { q?: string; role?: string; page?: number }) {
  assertAdmin(actor);
  const cond = [];
  if (filter.role && (userRole.enumValues as readonly string[]).includes(filter.role)) cond.push(eq(profiles.role, filter.role as never));
  const q = filter.q?.trim();
  if (q) {
    const phone = normalizeIranMobile(q);
    cond.push(or(ilike(profiles.fullName, likeTerm(q)), ilike(users.name, likeTerm(q)), phone ? eq(users.phoneNumber, phone) : sql`false`));
  }
  const page = Math.max(1, filter.page ?? 1);
  return db
    .select({ id: users.id, name: sql<string>`coalesce(${profiles.fullName}, ${users.name})`, phone: users.phoneNumber, role: profiles.role, createdAt: users.createdAt })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(50)
    .offset((page - 1) * 50);
}

export async function listSalonsAdmin(db: DbOrTx, actor: Actor, filter: { status?: string; q?: string }) {
  assertAdmin(actor);
  const cond = [];
  if (filter.status === "pending") cond.push(and(eq(salons.isVerified, false), eq(salons.isActive, true)));
  if (filter.status === "verified") cond.push(and(eq(salons.isVerified, true), eq(salons.isActive, true)));
  if (filter.status === "inactive") cond.push(eq(salons.isActive, false));
  if (filter.q?.trim()) cond.push(or(ilike(salons.name, likeTerm(filter.q.trim())), ilike(salons.city, likeTerm(filter.q.trim()))));
  return db
    .select({ id: salons.id, name: salons.name, slug: salons.slug, city: salons.city, district: salons.district, isActive: salons.isActive, isVerified: salons.isVerified, createdAt: salons.createdAt, ownerName: sql<string>`coalesce(${profiles.fullName}, ${users.name})`, ownerPhone: users.phoneNumber })
    .from(salons)
    .innerJoin(users, eq(users.id, salons.ownerId))
    .leftJoin(profiles, eq(profiles.userId, salons.ownerId))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(salons.createdAt))
    .limit(200);
}

const salonStatusSchema = z.object({ salonId: z.uuid(), isVerified: z.boolean().optional(), isActive: z.boolean().optional() }).strict();

/** تأیید/رد/غیرفعال‌سازی سالن — سالن فقط پس از تأیید در جستجوی عمومی دیده می‌شود */
export async function setSalonStatus(db: DbOrTx, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { salonId, ...data } = parseInput(salonStatusSchema, input);
  const [row] = await db.update(salons).set(data).where(eq(salons.id, salonId)).returning();
  if (!row) throw new NotFoundError("Salon");
  return row;
}

export async function listStylistsAdmin(db: DbOrTx, actor: Actor, q?: string) {
  assertAdmin(actor);
  return db
    .select({ id: stylists.id, name: stylists.displayName, slug: stylists.slug, city: stylists.city, isActive: stylists.isActive, ratingAvg: stylists.ratingAvg, ratingCount: stylists.ratingCount, phone: users.phoneNumber, createdAt: stylists.createdAt })
    .from(stylists)
    .innerJoin(users, eq(users.id, stylists.userId))
    .where(q?.trim() ? ilike(stylists.displayName, likeTerm(q.trim())) : undefined)
    .orderBy(desc(stylists.createdAt))
    .limit(200);
}

export async function setStylistActive(db: DbOrTx, actor: Actor, input: { stylistId: string; isActive: boolean }) {
  assertAdmin(actor);
  const [row] = await db.update(stylists).set({ isActive: input.isActive }).where(eq(stylists.id, input.stylistId)).returning();
  if (!row) throw new NotFoundError("Stylist");
  return row;
}

export async function listAllBookings(db: DbOrTx, actor: Actor, filter: { status?: string; q?: string }) {
  assertAdmin(actor);
  const cond = [];
  if (filter.status && (bookingStatus.enumValues as readonly string[]).includes(filter.status)) cond.push(eq(bookings.status, filter.status as never));
  if (filter.q?.trim()) cond.push(eq(bookings.trackingCode, filter.q.trim().toUpperCase()));
  return db
    .select({
      id: bookings.id, trackingCode: bookings.trackingCode, status: bookings.status, startsAt: bookings.startsAt, timezone: bookings.timezone,
      serviceName: bookings.serviceName, durationMinutes: bookings.durationMinutes, priceToman: bookings.priceToman,
      stylistName: stylists.displayName, salonName: salons.name, customerName: sql<string>`coalesce(${profiles.fullName}, ${users.name})`,
    })
    .from(bookings)
    .innerJoin(stylists, eq(stylists.id, bookings.stylistId))
    .leftJoin(salons, eq(salons.id, bookings.salonId))
    .innerJoin(users, eq(users.id, bookings.customerId))
    .leftJoin(profiles, eq(profiles.userId, bookings.customerId))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(bookings.startsAt))
    .limit(200);
}

/** نظرات برای مدیریت؛ گزارش‌شده‌ها با تعداد گزارش باز */
export async function listReviewsAdmin(db: DbOrTx, actor: Actor, filter: { view?: string }) {
  assertAdmin(actor);
  const reports = sql<number>`(select count(*)::int from ${supportTickets} t where t.review_id = ${reviews.id} and t.kind = 'review_report' and t.status in ('open','in_progress'))`;
  const cond = filter.view === "hidden" ? eq(reviews.isHidden, true) : filter.view === "reported" ? sql`${reports} > 0` : undefined;
  return db
    .select({
      id: reviews.id, rating: reviews.rating, comment: reviews.comment, reply: reviews.reply, isHidden: reviews.isHidden, createdAt: reviews.createdAt,
      stylistName: stylists.displayName, salonName: salons.name, customerName: sql<string>`coalesce(${profiles.fullName}, 'مشتری')`, reports,
    })
    .from(reviews)
    .innerJoin(stylists, eq(stylists.id, reviews.stylistId))
    .leftJoin(salons, eq(salons.id, reviews.salonId))
    .leftJoin(profiles, eq(profiles.userId, reviews.customerId))
    .where(cond)
    .orderBy(desc(reports), desc(reviews.createdAt))
    .limit(200);
}

const categorySchema = z
  .object({ key: z.enum(serviceCategory.enumValues), label: z.string().trim().min(2).max(60), sortOrder: z.number().int().min(0).max(999), isActive: z.boolean(), description: z.string().trim().max(300).optional() })
  .strict();

export async function updateCategory(db: DbOrTx, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { key, ...data } = parseInput(categorySchema, input);
  const [row] = await db.update(serviceCategories).set(data).where(eq(serviceCategories.key, key)).returning();
  if (!row) throw new NotFoundError("Category");
  return row;
}

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

export async function savePlan(db: DbOrTx, actor: Actor, input: unknown, planId?: string) {
  assertAdmin(actor);
  const data = parseInput(planSchema, input);
  try {
    if (planId) {
      const [row] = await db.update(subscriptionPlans).set(data).where(eq(subscriptionPlans.id, planId)).returning();
      if (!row) throw new NotFoundError("Plan");
      return row;
    }
    const [row] = await db.insert(subscriptionPlans).values(data).returning();
    return row!;
  } catch (err) {
    if (findPgError(err)?.code === PG.UNIQUE_VIOLATION) throw new ConflictError("SLUG_TAKEN", "Plan slug taken");
    throw err;
  }
}

export async function deletePlan(db: DbOrTx, actor: Actor, planId: string) {
  assertAdmin(actor);
  const rows = await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).returning({ id: subscriptionPlans.id });
  if (rows.length === 0) throw new NotFoundError("Plan");
}
