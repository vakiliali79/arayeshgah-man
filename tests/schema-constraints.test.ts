import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, favorites, files, profiles, reviews, services, workingHours } from "@/db/schema";
import { createBooking } from "@/server/bookings/service";
import { findPgError } from "@/server/errors";
import { SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();

async function pgCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return findPgError(err);
  }
  throw new Error("expected a database error");
}

describe("schema constraints", () => {
  beforeEach(() => resetDb(db));
  afterAll(closeTestDb);

  it("rejects an invalid profile phone number", async () => {
    const u = await makeUser(db);
    const e = await pgCode(db.update(profiles).set({ phone: "12345" }).where(eq(profiles.userId, u.userId)));
    expect(e).toMatchObject({ code: "23514", constraint: "profiles_phone_format" });
  });

  it("requires a service to belong to exactly one of salon or stylist", async () => {
    const e = await pgCode(db.insert(services).values({ name: "بی‌صاحب", category: "hair", durationMinutes: 30, priceToman: 1000 }));
    expect(e).toMatchObject({ code: "23514", constraint: "services_single_owner" });
  });

  it("rejects non-5-minute durations and negative prices", async () => {
    const { salon } = await makeSalonScenario(db);
    expect(
      await pgCode(db.insert(services).values({ salonId: salon.id, name: "x خدمت", category: "hair", durationMinutes: 33, priceToman: 1 })),
    ).toMatchObject({ constraint: "services_duration_range" });
    expect(
      await pgCode(db.insert(services).values({ salonId: salon.id, name: "x خدمت", category: "hair", durationMinutes: 30, priceToman: -1 })),
    ).toMatchObject({ constraint: "services_price_range" });
  });

  it("prevents overlapping shifts for the same owner and day (exclusion)", async () => {
    const { salon } = await makeSalonScenario(db);
    const e = await pgCode(db.insert(workingHours).values({ salonId: salon.id, dayOfWeek: 0, opensAt: "19:00", closesAt: "22:00" }));
    expect(e).toMatchObject({ code: "23P01", constraint: "working_hours_no_overlap" });
  });

  it("enforces booking duration consistency", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    const e = await pgCode(
      db.insert(bookings).values({
        customerId: c.userId, stylistId: s.stylist.id, salonId: s.salon.id, serviceId: s.service.id,
        startsAt: new Date(at(SUNDAY, "10:00")), endsAt: new Date(at(SUNDAY, "10:30")), blockedUntil: new Date(at(SUNDAY, "10:30")),
        serviceName: "x", durationMinutes: 60, bufferMinutes: 0, priceToman: 1, timezone: "Asia/Tehran", trackingCode: "AM-TEST000001",
      }),
    );
    expect(e).toMatchObject({ code: "23514", constraint: "bookings_duration_matches" });
  });

  it("blocks invalid status transitions and price changes at the database level", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    const b = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);

    expect(
      await pgCode(db.update(bookings).set({ status: "completed", completedAt: new Date() }).where(eq(bookings.id, b.id))),
    ).toMatchObject({ code: "23514", constraint: "bookings_status_transition" });
    expect(await pgCode(db.update(bookings).set({ priceToman: 1 }).where(eq(bookings.id, b.id)))).toMatchObject({
      constraint: "bookings_immutable_fields",
    });
  });

  it("only allows reviews for completed bookings", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    const b = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const e = await pgCode(
      db.insert(reviews).values({ bookingId: b.id, customerId: c.userId, stylistId: s.stylist.id, salonId: s.salon.id, rating: 5 }),
    );
    expect(e).toMatchObject({ code: "23514", constraint: "reviews_booking_completed" });
  });

  it("requires favorites to target exactly one entity and be unique", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    expect(await pgCode(db.insert(favorites).values({ customerId: c.userId }))).toMatchObject({ constraint: "favorites_single_target" });
    await db.insert(favorites).values({ customerId: c.userId, salonId: s.salon.id });
    expect(await pgCode(db.insert(favorites).values({ customerId: c.userId, salonId: s.salon.id }))).toMatchObject({ code: "23505" });
  });

  it("rejects unsafe storage keys and disallowed MIME types in file metadata", async () => {
    const u = await makeUser(db);
    const base = { ownerId: u.userId, purpose: "avatar" as const, sizeBytes: 10, sha256: "a".repeat(64) };
    expect(await pgCode(db.insert(files).values({ ...base, storageKey: "../etc/passwd", mimeType: "image/png" }))).toMatchObject({
      constraint: "files_storage_key_safe",
    });
    expect(await pgCode(db.insert(files).values({ ...base, storageKey: "aa/bb/x.svg", mimeType: "image/svg+xml" }))).toMatchObject({
      constraint: "files_mime_allowed",
    });
  });

  it("maintains updated_at via trigger", async () => {
    const u = await makeUser(db);
    const before = await db.execute<{ t: Date }>(sql`select updated_at as t from profiles where user_id = ${u.userId}`);
    await new Promise((r) => setTimeout(r, 20));
    await db.update(profiles).set({ city: "تهران" }).where(eq(profiles.userId, u.userId));
    const after = await db.execute<{ t: Date }>(sql`select updated_at as t from profiles where user_id = ${u.userId}`);
    expect(new Date(after.rows[0]!.t).getTime()).toBeGreaterThan(new Date(before.rows[0]!.t).getTime());
  });
});
