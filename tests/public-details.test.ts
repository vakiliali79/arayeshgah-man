import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { salons, stylists } from "@/db/schema";
import { completeBooking, confirmBooking, createBooking } from "@/server/bookings/service";
import { createService, setStylistServiceActive, updateService } from "@/server/catalog/service";
import { createReview, setReviewHidden } from "@/server/reviews/service";
import { inviteSalonMember, acceptSalonInvitation } from "@/server/salons/service";
import { addWorkingHours } from "@/server/schedules/service";
import { findNextSlots, getPublicSalon, getPublicStylist } from "@/server/public/details";
import { resolveBookingContext } from "@/server/public/slots";
import { updateOwnStylistProfile } from "@/server/stylists/service";
import { assignServiceToStylist } from "@/server/catalog/service";
import { NOW, SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);
const verify = (id: string) => db.update(salons).set({ isVerified: true }).where(eq(salons.id, id));
const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

describe("public salon page data", () => {
  beforeEach(() => resetDb(db));

  it("is hidden until the salon is verified, and hidden again when deactivated", async () => {
    const s = await makeSalonScenario(db);
    expect(await getPublicSalon(db, s.salon.slug, NOW)).toBeNull();
    await verify(s.salon.id);
    expect(await getPublicSalon(db, s.salon.slug, NOW)).not.toBeNull();
    await db.update(salons).set({ isActive: false }).where(eq(salons.id, s.salon.id));
    expect(await getPublicSalon(db, s.salon.slug, NOW)).toBeNull();
    expect(await getPublicSalon(db, "no-such-salon", NOW)).toBeNull();
  });

  it("lists only bookable services with the stylist's own price, the team, hours and the nearest free times", async () => {
    const s = await makeSalonScenario(db);
    await verify(s.salon.id);
    const inactive = await createService(db, s.owner, { salonId: s.salon.id, name: "خدمت غیرفعال", category: "hair", durationMinutes: 30, priceToman: 100_000 });
    await assignServiceToStylist(db, s.owner, { stylistId: s.stylist.id, serviceId: inactive.id });
    await updateService(db, s.owner, inactive.id, { isActive: false });
    await createService(db, s.owner, { salonId: s.salon.id, name: "بدون آرایشگر", category: "hair", durationMinutes: 30, priceToman: 100_000 });

    const d = (await getPublicSalon(db, s.salon.slug, NOW))!;
    expect(d.offerings.map((o) => [o.serviceName, o.priceToman, o.stylistSlug])).toEqual([["رنگ مو", 1_200_000, s.stylist.slug]]);
    expect(d.team.map((t) => t.id)).toEqual([s.stylist.id]);
    expect(d.hours).toHaveLength(6);
    // اکنون شنبه ۰۸:۳۰ — اولین زمان آزاد شنبه ۱۰:۰۰
    expect(d.availability[0]!.slots.map(hhmm)).toEqual(["10:00", "10:15", "10:30"]);
  });

  it("drops a stylist's offering when the assignment is deactivated", async () => {
    const s = await makeSalonScenario(db);
    await verify(s.salon.id);
    await setStylistServiceActive(db, s.owner, { stylistId: s.stylist.id, serviceId: s.service.id, isActive: false });
    const d = (await getPublicSalon(db, s.salon.slug, NOW))!;
    expect(d.offerings).toEqual([]);
    expect(d.availability).toEqual([]);
  });

  it("excludes hidden reviews", async () => {
    const s = await makeSalonScenario(db);
    await verify(s.salon.id);
    const after = (iso: string, m: number) => ({ now: new Date(new Date(iso).getTime() + m * 60_000) });
    const reviewIds: string[] = [];
    for (const time of ["10:00", "12:00"]) {
      const c = await makeUser(db);
      const b = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, time) }, clock);
      await confirmBooking(db, s.stylistUser, { bookingId: b.id }, clock);
      await completeBooking(db, s.stylistUser, { bookingId: b.id }, after(at(SUNDAY, time), 70));
      reviewIds.push((await createReview(db, c, { bookingId: b.id, rating: 5, comment: `نظر ${time}` })).id);
    }
    await setReviewHidden(db, await makeUser(db, "admin"), { reviewId: reviewIds[0]!, hidden: true });
    const d = (await getPublicSalon(db, s.salon.slug, NOW))!;
    expect(d.reviews.map((r) => r.id)).toEqual([reviewIds[1]]);
    const st = (await getPublicStylist(db, s.stylist.slug, NOW))!;
    expect(st.reviews.map((r) => r.id)).toEqual([reviewIds[1]]);
  });
});

describe("public stylist page data", () => {
  beforeEach(() => resetDb(db));

  it("lists every public salon the stylist works in, but not unverified ones", async () => {
    const a = await makeSalonScenario(db);
    const b = await makeSalonScenario(db);
    const hidden = await makeSalonScenario(db);
    await verify(a.salon.id);
    await verify(b.salon.id);
    for (const target of [b, hidden]) {
      const inv = await inviteSalonMember(db, target.owner, { salonId: target.salon.id, userId: a.stylistUser.userId, role: "stylist" });
      await acceptSalonInvitation(db, a.stylistUser, inv.id);
      await assignServiceToStylist(db, target.owner, { stylistId: a.stylist.id, serviceId: target.service.id });
      await addWorkingHours(db, target.owner, { salonId: target.salon.id, stylistId: a.stylist.id, dayOfWeek: 2, opensAt: "10:00", closesAt: "12:00" });
    }
    const d = (await getPublicStylist(db, a.stylist.slug, NOW))!;
    expect(d.salons.map((s) => s.id).sort()).toEqual([a.salon.id, b.salon.id].sort());
    expect(new Set(d.offerings.map((o) => o.salonId))).toEqual(new Set([a.salon.id, b.salon.id]));
    expect(d.hours.some((h) => h.salonId === hidden.salon.id)).toBe(false);
    // هر محل جداگانه زمان آزاد دارد
    expect(d.availability.map((x) => x.salonName).length).toBe(2);
  });

  it("is hidden when not independent and not a member of any public salon, or inactive", async () => {
    const s = await makeSalonScenario(db); // سالن تأییدنشده
    expect(await getPublicStylist(db, s.stylist.slug, NOW)).toBeNull();
    await updateOwnStylistProfile(db, s.stylistUser, { acceptsIndependentBookings: true });
    expect(await getPublicStylist(db, s.stylist.slug, NOW)).not.toBeNull();
    await db.update(stylists).set({ isActive: false }).where(eq(stylists.id, s.stylist.id));
    expect(await getPublicStylist(db, s.stylist.slug, NOW)).toBeNull();
  });
});

describe("findNextSlots", () => {
  beforeEach(() => resetDb(db));

  it("skips closed days and booked times, and returns times createBooking accepts", async () => {
    const s = await makeSalonScenario(db);
    await verify(s.salon.id);
    const ctx = (await resolveBookingContext(db, s.stylist.id, s.service.id))!;
    // ساعت ۱۹ شنبه: امروز تمام شده، فردا (یکشنبه) ۱۰:۰۰
    const evening = new Date(at("2026-11-21", "19:00"));
    await createBooking(db, await makeUser(db), { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const slots = await findNextSlots(db, ctx, { now: evening, limit: 2 });
    expect(slots.map((d) => d.toISOString())).toEqual([new Date(at(SUNDAY, "11:15")).toISOString(), new Date(at(SUNDAY, "11:30")).toISOString()]);
    await expect(createBooking(db, await makeUser(db), { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: slots[0]!.toISOString() }, { now: evening })).resolves.toBeTruthy();
  });
});
