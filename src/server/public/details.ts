import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { profiles, salonMembers, salons, serviceCategories, services, stylistServices, stylists, workingHours } from "@/db/schema";
import { localDateKey } from "@/lib/format/datetime";
import { listPortfolio } from "../portfolio/service";
import { listReviewsFor } from "../stylists/dashboard";
import { getAvailableSlots, resolveBookingContext, type BookingContext } from "./slots";
import { salonIsPublic, stylistIsPublic } from "./visibility";

/**
 * «ارائه قابل رزرو»: یک خدمت فعال که یک آرایشگر فعال در یک محل معتبر ارائه می‌دهد.
 * همان قواعد resolveBookingContext / createBooking:
 *  - خدمت سالن: سالن فعال و تأییدشده و آرایشگر عضو فعال آن
 *  - خدمت مستقل: متعلق به خود آرایشگر و پذیرش نوبت مستقل فعال
 */
const bookableOffering = sql`(
  case when ${services.salonId} is not null then
    "salons"."is_active" and "salons"."is_verified" and exists (
      select 1 from salon_members sm where sm.salon_id = "services"."salon_id" and sm.user_id = "stylists"."user_id"
        and sm.status = 'active' and sm.role = 'stylist')
  else "services"."stylist_id" = "stylists"."id" and "stylists"."accepts_independent_bookings" end)`;

export async function listOfferings(db: DbOrTx, where: SQL) {
  return db
    .select({
      serviceId: services.id,
      serviceName: services.name,
      description: services.description,
      category: services.category,
      categoryLabel: serviceCategories.label,
      durationMinutes: sql<number>`coalesce(${stylistServices.customDurationMinutes}, ${services.durationMinutes})`.mapWith(Number),
      priceToman: sql<number>`coalesce(${stylistServices.customPriceToman}, ${services.priceToman})`.mapWith(Number),
      stylistId: stylists.id,
      stylistName: stylists.displayName,
      stylistSlug: stylists.slug,
      salonId: salons.id,
      salonName: salons.name,
      salonSlug: salons.slug,
    })
    .from(stylistServices)
    .innerJoin(stylists, eq(stylists.id, stylistServices.stylistId))
    .innerJoin(services, eq(services.id, stylistServices.serviceId))
    .leftJoin(salons, eq(salons.id, services.salonId))
    .leftJoin(serviceCategories, eq(serviceCategories.key, services.category))
    .where(and(eq(stylistServices.isActive, true), eq(services.isActive, true), eq(stylists.isActive, true), bookableOffering, where))
    .orderBy(asc(services.sortOrder), asc(services.name), asc(stylists.displayName));
}
export type Offering = Awaited<ReturnType<typeof listOfferings>>[number];

/** نزدیک‌ترین زمان‌های آزاد (روز به روز تا `days` روز آینده) */
export async function findNextSlots(db: DbOrTx, ctx: BookingContext, opts: { now: Date; limit?: number; days?: number; customerId?: string }) {
  const limit = opts.limit ?? 4;
  const out: Date[] = [];
  for (let i = 0; i < (opts.days ?? 7) && out.length < limit; i++) {
    const day = localDateKey(new Date(opts.now.getTime() + i * 86_400_000), ctx.timezone);
    out.push(...(await getAvailableSlots(db, ctx, day, { now: opts.now, customerId: opts.customerId })));
  }
  return out.slice(0, limit);
}

/** کوتاه‌ترین خدمت هر (آرایشگر، محل) — مبنای «نزدیک‌ترین زمان آزاد» */
function shortestPerLocation(offerings: Offering[]) {
  const best = new Map<string, Offering>();
  for (const o of offerings) {
    const k = `${o.stylistId}:${o.salonId ?? "-"}`;
    const cur = best.get(k);
    if (!cur || o.durationMinutes < cur.durationMinutes) best.set(k, o);
  }
  return [...best.values()];
}

export interface NextAvailability {
  stylistId: string;
  stylistName: string;
  stylistSlug: string;
  salonName: string | null;
  serviceId: string;
  serviceName: string;
  timezone: string;
  slots: Date[];
}

async function nextAvailability(db: DbOrTx, offerings: Offering[], now: Date, perLocation: number): Promise<NextAvailability[]> {
  const result = await Promise.all(
    shortestPerLocation(offerings).slice(0, 8).map(async (o) => {
      const ctx = await resolveBookingContext(db, o.stylistId, o.serviceId);
      if (!ctx) return null;
      const slots = await findNextSlots(db, ctx, { now, limit: perLocation });
      return { stylistId: o.stylistId, stylistName: o.stylistName, stylistSlug: o.stylistSlug, salonName: o.salonName, serviceId: o.serviceId, serviceName: o.serviceName, timezone: ctx.timezone, slots };
    }),
  );
  return result.filter((r): r is NextAvailability => r !== null);
}

/** صفحه عمومی سالن؛ سالن غیرفعال یا تأییدنشده ← null */
export async function getPublicSalon(db: DbOrTx, slug: string, now: Date) {
  const [salon] = await db.select().from(salons).where(and(eq(salons.slug, slug), salonIsPublic)).limit(1);
  if (!salon) return null;
  const [offerings, team, hours, portfolio, reviews] = await Promise.all([
    listOfferings(db, eq(services.salonId, salon.id)),
    db
      .select({ id: stylists.id, name: stylists.displayName, slug: stylists.slug, specialties: stylists.specialties, ratingAvg: stylists.ratingAvg, ratingCount: stylists.ratingCount, avatarFileId: profiles.avatarFileId })
      .from(salonMembers)
      .innerJoin(stylists, eq(stylists.userId, salonMembers.userId))
      .leftJoin(profiles, eq(profiles.userId, stylists.userId))
      .where(and(eq(salonMembers.salonId, salon.id), eq(salonMembers.status, "active"), eq(salonMembers.role, "stylist"), eq(stylists.isActive, true)))
      .orderBy(asc(stylists.displayName)),
    db
      .select({ dayOfWeek: workingHours.dayOfWeek, opensAt: workingHours.opensAt, closesAt: workingHours.closesAt })
      .from(workingHours)
      .where(and(eq(workingHours.salonId, salon.id), isNull(workingHours.stylistId)))
      .orderBy(asc(workingHours.opensAt)),
    listPortfolio(db, { salonId: salon.id }),
    listReviewsFor(db, { salonId: salon.id }, false),
  ]);
  const availability = await nextAvailability(db, offerings, now, 3);
  return { salon, offerings, team, hours, portfolio, reviews, availability };
}

/** صفحه عمومی آرایشگر؛ آرایشگر غیرعمومی ← null */
export async function getPublicStylist(db: DbOrTx, slug: string, now: Date) {
  const [stylist] = await db
    .select({ st: stylists, avatarFileId: profiles.avatarFileId })
    .from(stylists)
    .leftJoin(profiles, eq(profiles.userId, stylists.userId))
    .where(and(eq(stylists.slug, slug), stylistIsPublic))
    .limit(1);
  if (!stylist) return null;
  const st = stylist.st;
  const [offerings, memberSalons, hours, portfolio, reviews] = await Promise.all([
    listOfferings(db, eq(stylists.id, st.id)),
    // همه سالن‌های عمومی که آرایشگر عضو فعال آن‌هاست
    db
      .select({ id: salons.id, name: salons.name, slug: salons.slug, city: salons.city, district: salons.district, ratingAvg: salons.ratingAvg, ratingCount: salons.ratingCount, coverFileId: salons.coverFileId })
      .from(salonMembers)
      .innerJoin(salons, eq(salons.id, salonMembers.salonId))
      .where(and(eq(salonMembers.userId, st.userId), eq(salonMembers.status, "active"), eq(salonMembers.role, "stylist"), salonIsPublic))
      .orderBy(asc(salons.name)),
    db
      .select({ salonId: workingHours.salonId, dayOfWeek: workingHours.dayOfWeek, opensAt: workingHours.opensAt, closesAt: workingHours.closesAt })
      .from(workingHours)
      .where(eq(workingHours.stylistId, st.id))
      .orderBy(asc(workingHours.opensAt)),
    listPortfolio(db, { stylistId: st.id }),
    listReviewsFor(db, { stylistId: st.id }, false),
  ]);
  // ساعات فقط برای محل‌هایی که قابل رزروند (سالن عمومی یا مستقل فعال)
  const visibleSalonIds = new Set(memberSalons.map((s) => s.id));
  const visibleHours = hours.filter((h) => (h.salonId ? visibleSalonIds.has(h.salonId) : st.acceptsIndependentBookings));
  const availability = await nextAvailability(db, offerings, now, 4);
  return { stylist: st, avatarFileId: stylist.avatarFileId, offerings, salons: memberSalons, hours: visibleHours, portfolio, reviews, availability };
}
