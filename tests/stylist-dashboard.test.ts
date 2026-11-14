import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { salonMembers, stylists } from "@/db/schema";
import { zonedLocalToIso } from "@/lib/format/datetime";
import { completeBooking, confirmBooking, createBooking } from "@/server/bookings/service";
import { assignServiceToStylist, createService, setStylistServiceActive, updateService } from "@/server/catalog/service";
import { ConflictError, ForbiddenError, NotFoundError, BusinessRuleError, ValidationError } from "@/server/errors";
import { createPortfolioItem, deletePortfolioItem, listPortfolio } from "@/server/portfolio/service";
import { createReview, replyToReview, setReviewHidden } from "@/server/reviews/service";
import { declineSalonInvitation, inviteSalonMember, requestSalonMembership, respondToMembershipRequest } from "@/server/salons/service";
import { addTimeOff, addWorkingHours, deleteTimeOff, deleteWorkingHours } from "@/server/schedules/service";
import { LocalFileStorage } from "@/server/storage/local-storage";
import type { FileServiceDeps } from "@/server/storage/file-service";
import { getStylistStats, listStylistBookingsByTab, listStylistServices } from "@/server/stylists/dashboard";
import { createStylistProfile, updateOwnStylistProfile } from "@/server/stylists/service";
import { NOW, SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
let root: string;
let deps: FileServiceDeps;
const after = (iso: string, minutes: number) => ({ now: new Date(new Date(iso).getTime() + minutes * 60_000) });

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "arayeshgah-st-"));
  deps = { db, storage: new LocalFileStorage(root), config: { rootDir: root, maxBytes: 1024 * 1024 } };
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  await closeTestDb();
});

async function independentStylist() {
  const u = await makeUser(db, "stylist");
  const st = await createStylistProfile(db, u, { displayName: "آرایشگر مستقل", acceptsIndependentBookings: true });
  return { u, st };
}

describe("stylist profile", () => {
  beforeEach(() => resetDb(db));

  it("creates a slug automatically, lets the stylist edit their own profile and rejects duplicate slugs", async () => {
    const a = await independentStylist();
    expect(a.st.slug).toMatch(/^stylist-[0-9a-f]{10}$/);
    const updated = await updateOwnStylistProfile(db, a.u, { slug: "negar-ahmadi", city: "تهران", district: "سعادت‌آباد", specialties: ["رنگ مو"] });
    expect(updated).toMatchObject({ slug: "negar-ahmadi", city: "تهران", district: "سعادت‌آباد" });
    const b = await independentStylist();
    await expect(updateOwnStylistProfile(db, b.u, { slug: "negar-ahmadi" })).rejects.toBeInstanceOf(ConflictError);
    // فعال/غیرفعال‌سازی و رتبه قابل ارسال نیستند
    await expect(updateOwnStylistProfile(db, b.u, { isActive: false })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateOwnStylistProfile(db, b.u, { ratingAvg: 5 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("services & schedule permissions", () => {
  beforeEach(() => resetDb(db));

  it("independent services: only their stylist can edit and toggle them", async () => {
    const a = await independentStylist();
    const b = await independentStylist();
    const svc = await createService(db, a.u, { stylistId: a.st.id, name: "پاکسازی", category: "skin", durationMinutes: 60, priceToman: 800_000 });
    await assignServiceToStylist(db, a.u, { stylistId: a.st.id, serviceId: svc.id });
    await expect(updateService(db, a.u, svc.id, { priceToman: 900_000 })).resolves.toMatchObject({ priceToman: 900_000 });
    await expect(updateService(db, b.u, svc.id, { priceToman: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setStylistServiceActive(db, b.u, { stylistId: a.st.id, serviceId: svc.id, isActive: false })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setStylistServiceActive(db, a.u, { stylistId: a.st.id, serviceId: svc.id, isActive: false })).resolves.toMatchObject({ isActive: false });
    expect((await listStylistServices(db, a.st.id))[0]).toMatchObject({ isIndependent: true, assignmentActive: false });
  });

  it("salon services: a stylist may stop offering one but only the salon can edit or re-enable it", async () => {
    const s = await makeSalonScenario(db);
    await expect(updateService(db, s.stylistUser, s.service.id, { priceToman: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setStylistServiceActive(db, s.stylistUser, { stylistId: s.stylist.id, serviceId: s.service.id, isActive: false })).resolves.toMatchObject({ isActive: false });
    await expect(setStylistServiceActive(db, s.stylistUser, { stylistId: s.stylist.id, serviceId: s.service.id, isActive: true })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setStylistServiceActive(db, s.owner, { stylistId: s.stylist.id, serviceId: s.service.id, isActive: true })).resolves.toMatchObject({ isActive: true });
    await expect(updateService(db, s.owner, s.service.id, { priceToman: 1_500_000 })).resolves.toMatchObject({ priceToman: 1_500_000 });
  });

  it("working hours and time off can only be deleted by their owner", async () => {
    const a = await independentStylist();
    const b = await independentStylist();
    const h = await addWorkingHours(db, a.u, { stylistId: a.st.id, dayOfWeek: 0, opensAt: "16:00", closesAt: "20:00" });
    await expect(deleteWorkingHours(db, b.u, h.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteWorkingHours(db, a.u, h.id)).resolves.toBeUndefined();
    const t = await addTimeOff(db, a.u, { stylistId: a.st.id, startsAt: at(SUNDAY, "10:00"), endsAt: at(SUNDAY, "12:00") });
    await expect(deleteTimeOff(db, b.u, t.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteTimeOff(db, a.u, t.id)).resolves.toBeUndefined();
    await expect(deleteTimeOff(db, a.u, t.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("converts local Tehran date/time to the right instant", () => {
    expect(zonedLocalToIso("2026-11-22", "10:00", "Asia/Tehran")).toBe("2026-11-22T06:30:00.000Z");
    expect(zonedLocalToIso("2026-11-22", "00:00", "UTC")).toBe("2026-11-22T00:00:00.000Z");
  });
});

describe("portfolio", () => {
  beforeEach(() => resetDb(db));

  it("stylists upload and delete their own items; others cannot delete them", async () => {
    const a = await independentStylist();
    const b = await independentStylist();
    const item = await createPortfolioItem(deps, a.u, PNG, { title: "بالیاژ" }, "x.png");
    expect(await listPortfolio(db, { stylistId: a.st.id })).toHaveLength(1);
    await expect(deletePortfolioItem(deps, b.u, item.id)).rejects.toBeInstanceOf(ForbiddenError);
    await deletePortfolioItem(deps, a.u, item.id);
    expect(await listPortfolio(db, { stylistId: a.st.id })).toHaveLength(0);
  });

  it("customers without a stylist profile cannot add stylist portfolio items", async () => {
    await expect(createPortfolioItem(deps, await makeUser(db, "stylist"), PNG, {}, "x.png")).rejects.toBeInstanceOf(BusinessRuleError);
  });
});

describe("bookings, stats and reviews for stylists", () => {
  beforeEach(() => resetDb(db));

  it("lists only the stylist's bookings with customer contact, and computes revenue from completed bookings", async () => {
    const s = await makeSalonScenario(db);
    const other = await makeSalonScenario(db);
    const c = await makeUser(db, "customer", "مینا صادقی");
    const b1 = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    await createBooking(db, await makeUser(db), { stylistId: other.stylist.id, serviceId: other.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const pending = await listStylistBookingsByTab(db, s.stylist.id, "pending", NOW);
    expect(pending.map((b) => b.id)).toEqual([b1.id]);
    expect(pending[0]).toMatchObject({ customerName: "مینا صادقی" });

    await confirmBooking(db, s.stylistUser, { bookingId: b1.id }, clock);
    await completeBooking(db, s.stylistUser, { bookingId: b1.id }, after(at(SUNDAY, "10:00"), 70));
    const stats = await getStylistStats(db, s.stylist.id, after(at(SUNDAY, "10:00"), 120).now);
    expect(stats).toMatchObject({ completed: 1, revenueTotal: 1_200_000 });

    // پاسخ به نظر: آرایشگر همان نوبت یا سالن؛ نه آرایشگر دیگر
    const review = await createReview(db, c, { bookingId: b1.id, rating: 2, comment: "دیر شد" });
    await expect(replyToReview(db, other.stylistUser, { reviewId: review.id, reply: "پاسخ" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(replyToReview(db, s.stylistUser, { reviewId: review.id, reply: "عذرخواهی می‌کنیم" })).resolves.toMatchObject({ reply: "عذرخواهی می‌کنیم" });

    // پنهان کردن نظر فقط توسط ادمین و حذف از امتیاز
    await expect(setReviewHidden(db, s.owner, { reviewId: review.id, hidden: true })).rejects.toBeInstanceOf(ForbiddenError);
    await setReviewHidden(db, await makeUser(db, "admin"), { reviewId: review.id, hidden: true });
    const [st] = await db.select().from(stylists).where(eq(stylists.id, s.stylist.id));
    expect([st!.ratingAvg, st!.ratingCount]).toEqual([0, 0]);
  });
});

describe("salon membership requests", () => {
  beforeEach(() => resetDb(db));

  it("stylist requests to join by salon slug; owner approves; duplicates are refused", async () => {
    const s = await makeSalonScenario(db);
    const a = await independentStylist();
    const req = await requestSalonMembership(db, a.u, { salonSlug: s.salon.slug });
    expect(req).toMatchObject({ status: "requested", role: "stylist" });
    await expect(requestSalonMembership(db, a.u, { salonSlug: s.salon.slug })).rejects.toBeInstanceOf(ConflictError);
    await expect(respondToMembershipRequest(db, a.u, { membershipId: req.id, approve: true })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(respondToMembershipRequest(db, s.owner, { membershipId: req.id, approve: true })).resolves.toMatchObject({ status: "active" });
    await expect(requestSalonMembership(db, a.u, { salonSlug: s.salon.slug })).rejects.toBeInstanceOf(ConflictError);
  });

  it("users without a stylist profile cannot request; unknown salons are not found; invitations can be declined", async () => {
    const s = await makeSalonScenario(db);
    await expect(requestSalonMembership(db, await makeUser(db, "stylist"), { salonSlug: s.salon.slug })).rejects.toBeInstanceOf(BusinessRuleError);
    const a = await independentStylist();
    await expect(requestSalonMembership(db, a.u, { salonSlug: "no-such-salon" })).rejects.toBeInstanceOf(NotFoundError);
    const inv = await inviteSalonMember(db, s.owner, { salonId: s.salon.id, userId: a.u.userId, role: "stylist" });
    await expect(declineSalonInvitation(db, await makeUser(db), inv.id)).rejects.toBeInstanceOf(NotFoundError);
    await declineSalonInvitation(db, a.u, inv.id);
    const [m] = await db.select().from(salonMembers).where(eq(salonMembers.id, inv.id));
    expect(m!.status).toBe("left");
    // پس از خروج، درخواست مجدد ممکن است
    await expect(requestSalonMembership(db, a.u, { salonSlug: s.salon.slug })).resolves.toMatchObject({ status: "requested" });
  });
});
