import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { profiles, users } from "@/db/schema";
import {
  deletePlan, listAllBookings, listPlans, listReviewsAdmin, listSalonsAdmin, listStylistsAdmin, listUsers, savePlan, setSalonStatus, setStylistActive, updateCategory,
} from "@/server/admin/service";
import { getAdminDashboard, parseRange } from "@/server/admin/stats";
import { completeBooking, confirmBooking, createBooking } from "@/server/bookings/service";
import { listAllCategories } from "@/server/catalog/categories";
import { getSetting, setSetting } from "@/server/content/settings";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/errors";
import { adminSetUserRole, SUPER_ADMIN_PHONE } from "@/server/profiles/service";
import { createReview } from "@/server/reviews/service";
import { createTicket, listTickets, reportReview, updateTicket } from "@/server/support/service";
import { SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);
const after = (iso: string, minutes: number) => ({ now: new Date(new Date(iso).getTime() + minutes * 60_000) });

describe("admin dashboard", () => {
  beforeEach(() => resetDb(db));

  it("every admin service rejects non-admin users", async () => {
    const s = await makeSalonScenario(db);
    for (const actor of [await makeUser(db), s.owner, s.stylistUser]) {
      await expect(getAdminDashboard(db, actor, parseRange({}, new Date()))).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listUsers(db, actor, {})).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listSalonsAdmin(db, actor, {})).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setSalonStatus(db, actor, { salonId: s.salon.id, isVerified: true })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setStylistActive(db, actor, { stylistId: s.stylist.id, isActive: false })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listStylistsAdmin(db, actor)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listAllBookings(db, actor, {})).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listReviewsAdmin(db, actor, {})).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listTickets(db, actor, {})).rejects.toBeInstanceOf(ForbiddenError);
      await expect(updateCategory(db, actor, { key: "hair", label: "مو", sortOrder: 1, isActive: true })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(savePlan(db, actor, { slug: "x", name: "پلن", audience: "salon", priceMonthlyToman: 0 })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setSetting(db, actor, "contact", { phone: "021" })).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("the super admin (09991797982) role can never be changed, even by another admin", async () => {
    const admin = await makeUser(db, "admin");
    const superAdmin = await makeUser(db, "admin");
    await db.update(users).set({ phoneNumber: SUPER_ADMIN_PHONE }).where(eq(users.id, superAdmin.userId));
    await expect(adminSetUserRole(db, admin, { userId: superAdmin.userId, role: "customer" })).rejects.toMatchObject({ code: "SUPER_ADMIN_PROTECTED" });
    const [p] = await db.select().from(profiles).where(eq(profiles.userId, superAdmin.userId));
    expect(p!.role).toBe("admin");
    // سایر کاربران قابل تغییر هستند
    const u = await makeUser(db);
    await expect(adminSetUserRole(db, admin, { userId: u.userId, role: "stylist" })).resolves.toEqual({ role: "stylist" });
  });

  it("salons are approved/rejected; filters reflect the status", async () => {
    const admin = await makeUser(db, "admin");
    const s = await makeSalonScenario(db);
    expect((await listSalonsAdmin(db, admin, { status: "pending" })).map((x) => x.id)).toEqual([s.salon.id]);
    await setSalonStatus(db, admin, { salonId: s.salon.id, isVerified: true });
    expect(await listSalonsAdmin(db, admin, { status: "pending" })).toHaveLength(0);
    expect((await listSalonsAdmin(db, admin, { status: "verified" })).map((x) => x.id)).toEqual([s.salon.id]);
    await setSalonStatus(db, admin, { salonId: s.salon.id, isActive: false });
    expect((await listSalonsAdmin(db, admin, { status: "inactive" })).map((x) => x.id)).toEqual([s.salon.id]);
    await expect(setSalonStatus(db, admin, { salonId: s.salon.id, ownerId: admin.userId })).rejects.toBeInstanceOf(ValidationError);
  });

  it("users can be searched by name and phone", async () => {
    const admin = await makeUser(db, "admin");
    const u = await makeUser(db, "customer", "نازنین حسینی");
    await db.update(users).set({ phoneNumber: "+989351234567" }).where(eq(users.id, u.userId));
    expect((await listUsers(db, admin, { q: "نازنین" })).rows.map((r) => r.id)).toEqual([u.userId]);
    expect((await listUsers(db, admin, { q: "09351234567" })).rows.map((r) => r.id)).toEqual([u.userId]);
    expect((await listUsers(db, admin, { role: "admin" })).rows.map((r) => r.id)).toEqual([admin.userId]);
  });

  it("tickets: public submission needs phone or email; admins update status; review reports are surfaced", async () => {
    const admin = await makeUser(db, "admin");
    await expect(createTicket(db, null, { kind: "contact", name: "مهمان", subject: "سؤال", message: "سلام، سؤالی درباره رزرو داشتم." })).rejects.toBeInstanceOf(ValidationError);
    await expect(createTicket(db, null, { kind: "contact", name: "مهمان", phone: "۰۹۱۲۱۲۳۴۵۶۷", subject: "سؤال", message: "سلام، سؤالی درباره رزرو داشتم." })).resolves.toHaveProperty("id");
    // نوع review_report از فرم عمومی پذیرفته نمی‌شود
    await expect(createTicket(db, null, { kind: "review_report", name: "x y", phone: "09121234567", subject: "abc", message: "0123456789" })).rejects.toBeInstanceOf(ValidationError);
    const [t] = await listTickets(db, admin, { status: "open" });
    expect(t).toMatchObject({ phone: "09121234567", kind: "contact" });
    await updateTicket(db, admin, { ticketId: t!.id, status: "resolved", adminNote: "تماس گرفته شد" });
    expect(await listTickets(db, admin, { status: "open" })).toHaveLength(0);

    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    const b = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    await confirmBooking(db, s.stylistUser, { bookingId: b.id }, clock);
    await completeBooking(db, s.stylistUser, { bookingId: b.id }, after(at(SUNDAY, "10:00"), 70));
    const review = await createReview(db, c, { bookingId: b.id, rating: 1, comment: "متن نامناسب" });
    await reportReview(db, s.stylistUser, "آرایشگر", { reviewId: review.id, reason: "این نظر توهین‌آمیز است." });
    const reported = await listReviewsAdmin(db, admin, { view: "reported" });
    expect(reported).toEqual([expect.objectContaining({ id: review.id, reports: 1 })]);

    const { totals, series, byStatus } = await getAdminDashboard(db, admin, parseRange({ range: "7" }, new Date()));
    expect(totals).toMatchObject({ reports_open: 1, bookings_completed: 1, bookings: 1, salons: 1, salons_pending: 1, tickets: 2, tickets_open: 1 });
    expect(series).toHaveLength(7);
    expect(series.reduce((a, p) => a + p.bookings, 0)).toBe(1); // ثبت نوبت امروز (created_at = now)
    expect(byStatus).toEqual([{ status: "completed", n: 1 }]);
  });

  it("settings are validated per key and readable", async () => {
    const admin = await makeUser(db, "admin");
    expect(await getSetting(db, "contact")).toBeNull();
    await setSetting(db, admin, "contact", { phone: "021-1234", email: "info@example.com" });
    expect(await getSetting(db, "contact")).toEqual({ phone: "021-1234", email: "info@example.com" });
    await expect(setSetting(db, admin, "contact", { email: "not-an-email" })).rejects.toBeInstanceOf(ValidationError);
    await expect(setSetting(db, admin, "contact", { script: "<x>" })).rejects.toBeInstanceOf(ValidationError);
    await setSetting(db, admin, "careers", { openings: [{ title: "پشتیبان مشتریان", type: "تمام‌وقت" }] });
    expect((await getSetting(db, "careers"))?.openings).toHaveLength(1);
  });

  it("plans and categories are managed by admins", async () => {
    const admin = await makeUser(db, "admin");
    const p = await savePlan(db, admin, { slug: "salon-pro", name: "حرفه‌ای", audience: "salon", priceMonthlyToman: 990_000, features: ["مدیریت نوبت"] });
    await expect(savePlan(db, admin, { slug: "salon-pro", name: "دیگر", audience: "salon", priceMonthlyToman: 0 })).rejects.toBeInstanceOf(ConflictError);
    await savePlan(db, admin, { slug: "salon-pro", name: "حرفه‌ای", audience: "salon", priceMonthlyToman: 990_000, isActive: false }, p.id);
    expect(await listPlans(db, true)).toHaveLength(0);
    await deletePlan(db, admin, p.id);
    expect(await listPlans(db, false)).toHaveLength(0);

    await updateCategory(db, admin, { key: "spa", label: "اسپا و ماساژ", sortOrder: 1, isActive: false });
    const spa = (await listAllCategories(db)).find((c) => c.key === "spa");
    expect(spa).toMatchObject({ label: "اسپا و ماساژ", isActive: false });
    await updateCategory(db, admin, { key: "spa", label: "ماساژ و اسپا", sortOrder: 7, isActive: true });
  });
});
