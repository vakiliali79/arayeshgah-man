import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { salons } from "@/db/schema";
import { createBooking } from "@/server/bookings/service";
import { assignServiceToStylist, createService } from "@/server/catalog/service";
import { acceptSalonInvitation, inviteSalonMember } from "@/server/salons/service";
import { addWorkingHours } from "@/server/schedules/service";
import { createStylistProfile, updateOwnStylistProfile } from "@/server/stylists/service";
import { bookingDays, parseBookingParams, resolveBookingFlow } from "@/server/public/booking-flow";
import { FRIDAY, NOW, SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);
const opts = { now: NOW };

async function salonWithTwoStylists() {
  const s = await makeSalonScenario(db);
  await db.update(salons).set({ isVerified: true }).where(eq(salons.id, s.salon.id));
  const u2 = await makeUser(db, "stylist", "آرایشگر دوم");
  const st2 = await createStylistProfile(db, u2, { displayName: "آرایشگر دوم" });
  const inv = await inviteSalonMember(db, s.owner, { salonId: s.salon.id, userId: u2.userId, role: "stylist" });
  await acceptSalonInvitation(db, u2, inv.id);
  await assignServiceToStylist(db, s.owner, { stylistId: st2.id, serviceId: s.service.id });
  await addWorkingHours(db, s.owner, { salonId: s.salon.id, stylistId: st2.id, dayOfWeek: 0, opensAt: "10:00", closesAt: "12:00" });
  return { ...s, st2 };
}

describe("booking flow", () => {
  beforeEach(() => resetDb(db));

  it("starts with a prompt, and rejects unknown or unverified salons", async () => {
    expect((await resolveBookingFlow(db, {}, opts)).step).toBe("start");
    expect((await resolveBookingFlow(db, { salon: "nope" }, opts)).notice).toBeTruthy();
    const s = await makeSalonScenario(db); // تأییدنشده
    const f = await resolveBookingFlow(db, { salon: s.salon.slug }, opts);
    expect(f.step).toBe("start");
    expect(f.notice).toBeTruthy();
  });

  it("walks service → stylist → date → time → confirm, validating each choice", async () => {
    const s = await salonWithTwoStylists();
    const base = { salon: s.salon.slug };

    let f = await resolveBookingFlow(db, base, opts);
    expect(f.step).toBe("service");
    expect(f.services).toMatchObject([{ serviceId: s.service.id, minPrice: 1_000_000, maxPrice: 1_200_000, stylistCount: 2 }]);

    f = await resolveBookingFlow(db, { ...base, service: "not-a-uuid" }, opts);
    expect(f).toMatchObject({ step: "service" });
    expect(f.notice).toBeTruthy();

    f = await resolveBookingFlow(db, { ...base, service: s.service.id }, opts);
    expect(f.step).toBe("stylist");
    expect(f.stylistChoices.map((o) => o.stylistId).sort()).toEqual([s.stylist.id, s.st2.id].sort());

    const withStylist = { ...base, service: s.service.id, stylist: s.stylist.slug };
    f = await resolveBookingFlow(db, withStylist, opts);
    expect(f.step).toBe("date");
    expect(f.ctx?.priceToman).toBe(1_200_000);
    expect(f.stylistChoices).toHaveLength(2); // امکان «تغییر آرایشگر» در سالن
    expect(f.days).toHaveLength(14);
    expect(f.days.find((d) => d.key === FRIDAY)?.open).toBe(false);
    expect(f.days.filter((d) => d.full)).toEqual([]);
    // پس از پایان ساعت کاری امروز، امروز «تکمیل» است و قابل انتخاب نیست
    const evening = await resolveBookingFlow(db, withStylist, { now: new Date(at("2026-11-21", "19:00")) });
    expect(evening.days[0]).toMatchObject({ key: "2026-11-21", open: true, full: true });
    expect(evening.days[1]).toMatchObject({ key: SUNDAY, open: true, full: false });

    f = await resolveBookingFlow(db, { ...withStylist, date: FRIDAY }, opts);
    expect(f.step).toBe("date");
    expect(f.notice).toBeTruthy();
    f = await resolveBookingFlow(db, { ...withStylist, date: "2027-06-01" }, opts); // خارج از ۱۴ روز
    expect(f.step).toBe("date");

    f = await resolveBookingFlow(db, { ...withStylist, date: SUNDAY }, opts);
    expect(f.step).toBe("time");
    expect(f.slots.length).toBeGreaterThan(0);

    f = await resolveBookingFlow(db, { ...withStylist, date: SUNDAY, time: "10:00" }, opts);
    expect(f.step).toBe("confirm");
    expect(f.startsAt?.toISOString()).toBe(new Date(at(SUNDAY, "10:00")).toISOString());

    // ساعت خارج از شیفت یا قالب نادرست
    for (const time of ["19:00", "10:07", "bad"]) {
      f = await resolveBookingFlow(db, { ...withStylist, date: SUNDAY, time }, opts);
      expect(f.step).toBe("time");
    }
  });

  it("refuses a time that became taken, and hides the customer's own overlapping times", async () => {
    const s = await salonWithTwoStylists();
    const p = { salon: s.salon.slug, service: s.service.id, stylist: s.stylist.slug, date: SUNDAY, time: "10:00" };
    await createBooking(db, await makeUser(db), { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const f = await resolveBookingFlow(db, p, opts);
    expect(f.step).toBe("time");
    expect(f.notice).toContain("آزاد نیست");

    const me = await makeUser(db);
    await createBooking(db, me, { stylistId: s.st2.id, serviceId: s.service.id, startsAt: at(SUNDAY, "11:00") }, clock);
    const mine = await resolveBookingFlow(db, { ...p, time: "11:30" }, { now: NOW, customerId: me.userId });
    expect(mine.step).toBe("time");
    expect((await resolveBookingFlow(db, { ...p, time: "11:30" }, opts)).step).toBe("confirm");
  });

  it("auto-selects the only stylist, and a stylist link lists services across salons and independent work", async () => {
    const s = await makeSalonScenario(db);
    await db.update(salons).set({ isVerified: true }).where(eq(salons.id, s.salon.id));
    let f = await resolveBookingFlow(db, { salon: s.salon.slug, service: s.service.id }, opts);
    expect(f.step).toBe("date");
    expect(f.stylist?.id).toBe(s.stylist.id);

    await updateOwnStylistProfile(db, s.stylistUser, { acceptsIndependentBookings: true });
    const own = await createService(db, s.stylistUser, { stylistId: s.stylist.id, name: "میکاپ در منزل", category: "makeup", durationMinutes: 90, priceToman: 2_000_000 });
    await assignServiceToStylist(db, s.stylistUser, { stylistId: s.stylist.id, serviceId: own.id });
    f = await resolveBookingFlow(db, { stylist: s.stylist.slug }, opts);
    expect(f.step).toBe("service");
    expect(f.services.map((x) => [x.serviceName, x.salonSlug]).sort()).toEqual([["رنگ مو", s.salon.slug], ["میکاپ در منزل", null]].sort());

    // خدمت مستقل: بدون سالن، روزهای بدون شیفت مستقل همه بسته‌اند
    f = await resolveBookingFlow(db, { stylist: s.stylist.slug, service: own.id }, opts);
    expect(f).toMatchObject({ step: "date", salon: null });
    expect(f.days.every((d) => !d.open)).toBe(true);
  });

  it("ignores a salon/service mismatch instead of booking at the wrong place", async () => {
    const a = await makeSalonScenario(db);
    const b = await makeSalonScenario(db);
    for (const x of [a, b]) await db.update(salons).set({ isVerified: true }).where(eq(salons.id, x.salon.id));
    const f = await resolveBookingFlow(db, { salon: a.salon.slug, service: b.service.id }, opts);
    expect(f.step).toBe("service");
    expect(f.notice).toBeTruthy();
  });

  it("parses only short string params and builds 14 local days", () => {
    expect(parseBookingParams({ salon: ["a", "b"], service: "x".repeat(200), date: "2026-11-22" })).toEqual({ salon: undefined, stylist: undefined, service: undefined, date: "2026-11-22", time: undefined });
    const days = bookingDays(NOW, "Asia/Tehran", new Set([0]));
    expect(days[0]).toMatchObject({ key: "2026-11-21", dow: 6, open: false });
    expect(days[1]).toMatchObject({ key: SUNDAY, dow: 0, open: true });
  });
});
