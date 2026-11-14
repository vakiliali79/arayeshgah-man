import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { adminAuditLogs, bookings, notifications, profiles, reviews, salons, sessions, stylists, supportTickets, users } from "@/db/schema";
import { listAuditLogs } from "@/server/admin/audit";
import {
  adminBookingAction, adminUpdateSalon, createCategory, getSalonDetailAdmin, listAllBookings, listCategoriesAdmin, listSalonsAdmin, moderateReview, reviewSalon, salonStatusCounts,
  setSalonActive, updateCategory,
} from "@/server/admin/service";
import { parseRange } from "@/server/admin/stats";
import { changeUserRole, getUserDetail, setUserStatus } from "@/server/admin/users";
import { completeBooking, confirmBooking, createBooking } from "@/server/bookings/service";
import { createService, updateService } from "@/server/catalog/service";
import { BusinessRuleError, ConflictError, ForbiddenError, ValidationError } from "@/server/errors";
import { getPublicSalon } from "@/server/public/details";
import { SUPER_ADMIN_PHONE } from "@/server/profiles/service";
import { createReview } from "@/server/reviews/service";
import { updateSalon } from "@/server/salons/service";
import { addTicketMessage, createTicket, getTicketDetail, listMyTickets, reportReview, setTicketStatus } from "@/server/support/service";
import { NOW, SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);
const after = (iso: string, minutes: number) => ({ now: new Date(new Date(iso).getTime() + minutes * 60_000) });

async function superAdmin() {
  const a = await makeUser(db, "admin", "مدیر کل");
  await db.update(users).set({ phoneNumber: SUPER_ADMIN_PHONE }).where(eq(users.id, a.userId));
  return a;
}
async function addSession(userId: string) {
  await db.insert(sessions).values({ userId, token: randomUUID(), expiresAt: new Date(Date.now() + 86_400_000), updatedAt: new Date() });
}
const audit = async (targetId: string) => (await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.targetId, targetId))).map((r) => r.action);

describe("admin audit log", () => {
  beforeEach(() => resetDb(db));

  it("is append-only at the database level", async () => {
    const admin = await makeUser(db, "admin");
    const s = await makeSalonScenario(db);
    await reviewSalon(db, admin, { salonId: s.salon.id, decision: "approve" });
    await expect(db.update(adminAuditLogs).set({ reason: "دستکاری" })).rejects.toThrow();
    await expect(db.delete(adminAuditLogs)).rejects.toThrow();
    // حذف مدیر، فقط actor را null می‌کند و ردیف باقی می‌ماند
    await db.delete(users).where(eq(users.id, admin.userId));
    const [row] = await db.select().from(adminAuditLogs);
    expect(row).toMatchObject({ action: "salon.approve", actorId: null });
  });
});

describe("user management", () => {
  beforeEach(() => resetDb(db));

  it("role changes: super admin and self are protected; only the super admin grants or revokes admin; changes are audited", async () => {
    const root = await superAdmin();
    const admin = await makeUser(db, "admin", "مدیر عادی");
    const u = await makeUser(db, "customer", "کاربر");
    await expect(changeUserRole(db, admin, { userId: root.userId, role: "customer" })).rejects.toMatchObject({ code: "SUPER_ADMIN_PROTECTED" });
    await expect(changeUserRole(db, root, { userId: root.userId, role: "customer" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeUserRole(db, admin, { userId: admin.userId, role: "customer" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeUserRole(db, admin, { userId: u.userId, role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeUserRole(db, u, { userId: admin.userId, role: "customer" })).rejects.toBeInstanceOf(ForbiddenError);

    await expect(changeUserRole(db, admin, { userId: u.userId, role: "stylist", reason: "درخواست کاربر" })).resolves.toEqual({ role: "stylist" });
    await expect(changeUserRole(db, root, { userId: u.userId, role: "admin" })).resolves.toEqual({ role: "admin" });
    await expect(changeUserRole(db, admin, { userId: u.userId, role: "customer" })).rejects.toBeInstanceOf(ForbiddenError); // سلب admin
    const { rows } = await listAuditLogs(db, admin, { targetType: "user", targetId: u.userId });
    expect(rows.map((r) => [r.action, r.changes.role?.to])).toEqual([["user.role_change", "admin"], ["user.role_change", "stylist"]]);
    expect(rows[1]).toMatchObject({ reason: "درخواست کاربر", actorName: "مدیر عادی" });
  });

  it("suspension ends all sessions, hides the stylist profile and is reversed only for what it changed", async () => {
    const root = await superAdmin();
    const admin = await makeUser(db, "admin");
    const s = await makeSalonScenario(db);
    await db.update(salons).set({ isVerified: true }).where(eq(salons.id, s.salon.id));
    await addSession(s.stylistUser.userId);
    await addSession(s.stylistUser.userId);

    await expect(setUserStatus(db, admin, { userId: s.stylistUser.userId, status: "suspended" })).rejects.toBeInstanceOf(ValidationError); // دلیل لازم است
    await expect(setUserStatus(db, admin, { userId: root.userId, status: "suspended", reason: "تست تعلیق" })).rejects.toMatchObject({ code: "SUPER_ADMIN_PROTECTED" });
    await expect(setUserStatus(db, admin, { userId: admin.userId, status: "suspended", reason: "تست تعلیق" })).rejects.toBeInstanceOf(ForbiddenError);
    const otherAdmin = await makeUser(db, "admin");
    await expect(setUserStatus(db, admin, { userId: otherAdmin.userId, status: "suspended", reason: "تست تعلیق" })).rejects.toBeInstanceOf(ForbiddenError);

    await setUserStatus(db, admin, { userId: s.stylistUser.userId, status: "suspended", reason: "تخلف در قوانین" });
    expect(await db.select().from(sessions).where(eq(sessions.userId, s.stylistUser.userId))).toHaveLength(0);
    const [p] = await db.select().from(profiles).where(eq(profiles.userId, s.stylistUser.userId));
    expect(p).toMatchObject({ status: "suspended", suspendedReason: "تخلف در قوانین" });
    expect((await getPublicSalon(db, s.salon.slug, NOW))!.team).toHaveLength(0);

    await setUserStatus(db, admin, { userId: s.stylistUser.userId, status: "active" });
    const [st] = await db.select().from(stylists).where(eq(stylists.id, s.stylist.id));
    expect(st!.isActive).toBe(true);
    expect((await getPublicSalon(db, s.salon.slug, NOW))!.team).toHaveLength(1);

    // آرایشگری که قبل از تعلیق، جداگانه غیرفعال بوده، با فعال‌سازی حساب فعال نمی‌شود
    await db.update(stylists).set({ isActive: false }).where(eq(stylists.id, s.stylist.id));
    await setUserStatus(db, admin, { userId: s.stylistUser.userId, status: "suspended", reason: "تعلیق دوباره" });
    await setUserStatus(db, admin, { userId: s.stylistUser.userId, status: "active" });
    const [st2] = await db.select().from(stylists).where(eq(stylists.id, s.stylist.id));
    expect(st2!.isActive).toBe(false);

    const d = await getUserDetail(db, admin, s.stylistUser.userId);
    expect(d.history.map((h) => h.action)).toEqual(["user.activate", "user.suspend", "user.activate", "user.suspend"]);
    expect(d.stylist?.id).toBe(s.stylist.id);
    expect(d.memberships.map((m) => m.salonId)).toEqual([s.salon.id]);
  });
});

describe("salon review", () => {
  beforeEach(() => resetDb(db));

  it("reject with a reason → owner sees it and is notified → owner edit resubmits → approve makes it public", async () => {
    const admin = await makeUser(db, "admin");
    const s = await makeSalonScenario(db);
    await expect(reviewSalon(db, admin, { salonId: s.salon.id, decision: "reject" })).rejects.toBeInstanceOf(ValidationError);
    await expect(reviewSalon(db, s.owner, { salonId: s.salon.id, decision: "approve" })).rejects.toBeInstanceOf(ForbiddenError);

    await reviewSalon(db, admin, { salonId: s.salon.id, decision: "reject", reason: "مدارک ناقص است" });
    expect((await listSalonsAdmin(db, admin, { status: "rejected" })).map((x) => x.id)).toEqual([s.salon.id]);
    expect(await salonStatusCounts(db, admin)).toMatchObject({ pending: 0, rejected: 1 });
    const [n] = await db.select().from(notifications).where(eq(notifications.userId, s.owner.userId));
    expect(n).toMatchObject({ title: expect.stringContaining("رد شد"), body: expect.stringContaining("مدارک ناقص") });

    await updateSalon(db, s.owner, s.salon.id, { description: "مدارک کامل شد" });
    expect((await listSalonsAdmin(db, admin, { status: "pending" })).map((x) => x.id)).toEqual([s.salon.id]);

    await reviewSalon(db, admin, { salonId: s.salon.id, decision: "approve" });
    expect(await getPublicSalon(db, s.salon.slug, NOW)).not.toBeNull();
    await setSalonActive(db, admin, { salonId: s.salon.id, isActive: false, reason: "شکایت‌های متعدد" });
    expect(await getPublicSalon(db, s.salon.slug, NOW)).toBeNull();
    await expect(setSalonActive(db, admin, { salonId: s.salon.id, isActive: true })).resolves.toMatchObject({ isActive: true });

    expect(await audit(s.salon.id)).toEqual(expect.arrayContaining(["salon.reject", "salon.approve", "salon.deactivate", "salon.activate"]));
  });

  it("admin edits record field-level changes with the reason", async () => {
    const admin = await makeUser(db, "admin");
    const s = await makeSalonScenario(db);
    await expect(adminUpdateSalon(db, admin, s.salon.id, { name: "نام جدید" })).rejects.toBeInstanceOf(ValidationError); // دلیل لازم است
    await adminUpdateSalon(db, admin, s.salon.id, { name: "سالن اصلاح‌شده", city: "تهران", reason: "اصلاح املای نام" });
    const d = await getSalonDetailAdmin(db, admin, s.salon.id);
    expect(d.salon.name).toBe("سالن اصلاح‌شده");
    expect(d.history[0]).toMatchObject({ action: "salon.update", reason: "اصلاح املای نام", changes: { name: { from: "سالن تست", to: "سالن اصلاح‌شده" } } });
    expect(d.history[0]!.changes).not.toHaveProperty("city"); // بدون تغییر ثبت نمی‌شود
    expect(d.team.map((m) => m.role).sort()).toEqual(["owner", "stylist"]);
    expect(d.services).toHaveLength(1);
  });
});

describe("bookings, reviews and categories", () => {
  beforeEach(() => resetDb(db));

  it("admin booking actions follow booking rules and require a reason to cancel", async () => {
    const admin = await makeUser(db, "admin");
    const s = await makeSalonScenario(db);
    const c = await makeUser(db, "customer", "مینا");
    await db.update(users).set({ phoneNumber: "+989350000777" }).where(eq(users.id, c.userId));
    const b = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);

    expect((await listAllBookings(db, admin, { q: b.trackingCode.toLowerCase() })).rows.map((x) => x.id)).toEqual([b.id]);
    expect((await listAllBookings(db, admin, { q: "09350000777" })).total).toBe(1);
    expect((await listAllBookings(db, admin, { salonId: s.salon.id, from: SUNDAY, to: SUNDAY })).total).toBe(1);
    expect((await listAllBookings(db, admin, { from: "2026-11-23" })).total).toBe(0);

    await expect(adminBookingAction(db, admin, { bookingId: b.id, action: "cancel" }, clock)).rejects.toBeInstanceOf(ValidationError);
    await expect(adminBookingAction(db, admin, { bookingId: b.id, action: "complete" }, clock)).rejects.toBeInstanceOf(BusinessRuleError); // هنوز شروع نشده
    await adminBookingAction(db, admin, { bookingId: b.id, action: "cancel", reason: "درخواست تلفنی مشتری" }, clock);
    const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(row).toMatchObject({ status: "cancelled", cancelledBy: "admin", cancellationReason: "درخواست تلفنی مشتری" });
    expect(await audit(b.id)).toEqual(["booking.cancel"]);
  });

  it("hiding a review needs a reason, resolves its reports and recomputes ratings; dismissing keeps it visible", async () => {
    const admin = await makeUser(db, "admin");
    const s = await makeSalonScenario(db);
    const reviewIds: string[] = [];
    for (const [time, rating] of [["10:00", 1], ["12:00", 5]] as const) {
      const c = await makeUser(db);
      const b = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, time) }, clock);
      await confirmBooking(db, s.stylistUser, { bookingId: b.id }, clock);
      await completeBooking(db, s.stylistUser, { bookingId: b.id }, after(at(SUNDAY, time), 70));
      reviewIds.push((await createReview(db, c, { bookingId: b.id, rating, comment: "نظر" })).id);
    }
    const [bad, good] = reviewIds as [string, string];
    await reportReview(db, s.stylistUser, "آرایشگر", { reviewId: bad, reason: "این نظر توهین‌آمیز است." });
    await reportReview(db, s.owner, "مالک", { reviewId: good, reason: "به نظرم این نظر جعلی است." });

    await expect(moderateReview(db, admin, { reviewId: bad, decision: "hide" })).rejects.toBeInstanceOf(ValidationError);
    await expect(moderateReview(db, admin, { reviewId: bad, decision: "hide", reason: "توهین" })).resolves.toEqual({ hidden: true, reportsClosed: 1 });
    const [st] = await db.select().from(stylists).where(eq(stylists.id, s.stylist.id));
    expect(st).toMatchObject({ ratingAvg: 5, ratingCount: 1 });
    const [r] = await db.select().from(reviews).where(eq(reviews.id, bad));
    expect(r).toMatchObject({ isHidden: true, hiddenReason: "توهین" });

    await moderateReview(db, admin, { reviewId: good, decision: "dismiss_reports", reason: "نظر واقعی است" });
    const tickets = await db.select().from(supportTickets).where(eq(supportTickets.kind, "review_report"));
    expect(Object.fromEntries(tickets.map((t) => [t.reviewId, t.status]))).toEqual({ [bad]: "resolved", [good]: "closed" });
    expect((await getTicketDetail(db, admin, tickets.find((t) => t.reviewId === good)!.id)).messages[0]!.body).toContain("گزارش رد شد");
  });

  it("admins add categories; services can use only existing, active categories", async () => {
    const admin = await makeUser(db, "admin");
    const s = await makeSalonScenario(db);
    await expect(createCategory(db, s.owner, { key: "hair_care", label: "مراقبت مو", sortOrder: 9, isActive: true })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createCategory(db, admin, { key: "Bad Key", label: "x y", sortOrder: 9, isActive: true })).rejects.toBeInstanceOf(ValidationError);
    await createCategory(db, admin, { key: "hair_care", label: "مراقبت مو", sortOrder: 9, isActive: true });
    await expect(createCategory(db, admin, { key: "hair_care", label: "تکراری", sortOrder: 9, isActive: true })).rejects.toBeInstanceOf(ConflictError);

    const svc = await createService(db, s.owner, { salonId: s.salon.id, name: "کراتین", category: "hair_care", durationMinutes: 60, priceToman: 500_000 });
    await expect(createService(db, s.owner, { salonId: s.salon.id, name: "ناموجود", category: "unknown_cat", durationMinutes: 60, priceToman: 1 })).rejects.toMatchObject({ code: "CATEGORY_UNAVAILABLE" });
    await updateCategory(db, admin, { key: "hair_care", label: "مراقبت مو", sortOrder: 9, isActive: false });
    await expect(createService(db, s.owner, { salonId: s.salon.id, name: "دیگر", category: "hair_care", durationMinutes: 60, priceToman: 1 })).rejects.toMatchObject({ code: "CATEGORY_UNAVAILABLE" });
    // خدمت موجود می‌تواند دسته‌بندی غیرفعال فعلی‌اش را حفظ کند
    await expect(updateService(db, s.owner, svc.id, { name: "کراتین مو", category: "hair_care" })).resolves.toMatchObject({ name: "کراتین مو" });
    // کلید خارجی: حذف دسته‌بندی در حال استفاده ممکن نیست
    await expect(db.execute(sql`delete from service_categories where key = 'hair_care'`)).rejects.toThrow();
    const cats = await listCategoriesAdmin(db, admin);
    expect(cats.find((c) => c.key === "hair_care")).toMatchObject({ services: 1, salons: 1, isActive: false });
    expect(cats.find((c) => c.key === "color")).toMatchObject({ services: 1, stylists: 1 });
  });
});

describe("support tickets", () => {
  beforeEach(() => resetDb(db));

  it("admin replies are visible to the user (notes are not); status changes are tracked", async () => {
    const admin = await makeUser(db, "admin", "پشتیبان");
    const u = await makeUser(db, "customer", "سارا");
    const t = await createTicket(db, u, { kind: "support", name: "سارا", phone: "09121112222", subject: "مشکل رزرو", message: "زمان آزاد نمایش داده نمی‌شود." });
    await createTicket(db, null, { kind: "contact", name: "مهمان", phone: "09121112223", subject: "سؤال", message: "سؤالی درباره تعرفه‌ها دارم." });

    await addTicketMessage(db, admin, { ticketId: t.id, kind: "note", body: "بررسی لاگ‌ها" });
    await addTicketMessage(db, admin, { ticketId: t.id, kind: "reply", body: "مشکل برطرف شد؛ دوباره امتحان کنید." });
    await setTicketStatus(db, admin, { ticketId: t.id, status: "resolved", note: "تأیید کاربر" });
    await expect(addTicketMessage(db, u, { ticketId: t.id, kind: "reply", body: "x" })).rejects.toBeInstanceOf(ForbiddenError);

    const detail = await getTicketDetail(db, admin, t.id);
    expect(detail.ticket.status).toBe("resolved");
    expect(detail.messages.map((m) => m.kind)).toEqual(["note", "reply", "status", "status"]);
    expect(detail.messages[1]).toMatchObject({ authorName: "پشتیبان" });

    const mine = await listMyTickets(db, u);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.messages.map((m) => m.kind)).toEqual(["reply", "status", "status"]);
    expect(JSON.stringify(mine)).not.toContain("بررسی لاگ‌ها");
    expect(await listMyTickets(db, admin)).toEqual([]);
    const [n] = await db.select().from(notifications).where(and(eq(notifications.userId, u.userId)));
    expect(n).toMatchObject({ title: "پاسخ به درخواست پشتیبانی" });
  });
});

describe("report range", () => {
  it("uses presets, custom ranges (max 2 years) and switches to weekly buckets for long ranges", () => {
    const now = new Date("2026-11-14T08:00:00Z");
    expect(parseRange({}, now)).toMatchObject({ from: "2026-10-16", to: "2026-11-14", unit: "day", preset: "30" });
    expect(parseRange({ range: "7" }, now)).toMatchObject({ from: "2026-11-08", to: "2026-11-14", unit: "day" });
    expect(parseRange({ range: "365" }, now)).toMatchObject({ unit: "week" });
    expect(parseRange({ from: "2026-01-01", to: "2026-01-31" }, now)).toMatchObject({ from: "2026-01-01", to: "2026-01-31", unit: "day", preset: null });
    expect(parseRange({ from: "2026-02-01", to: "2026-01-01" }, now)).toMatchObject({ preset: "30" }); // بازه معکوس
    expect(parseRange({ from: "2020-01-01", to: "2026-01-01" }, now)).toMatchObject({ preset: "30" }); // بیش از ۲ سال
    expect(parseRange({ from: "2026-01-01'; drop table x;--", to: "2026-01-02" }, now)).toMatchObject({ preset: "30" });
  });
});
