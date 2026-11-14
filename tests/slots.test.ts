import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { salons, workingHours } from "@/db/schema";
import { cancelBooking, createBooking } from "@/server/bookings/service";
import { assignServiceToStylist, createService } from "@/server/catalog/service";
import { getAvailableSlots, getWorkingDays, resolveBookingContext } from "@/server/public/slots";
import { addTimeOff, addWorkingHours } from "@/server/schedules/service";
import { createStylistProfile } from "@/server/stylists/service";
import { FRIDAY, NOW, SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);

const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

async function scenario() {
  const s = await makeSalonScenario(db);
  await db.update(salons).set({ isVerified: true }).where(eq(salons.id, s.salon.id));
  const ctx = (await resolveBookingContext(db, s.stylist.id, s.service.id))!;
  return { ...s, ctx };
}

describe("booking context", () => {
  beforeEach(() => resetDb(db));

  it("resolves price/duration/timezone from the DB and rejects unpublished or invalid combinations", async () => {
    const s = await makeSalonScenario(db);
    expect(await resolveBookingContext(db, s.stylist.id, s.service.id)).toBeNull(); // سالن تأییدنشده
    await db.update(salons).set({ isVerified: true }).where(eq(salons.id, s.salon.id));
    expect(await resolveBookingContext(db, s.stylist.id, s.service.id)).toMatchObject({ priceToman: 1_200_000, durationMinutes: 60, bufferMinutes: 15, timezone: "Asia/Tehran", salonId: s.salon.id });
    const other = await makeSalonScenario(db);
    expect(await resolveBookingContext(db, other.stylist.id, s.service.id)).toBeNull(); // خدمت به این آرایشگر سپرده نشده
  });
});

describe("available slots", () => {
  beforeEach(() => resetDb(db));

  it("lists every 15 minutes inside the shift so the service fits", async () => {
    const { ctx } = await scenario();
    const slots = await getAvailableSlots(db, ctx, SUNDAY, { now: NOW });
    expect(slots.map(hhmm).slice(0, 3)).toEqual(["10:00", "10:15", "10:30"]);
    expect(hhmm(slots.at(-1)!)).toBe("17:00"); // ۱۷:۰۰ + ۶۰ دقیقه = پایان شیفت ۱۸:۰۰
    expect(slots).toHaveLength(29);
    expect(await getAvailableSlots(db, ctx, FRIDAY, { now: NOW })).toEqual([]);
    expect([...(await getWorkingDays(db, ctx))].sort()).toEqual([0, 1, 2, 3, 4, 6]);
  });

  it("removes times overlapping a booking (incl. buffer) and time off", async () => {
    const s = await scenario();
    await createBooking(db, await makeUser(db), { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    await addTimeOff(db, s.owner, { salonId: s.salon.id, startsAt: at(SUNDAY, "14:00"), endsAt: at(SUNDAY, "15:00") });
    const times = (await getAvailableSlots(db, s.ctx, SUNDAY, { now: NOW })).map(hhmm);
    expect(times[0]).toBe("11:15"); // نوبت ۱۰:۰۰ تا ۱۱:۱۵ (با آماده‌سازی) اشغال است
    for (const blocked of ["10:00", "11:00", "13:00", "14:00", "14:45"]) expect(times).not.toContain(blocked);
    expect(times).toContain("12:45");
    expect(times).toContain("15:00");
  });

  it("respects the minimum lead time on the same day", async () => {
    const { ctx } = await scenario();
    const saturday = "2026-11-21";
    const at1005 = new Date(at(saturday, "10:05"));
    expect(hhmm((await getAvailableSlots(db, ctx, saturday, { now: at1005 }))[0]!)).toBe("10:30");
  });

  it("intersects stylist shifts with salon opening hours", async () => {
    const s = await scenario();
    await db.delete(workingHours).where(eq(workingHours.salonId, s.salon.id));
    await addWorkingHours(db, s.owner, { salonId: s.salon.id, dayOfWeek: 0, opensAt: "12:00", closesAt: "14:00" });
    await addWorkingHours(db, s.owner, { salonId: s.salon.id, stylistId: s.stylist.id, dayOfWeek: 0, opensAt: "10:00", closesAt: "18:00" });
    expect((await getAvailableSlots(db, s.ctx, SUNDAY, { now: NOW })).map(hhmm)).toEqual(["12:00", "12:15", "12:30", "12:45", "13:00"]);
  });

  it("hides times overlapping the customer's own other bookings when a customer is given", async () => {
    const a = await scenario();
    const b = await scenario();
    const c = await makeUser(db);
    await createBooking(db, c, { stylistId: b.stylist.id, serviceId: b.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const forCustomer = (await getAvailableSlots(db, a.ctx, SUNDAY, { now: NOW, customerId: c.userId })).map(hhmm);
    expect(forCustomer[0]).toBe("11:00");
    expect((await getAvailableSlots(db, a.ctx, SUNDAY, { now: NOW })).map(hhmm)[0]).toBe("10:00");
  });

  it("works for independent stylists", async () => {
    const u = await makeUser(db, "stylist");
    const st = await createStylistProfile(db, u, { displayName: "مستقل", acceptsIndependentBookings: true });
    const svc = await createService(db, u, { stylistId: st.id, name: "پاکسازی", category: "skin", durationMinutes: 90, priceToman: 800_000 });
    await assignServiceToStylist(db, u, { stylistId: st.id, serviceId: svc.id });
    await addWorkingHours(db, u, { stylistId: st.id, dayOfWeek: 0, opensAt: "16:00", closesAt: "19:00" });
    const ctx = (await resolveBookingContext(db, st.id, svc.id))!;
    expect(ctx.salonId).toBeNull();
    expect((await getAvailableSlots(db, ctx, SUNDAY, { now: NOW })).map(hhmm)).toEqual(["16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30"]);
  });

  it("CONSISTENCY: a time is offered if and only if createBooking accepts it", async () => {
    const s = await scenario();
    await createBooking(db, await makeUser(db), { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "12:00") }, clock);
    await addTimeOff(db, s.owner, { salonId: s.salon.id, stylistId: s.stylist.id, startsAt: at(SUNDAY, "15:00"), endsAt: at(SUNDAY, "16:00") });
    const offered = new Set((await getAvailableSlots(db, s.ctx, SUNDAY, { now: NOW })).map((d) => d.getTime()));
    const customer = await makeUser(db);
    let checked = 0;
    for (let m = 9 * 60; m <= 19 * 60; m += 15) {
      const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const iso = at(SUNDAY, t);
      const accepted = await createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: iso }, clock).then(
        async (b) => (await cancelBooking(db, customer, { bookingId: b.id }, clock), true),
        () => false,
      );
      expect(accepted, `${t}: offered=${offered.has(new Date(iso).getTime())}`).toBe(offered.has(new Date(iso).getTime()));
      checked++;
    }
    expect(checked).toBe(41);
  });
});
