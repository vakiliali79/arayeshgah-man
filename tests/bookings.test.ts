import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bookingEvents, notifications, salonMembers, workingHours } from "@/db/schema";
import { BookingConflictError, createBooking } from "@/server/bookings/service";
import { assignServiceToStylist, createService } from "@/server/catalog/service";
import { BusinessRuleError, ValidationError } from "@/server/errors";
import { addTimeOff, addWorkingHours } from "@/server/schedules/service";
import { createStylistProfile } from "@/server/stylists/service";
import { FRIDAY, NOW, SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();

describe("booking creation", () => {
  beforeEach(() => resetDb(db));
  afterAll(closeTestDb);

  it("creates a pending booking with server-side price, duration, buffer and timezone", async () => {
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db);
    const b = await createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);

    expect(b).toMatchObject({
      status: "pending",
      customerId: customer.userId,
      salonId: s.salon.id,
      priceToman: 1_200_000, // قیمت اختصاصی آرایشگر از دیتابیس
      durationMinutes: 60,
      bufferMinutes: 15,
      timezone: "Asia/Tehran",
      serviceName: "رنگ مو",
    });
    expect(b.startsAt.toISOString()).toBe("2026-11-22T06:30:00.000Z"); // 10:00 تهران
    expect(b.endsAt.toISOString()).toBe("2026-11-22T07:30:00.000Z");
    expect(b.blockedUntil.toISOString()).toBe("2026-11-22T07:45:00.000Z");

    const events = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, b.id));
    expect(events).toMatchObject([{ fromStatus: null, toStatus: "pending", actorType: "customer" }]);
    const notes = await db.select().from(notifications).where(eq(notifications.userId, s.stylistUser.userId));
    expect(notes).toHaveLength(1);
  });

  it("never accepts client-submitted price, status or customer", async () => {
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db);
    const base = { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") };
    for (const extra of [{ priceToman: 1 }, { status: "confirmed" }, { customerId: s.owner.userId }]) {
      await expect(createBooking(db, customer, { ...base, ...extra }, clock)).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it("interprets the same instant in any offset identically (timezone-safe)", async () => {
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db);
    // 06:30Z == 10:00 Tehran
    const b = await createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: "2026-11-22T06:30:00Z" }, clock);
    expect(b.startsAt.toISOString()).toBe("2026-11-22T06:30:00.000Z");
  });

  it("rejects bookings outside salon opening hours (local time)", async () => {
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db);
    // 09:30 تهران = قبل از باز شدن
    await expect(
      createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "09:30") }, clock),
    ).rejects.toMatchObject({ code: "SALON_CLOSED" });
    // جمعه سالن تعطیل است
    await expect(
      createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(FRIDAY, "12:00") }, clock),
    ).rejects.toMatchObject({ code: "SALON_CLOSED" });
  });

  it("rejects bookings outside the stylist's shift even if the salon is open", async () => {
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db);
    // سالن تا ۲۰ باز است اما شیفت آرایشگر ۱۸ تمام می‌شود؛ ۱۷:۳۰ + ۶۰ دقیقه = ۱۸:۳۰
    await expect(
      createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "17:30") }, clock),
    ).rejects.toMatchObject({ code: "STYLIST_UNAVAILABLE" });
    // ۱۷:۰۰ تا ۱۸:۰۰ دقیقاً در مرز شیفت مجاز است
    await expect(
      createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "17:00") }, clock),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("supports a shift that ends at midnight (24:00)", async () => {
    const s = await makeSalonScenario(db);
    await db.delete(workingHours).where(eq(workingHours.salonId, s.salon.id));
    await addWorkingHours(db, s.owner, { salonId: s.salon.id, dayOfWeek: 0, opensAt: "18:00", closesAt: "24:00" });
    await addWorkingHours(db, s.owner, { salonId: s.salon.id, stylistId: s.stylist.id, dayOfWeek: 0, opensAt: "18:00", closesAt: "24:00" });
    const customer = await makeUser(db);
    await expect(
      createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "23:00") }, clock),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("rejects bookings during salon closures and stylist time off", async () => {
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db);
    await addTimeOff(db, s.owner, { salonId: s.salon.id, startsAt: at(SUNDAY, "12:00"), endsAt: at(SUNDAY, "14:00"), reason: "تعمیرات" });
    await expect(
      createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "11:30") }, clock),
    ).rejects.toMatchObject({ code: "TIME_OFF" });

    await addTimeOff(db, s.owner, { salonId: s.salon.id, stylistId: s.stylist.id, startsAt: at(SUNDAY, "15:00"), endsAt: at(SUNDAY, "16:00") });
    await expect(
      createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "15:30") }, clock),
    ).rejects.toMatchObject({ code: "TIME_OFF" });
  });

  it("treats the buffer as occupied time: back-to-back bookings must respect it", async () => {
    const s = await makeSalonScenario(db);
    const [c1, c2] = [await makeUser(db), await makeUser(db)];
    await createBooking(db, c1, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    // ۱۰:۰۰–۱۱:۰۰ + ۱۵ دقیقه آماده‌سازی → ۱۱:۰۰ تداخل دارد، ۱۱:۱۵ آزاد است
    await expect(
      createBooking(db, c2, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "11:00") }, clock),
    ).rejects.toBeInstanceOf(BookingConflictError);
    await expect(
      createBooking(db, c2, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "11:15") }, clock),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("prevents overlapping bookings for the same stylist (sequential)", async () => {
    const s = await makeSalonScenario(db);
    const [c1, c2] = [await makeUser(db), await makeUser(db)];
    await createBooking(db, c1, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const err = await createBooking(db, c2, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:30") }, clock).catch((e) => e);
    expect(err).toBeInstanceOf(BookingConflictError);
    expect(err.code).toBe("SLOT_TAKEN");
  });

  it("prevents a customer from holding two overlapping active bookings", async () => {
    const a = await makeSalonScenario(db);
    const b = await makeSalonScenario(db);
    const customer = await makeUser(db);
    await createBooking(db, customer, { stylistId: a.stylist.id, serviceId: a.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const err = await createBooking(db, customer, { stylistId: b.stylist.id, serviceId: b.service.id, startsAt: at(SUNDAY, "10:30") }, clock).catch((e) => e);
    expect(err).toBeInstanceOf(BookingConflictError);
    expect(err.code).toBe("CUSTOMER_OVERLAP");
  });

  it("rejects stylists who are no longer active members of the salon", async () => {
    const s = await makeSalonScenario(db);
    await db.update(salonMembers).set({ status: "left" }).where(eq(salonMembers.userId, s.stylistUser.userId));
    const customer = await makeUser(db);
    await expect(
      createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock),
    ).rejects.toMatchObject({ code: "STYLIST_NOT_IN_SALON" });
  });

  it("rejects services the stylist does not offer", async () => {
    const s = await makeSalonScenario(db);
    const other = await createService(db, s.owner, { salonId: s.salon.id, name: "ناخن", category: "nail", durationMinutes: 30, priceToman: 500_000 });
    const customer = await makeUser(db);
    await expect(
      createBooking(db, customer, { stylistId: s.stylist.id, serviceId: other.id, startsAt: at(SUNDAY, "10:00") }, clock),
    ).rejects.toMatchObject({ code: "SERVICE_NOT_OFFERED" });
  });

  it("enforces lead time, horizon and slot alignment", async () => {
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db);
    const base = { stylistId: s.stylist.id, serviceId: s.service.id };
    await expect(createBooking(db, customer, { ...base, startsAt: at(SUNDAY, "10:07") }, clock)).rejects.toMatchObject({ code: "INVALID_SLOT" });
    await expect(createBooking(db, customer, { ...base, startsAt: new Date(NOW.getTime() + 5 * 60_000).toISOString() }, clock)).rejects.toMatchObject({ code: "TOO_SOON" });
    await expect(createBooking(db, customer, { ...base, startsAt: "2027-06-01T07:00:00Z" }, clock)).rejects.toMatchObject({ code: "TOO_FAR" });
  });

  it("supports independent stylist bookings (no salon)", async () => {
    const stylistUser = await makeUser(db, "stylist");
    const stylist = await createStylistProfile(db, stylistUser, { displayName: "آرایشگر مستقل", acceptsIndependentBookings: true });
    await addWorkingHours(db, stylistUser, { stylistId: stylist.id, dayOfWeek: 0, opensAt: "16:00", closesAt: "21:00" });
    const service = await createService(db, stylistUser, { stylistId: stylist.id, name: "پاکسازی پوست", category: "skin", durationMinutes: 60, priceToman: 900_000 });
    await assignServiceToStylist(db, stylistUser, { stylistId: stylist.id, serviceId: service.id });

    const customer = await makeUser(db);
    const b = await createBooking(db, customer, { stylistId: stylist.id, serviceId: service.id, startsAt: at(SUNDAY, "17:00") }, clock);
    expect(b).toMatchObject({ salonId: null, priceToman: 900_000, timezone: "Asia/Tehran" });
    await expect(
      createBooking(db, await makeUser(db), { stylistId: stylist.id, serviceId: service.id, startsAt: at(SUNDAY, "12:00") }, clock),
    ).rejects.toMatchObject({ code: "STYLIST_UNAVAILABLE" });
  });

  it("does not let a stylist book themselves", async () => {
    const s = await makeSalonScenario(db);
    await expect(
      createBooking(db, s.stylistUser, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
