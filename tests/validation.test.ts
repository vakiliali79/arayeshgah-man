import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/server/bookings/service";
import { ValidationError } from "@/server/errors";
import { updateOwnProfile } from "@/server/profiles/service";
import { createSalon } from "@/server/salons/service";
import { addWorkingHours } from "@/server/schedules/service";
import { createService } from "@/server/catalog/service";
import { SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();

async function fieldErrors(p: Promise<unknown>) {
  const err = await p.catch((e) => e);
  expect(err).toBeInstanceOf(ValidationError);
  return Object.keys((err as ValidationError).fieldErrors);
}

describe("server-side input validation", () => {
  beforeEach(() => resetDb(db));
  afterAll(closeTestDb);

  it("booking: requires UUIDs, offset-qualified ISO datetimes and a bounded note", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    expect(await fieldErrors(createBooking(db, c, { stylistId: "1", serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock))).toContain("stylistId");
    // بدون offset (ساعت محلی مبهم) پذیرفته نمی‌شود
    expect(await fieldErrors(createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: "2026-11-22T10:00:00" }, clock))).toContain("startsAt");
    expect(
      await fieldErrors(
        createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00"), customerNote: "x".repeat(501) }, clock),
      ),
    ).toContain("customerNote");
  });

  it("profile: normalizes Persian digits in phone numbers and rejects invalid ones", async () => {
    const u = await makeUser(db);
    await expect(updateOwnProfile(db, u, { phone: "۰۹۱۲ ۳۴۵ ۶۷۸۹" })).resolves.toMatchObject({ phone: "09123456789" });
    expect(await fieldErrors(updateOwnProfile(db, u, { phone: "0212345678" }))).toContain("phone");
  });

  it("salon: validates slug format and IANA time zone", async () => {
    const owner = await makeUser(db, "salon_owner");
    const base = { name: "سالن", city: "تهران", address: "آدرس کامل سالن" };
    expect(await fieldErrors(createSalon(db, owner, { ...base, slug: "Bad Slug!" }))).toContain("slug");
    expect(await fieldErrors(createSalon(db, owner, { ...base, slug: "ok-slug", timezone: "Mars/Olympus" }))).toContain("timezone");
  });

  it("service: duration must be a positive multiple of 5 and price a non-negative integer", async () => {
    const s = await makeSalonScenario(db);
    const base = { salonId: s.salon.id, name: "خدمت", category: "hair" };
    expect(await fieldErrors(createService(db, s.owner, { ...base, durationMinutes: 7, priceToman: 100 }))).toContain("durationMinutes");
    expect(await fieldErrors(createService(db, s.owner, { ...base, durationMinutes: 30, priceToman: 10.5 }))).toContain("priceToman");
  });

  it("working hours: closing must be after opening, in HH:MM", async () => {
    const s = await makeSalonScenario(db);
    await expect(addWorkingHours(db, s.owner, { salonId: s.salon.id, dayOfWeek: 5, opensAt: "18:00", closesAt: "09:00" })).rejects.toBeInstanceOf(ValidationError);
    expect(await fieldErrors(addWorkingHours(db, s.owner, { salonId: s.salon.id, dayOfWeek: 7, opensAt: "9", closesAt: "25:00" }))).toEqual(
      expect.arrayContaining(["dayOfWeek", "opensAt", "closesAt"]),
    );
  });
});
