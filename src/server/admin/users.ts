import { and, count, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "@/db/client";
import { accountStatus, bookings, profiles, salonMembers, salons, sessions, stylists, userRole, users } from "@/db/schema";
import type { UserRole } from "@/db/types";
import type { Actor } from "../auth/actor";
import { ForbiddenError, NotFoundError } from "../errors";
import { normalizeIranMobile } from "../otp/phone";
import { SUPER_ADMIN_PHONE, SuperAdminProtectedError } from "../profiles/service";
import { parseInput } from "../validation";
import { assertAdmin, historyFor, recordAudit } from "./audit";

export const USERS_PAGE_SIZE = 30;
const likeTerm = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** شروع روز محلی تهران → لحظه مطلق */
const tehranDayStart = (d: string) => new Date(`${d}T00:00:00+03:30`);

const lastActivity = sql<Date | null>`(select max(s.updated_at) from ${sessions} s where s.user_id = "users"."id")`;

export async function listUsers(
  db: DbOrTx,
  actor: Actor,
  filter: { q?: string; role?: string; status?: string; from?: string; to?: string; page?: number },
) {
  assertAdmin(actor);
  const cond = [];
  if (filter.role && (userRole.enumValues as readonly string[]).includes(filter.role)) cond.push(eq(profiles.role, filter.role as UserRole));
  if (filter.status && (accountStatus.enumValues as readonly string[]).includes(filter.status)) cond.push(eq(profiles.status, filter.status as "active" | "suspended"));
  if (filter.from && DATE_RE.test(filter.from)) cond.push(gte(users.createdAt, tehranDayStart(filter.from)));
  if (filter.to && DATE_RE.test(filter.to)) cond.push(lt(users.createdAt, new Date(tehranDayStart(filter.to).getTime() + 86_400_000)));
  const q = filter.q?.trim();
  if (q) {
    const phone = normalizeIranMobile(q);
    cond.push(or(ilike(profiles.fullName, likeTerm(q)), ilike(users.name, likeTerm(q)), phone ? eq(users.phoneNumber, phone) : sql`false`));
  }
  const where = cond.length ? and(...cond) : undefined;
  const page = Math.max(1, filter.page ?? 1);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: sql<string>`coalesce(${profiles.fullName}, ${users.name})`,
        phone: users.phoneNumber,
        role: profiles.role,
        status: profiles.status,
        createdAt: users.createdAt,
        lastActivity,
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(USERS_PAGE_SIZE)
      .offset((page - 1) * USERS_PAGE_SIZE),
    db.select({ n: count() }).from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(where),
  ]);
  return { rows, total: total?.n ?? 0 };
}

/** پروفایل کامل کاربر برای مدیر: حساب، نقش، وضعیت، فعالیت، سالن‌ها، پروفایل آرایشگری، نوبت‌ها و تاریخچه */
export async function getUserDetail(db: DbOrTx, actor: Actor, userId: string) {
  assertAdmin(actor);
  if (!z.uuid().safeParse(userId).success) throw new NotFoundError("User");
  const [row] = await db
    .select({ user: users, profile: profiles, lastActivity, activeSessions: sql<number>`(select count(*)::int from ${sessions} s where s.user_id = "users"."id" and s.expires_at > now())` })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new NotFoundError("User");

  const [stylist, ownedSalons, memberships, customerBookings, bookingCounts, history] = await Promise.all([
    db.select().from(stylists).where(eq(stylists.userId, userId)).limit(1).then((r) => r[0] ?? null),
    db.select({ id: salons.id, name: salons.name, slug: salons.slug, isActive: salons.isActive, isVerified: salons.isVerified, rejectionReason: salons.rejectionReason }).from(salons).where(eq(salons.ownerId, userId)),
    db
      .select({ id: salonMembers.id, role: salonMembers.role, status: salonMembers.status, salonId: salons.id, salonName: salons.name })
      .from(salonMembers)
      .innerJoin(salons, eq(salons.id, salonMembers.salonId))
      .where(and(eq(salonMembers.userId, userId), inArray(salonMembers.status, ["active", "invited", "requested", "suspended"]))),
    db
      .select({ id: bookings.id, trackingCode: bookings.trackingCode, status: bookings.status, startsAt: bookings.startsAt, timezone: bookings.timezone, serviceName: bookings.serviceName, priceToman: bookings.priceToman, stylistName: stylists.displayName, salonName: salons.name })
      .from(bookings)
      .innerJoin(stylists, eq(stylists.id, bookings.stylistId))
      .leftJoin(salons, eq(salons.id, bookings.salonId))
      .where(eq(bookings.customerId, userId))
      .orderBy(desc(bookings.startsAt))
      .limit(20),
    db.select({ status: bookings.status, n: count() }).from(bookings).where(eq(bookings.customerId, userId)).groupBy(bookings.status),
    historyFor(db, actor, "user", userId),
  ]);
  return {
    ...row,
    isSuperAdmin: row.user.phoneNumber === SUPER_ADMIN_PHONE,
    stylist,
    ownedSalons,
    memberships,
    customerBookings,
    bookingCounts: Object.fromEntries(bookingCounts.map((b) => [b.status, b.n])) as Record<string, number>,
    history,
  };
}

async function loadTarget(db: DbOrTx, userId: string) {
  const [t] = await db
    .select({ id: users.id, phone: users.phoneNumber, role: profiles.role, status: profiles.status })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!t) throw new NotFoundError("User");
  return t;
}

const isSuperAdmin = async (db: DbOrTx, actor: Actor) => {
  const [me] = await db.select({ phone: users.phoneNumber }).from(users).where(eq(users.id, actor.userId)).limit(1);
  return me?.phone === SUPER_ADMIN_PHONE;
};

const roleSchema = z.object({ userId: z.uuid(), role: z.enum(userRole.enumValues), reason: z.string().trim().max(500).optional() }).strict();

/**
 * تغییر نقش با کنترل سمت سرور:
 *  - مدیر کل اصلی (۰۹۹۹۱۷۹۷۹۸۲) هرگز تغییر نقش نمی‌دهد؛ هیچ مدیری نقش خودش را تغییر نمی‌دهد.
 *  - اعطا یا سلب نقش «مدیر» فقط توسط مدیر کل اصلی.
 *  - تغییر در تاریخچه مدیریتی ثبت می‌شود.
 */
export async function changeUserRole(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { userId, role, reason } = parseInput(roleSchema, input);
  if (userId === actor.userId) throw new ForbiddenError("Admins cannot change their own role");
  return db.transaction(async (tx) => {
    const target = await loadTarget(tx, userId);
    if (target.phone === SUPER_ADMIN_PHONE) throw new SuperAdminProtectedError();
    if ((role === "admin" || target.role === "admin") && !(await isSuperAdmin(tx, actor))) {
      throw new ForbiddenError("Only the super admin can grant or revoke the admin role");
    }
    if (target.role === role) return { role };
    await tx.update(profiles).set({ role, roleSelectedAt: new Date() }).where(eq(profiles.userId, userId));
    await recordAudit(tx, actor, { action: "user.role_change", targetType: "user", targetId: userId, reason, changes: { role: { from: target.role, to: role } } });
    return { role };
  });
}

const statusSchema = z
  .object({ userId: z.uuid(), status: z.enum(accountStatus.enumValues), reason: z.string().trim().max(500).optional() })
  .strict()
  .refine((v) => v.status !== "suspended" || (v.reason?.length ?? 0) >= 3, { message: "Reason is required", path: ["reason"] });

/**
 * تعلیق/فعال‌سازی حساب.
 * تعلیق: همه نشست‌های کاربر حذف می‌شوند (خروج فوری)، ورود دوباره ممکن نیست و پروفایل آرایشگری فعالش
 * غیرفعال می‌شود تا در سایت نمایش داده نشود. فعال‌سازی: فقط پروفایل آرایشگری‌ای که همین تعلیق غیرفعال کرده بود برمی‌گردد.
 */
export async function setUserStatus(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { userId, status, reason } = parseInput(statusSchema, input);
  if (userId === actor.userId) throw new ForbiddenError("Admins cannot suspend themselves");
  return db.transaction(async (tx) => {
    const target = await loadTarget(tx, userId);
    if (target.phone === SUPER_ADMIN_PHONE) throw new SuperAdminProtectedError();
    if (target.role === "admin" && !(await isSuperAdmin(tx, actor))) throw new ForbiddenError("Only the super admin can suspend an admin");
    if (target.status === status) return { status };

    const changes: Record<string, { from: unknown; to: unknown }> = { status: { from: target.status, to: status } };
    if (status === "suspended") {
      await tx.update(profiles).set({ status, suspendedAt: new Date(), suspendedReason: reason }).where(eq(profiles.userId, userId));
      const ended = await tx.delete(sessions).where(eq(sessions.userId, userId)).returning({ id: sessions.id });
      if (ended.length) changes.sessionsEnded = { from: ended.length, to: 0 };
      const hidden = await tx.update(stylists).set({ isActive: false }).where(and(eq(stylists.userId, userId), eq(stylists.isActive, true))).returning({ id: stylists.id });
      if (hidden.length) changes["stylist.isActive"] = { from: true, to: false };
    } else {
      await tx.update(profiles).set({ status, suspendedAt: null, suspendedReason: null }).where(eq(profiles.userId, userId));
      const [lastSuspend] = await historyFor(tx, actor, "user", userId).then((h) => h.filter((x) => x.action === "user.suspend"));
      if (lastSuspend?.changes && "stylist.isActive" in lastSuspend.changes) {
        await tx.update(stylists).set({ isActive: true }).where(eq(stylists.userId, userId));
        changes["stylist.isActive"] = { from: false, to: true };
      }
    }
    await recordAudit(tx, actor, { action: status === "suspended" ? "user.suspend" : "user.activate", targetType: "user", targetId: userId, reason, changes });
    return { status };
  });
}
