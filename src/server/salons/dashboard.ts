import { and, asc, count, desc, eq, gte, inArray, isNull, sql, sum } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { bookings, profiles, salonMembers, salons, services, stylistServices, stylists, users, workingHours, workingTimeOff } from "@/db/schema";
import { NotFoundError } from "../errors";
import { providerBookingsQuery, providerTabWhere, type ProviderBookingTab } from "../stylists/dashboard";

export async function getSalon(db: DbOrTx, salonId: string) {
  const [row] = await db.select().from(salons).where(eq(salons.id, salonId)).limit(1);
  if (!row) throw new NotFoundError("Salon");
  return row;
}

/** آرایشگران فعال سالن (برای تخصیص خدمت و شیفت) */
export async function listSalonStylists(db: DbOrTx, salonId: string) {
  return db
    .select({ stylistId: stylists.id, name: stylists.displayName, slug: stylists.slug, userId: stylists.userId })
    .from(salonMembers)
    .innerJoin(stylists, eq(stylists.userId, salonMembers.userId))
    .where(and(eq(salonMembers.salonId, salonId), eq(salonMembers.status, "active"), eq(salonMembers.role, "stylist")))
    .orderBy(asc(stylists.displayName));
}

/** خدمات سالن + آرایشگران ارائه‌دهنده هر خدمت (با قیمت اختصاصی) */
export async function listSalonServices(db: DbOrTx, salonId: string) {
  const rows = await db.select().from(services).where(eq(services.salonId, salonId)).orderBy(asc(services.sortOrder), asc(services.name));
  const assignments = rows.length
    ? await db
        .select({ serviceId: stylistServices.serviceId, stylistId: stylists.id, name: stylists.displayName, customPrice: stylistServices.customPriceToman, customDuration: stylistServices.customDurationMinutes, isActive: stylistServices.isActive })
        .from(stylistServices)
        .innerJoin(stylists, eq(stylists.id, stylistServices.stylistId))
        .where(inArray(stylistServices.serviceId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => ({ ...r, stylists: assignments.filter((a) => a.serviceId === r.id) }));
}

export async function listSalonTeam(db: DbOrTx, salonId: string) {
  return db
    .select({
      id: salonMembers.id,
      userId: salonMembers.userId,
      role: salonMembers.role,
      status: salonMembers.status,
      permissions: salonMembers.permissions,
      joinedAt: salonMembers.joinedAt,
      name: sql<string>`coalesce(${profiles.fullName}, ${users.name})`,
      phone: users.phoneNumber,
      stylistSlug: stylists.slug,
    })
    .from(salonMembers)
    .innerJoin(users, eq(users.id, salonMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, salonMembers.userId))
    .leftJoin(stylists, eq(stylists.userId, salonMembers.userId))
    .where(and(eq(salonMembers.salonId, salonId), inArray(salonMembers.status, ["active", "invited", "requested", "suspended"])))
    .orderBy(asc(salonMembers.createdAt));
}

export async function listSalonSchedule(db: DbOrTx, salonId: string) {
  const hours = await db
    .select({ id: workingHours.id, stylistId: workingHours.stylistId, stylistName: stylists.displayName, dayOfWeek: workingHours.dayOfWeek, opensAt: workingHours.opensAt, closesAt: workingHours.closesAt })
    .from(workingHours)
    .leftJoin(stylists, eq(stylists.id, workingHours.stylistId))
    .where(eq(workingHours.salonId, salonId))
    .orderBy(asc(workingHours.dayOfWeek), asc(workingHours.opensAt));
  const timeOff = await db
    .select({ id: workingTimeOff.id, stylistId: workingTimeOff.stylistId, stylistName: stylists.displayName, startsAt: workingTimeOff.startsAt, endsAt: workingTimeOff.endsAt, reason: workingTimeOff.reason })
    .from(workingTimeOff)
    .leftJoin(stylists, eq(stylists.id, workingTimeOff.stylistId))
    .where(and(eq(workingTimeOff.salonId, salonId), gte(workingTimeOff.endsAt, new Date(Date.now() - 86_400_000))))
    .orderBy(asc(workingTimeOff.startsAt));
  return { salonHours: hours.filter((h) => !h.stylistId), stylistHours: hours.filter((h) => h.stylistId), timeOff };
}

export async function listSalonBookingsByTab(db: DbOrTx, salonId: string, tab: ProviderBookingTab, now = new Date()) {
  return providerBookingsQuery(db)
    .where(and(eq(bookings.salonId, salonId), providerTabWhere(tab, now)))
    .orderBy(tab === "past" || tab === "cancelled" ? desc(bookings.startsAt) : asc(bookings.startsAt))
    .limit(150);
}

/** گزارش سالن — درآمد فقط از نوبت‌های انجام‌شده؛ ماه‌ها بر اساس تقویم شمسی و منطقه زمانی سالن */
export async function getSalonReport(db: DbOrTx, salonId: string, now = new Date()) {
  const salon = await getSalon(db, salonId);
  const byStatus = await db.select({ status: bookings.status, n: count() }).from(bookings).where(eq(bookings.salonId, salonId)).groupBy(bookings.status);
  const [total] = await db.select({ revenue: sum(bookings.priceToman), n: count() }).from(bookings).where(and(eq(bookings.salonId, salonId), eq(bookings.status, "completed")));
  const since = new Date(now.getTime() - 180 * 86_400_000);
  const monthly = await db
    .select({
      month: sql<string>`to_char(${bookings.startsAt} at time zone ${salon.timezone}, 'YYYY-MM')`,
      bookings: count(),
      revenue: sql<string>`coalesce(sum(${bookings.priceToman}) filter (where ${bookings.status} = 'completed'), 0)`,
    })
    .from(bookings)
    .where(and(eq(bookings.salonId, salonId), gte(bookings.startsAt, since)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const topServices = await db
    .select({ name: bookings.serviceName, n: count() })
    .from(bookings)
    .where(and(eq(bookings.salonId, salonId), inArray(bookings.status, ["completed", "confirmed", "pending"])))
    .groupBy(bookings.serviceName)
    .orderBy(desc(count()))
    .limit(5);
  const byStylist = await db
    .select({ name: stylists.displayName, n: count(), revenue: sql<string>`coalesce(sum(${bookings.priceToman}) filter (where ${bookings.status} = 'completed'), 0)` })
    .from(bookings)
    .innerJoin(stylists, eq(stylists.id, bookings.stylistId))
    .where(eq(bookings.salonId, salonId))
    .groupBy(stylists.displayName)
    .orderBy(desc(count()));
  const status = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Record<string, number>;
  return {
    status,
    completed: total?.n ?? 0,
    revenue: Number(total?.revenue ?? 0),
    monthly: monthly.map((m) => ({ month: m.month, bookings: m.bookings, revenue: Number(m.revenue) })),
    topServices,
    byStylist: byStylist.map((s) => ({ ...s, revenue: Number(s.revenue) })),
  };
}

/** نشانی صفحه عمومی آرایشگران سالن (برای لینک‌ها) */
export async function hasPendingRequests(db: DbOrTx, salonId: string) {
  const [r] = await db.select({ n: count() }).from(salonMembers).where(and(eq(salonMembers.salonId, salonId), eq(salonMembers.status, "requested")));
  return r?.n ?? 0;
}

export const salonClosureFilter = (salonId: string) => and(eq(workingTimeOff.salonId, salonId), isNull(workingTimeOff.stylistId));
