import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { salons } from "@/db/schema";
import { canCustomerCancel } from "@/server/bookings/rules";
import { cancelBooking, completeBooking, confirmBooking, createBooking } from "@/server/bookings/service";
import { countCustomerBookings, getCustomerBooking, getCustomerOverview, listCustomerBookings, listCustomerFavorites, listCustomerReviews } from "@/server/customer/queries";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { toggleFavorite } from "@/server/favorites/service";
import { setOwnAvatar } from "@/server/profiles/service";
import { createReview } from "@/server/reviews/service";
import { files } from "@/db/schema";
import { TRACKING_CODE_PATTERN } from "@/server/bookings/tracking";
import { NOW, SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);
const after = (iso: string, minutes: number) => ({ now: new Date(new Date(iso).getTime() + minutes * 60_000) });

describe("customer dashboard data", () => {
  beforeEach(() => resetDb(db));

  it("bookings get a unique tracking code", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    const a = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const b = await createBooking(db, await makeUser(db), { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "12:00") }, clock);
    expect(a.trackingCode).toMatch(TRACKING_CODE_PATTERN);
    expect(a.trackingCode).not.toBe(b.trackingCode);
  });

  it("splits bookings into upcoming / past / cancelled tabs and only shows the customer's own", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    const other = await makeUser(db);
    const up = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const done = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "12:00") }, clock);
    const cancelled = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "14:00") }, clock);
    await createBooking(db, other, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "16:00") }, clock);
    await confirmBooking(db, s.stylistUser, { bookingId: done.id }, clock);
    await completeBooking(db, s.stylistUser, { bookingId: done.id }, after(at(SUNDAY, "12:00"), 70));
    await cancelBooking(db, c, { bookingId: cancelled.id }, clock);

    const view = new Date(new Date(at(SUNDAY, "13:00")).getTime()); // پس از نوبت دوم
    expect((await listCustomerBookings(db, c, "upcoming", view)).map((b) => b.id)).toEqual([]);
    expect((await listCustomerBookings(db, c, "upcoming", NOW)).map((b) => b.id)).toEqual([up.id, done.id].filter((id) => id === up.id));
    expect((await listCustomerBookings(db, c, "past", view)).map((b) => b.id).sort()).toEqual([up.id, done.id].sort());
    expect((await listCustomerBookings(db, c, "cancelled", view)).map((b) => b.id)).toEqual([cancelled.id]);
    expect(await countCustomerBookings(db, c, view)).toEqual({ upcoming: 0, past: 2, cancelled: 1 });

    const row = (await listCustomerBookings(db, c, "cancelled", view))[0]!;
    expect(row).toMatchObject({ salonName: "سالن تست", stylistName: "آرایشگر تست", serviceName: "رنگ مو" });
  });

  it("booking details are only visible to their customer", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    const b = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const mine = await getCustomerBooking(db, c, b.id);
    expect(mine.booking.trackingCode).toBe(b.trackingCode);
    expect(mine.events.map((e) => e.toStatus)).toEqual(["pending"]);
    await expect(getCustomerBooking(db, await makeUser(db), b.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCustomerBooking(db, s.owner, b.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("overview counts reviews awaiting and next booking", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    const b = await createBooking(db, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    let o = await getCustomerOverview(db, c, NOW);
    expect(o.next?.id).toBe(b.id);
    await confirmBooking(db, s.stylistUser, { bookingId: b.id }, clock);
    await completeBooking(db, s.stylistUser, { bookingId: b.id }, after(at(SUNDAY, "10:00"), 70));
    o = await getCustomerOverview(db, c, NOW);
    expect(o.awaitingReview).toBe(1);
    await createReview(db, c, { bookingId: b.id, rating: 5, comment: "عالی" });
    o = await getCustomerOverview(db, c, NOW);
    expect([o.awaitingReview, o.reviews]).toEqual([0, 1]);
    expect(await listCustomerReviews(db, await makeUser(db))).toHaveLength(0);
    expect((await listCustomerReviews(db, c))[0]).toMatchObject({ rating: 5, serviceName: "رنگ مو" });
  });

  it("favorites toggle for salons and stylists; inactive targets are rejected", async () => {
    const s = await makeSalonScenario(db);
    const c = await makeUser(db);
    expect(await toggleFavorite(db, c, { salonId: s.salon.id })).toEqual({ favorited: true });
    expect(await toggleFavorite(db, c, { stylistId: s.stylist.id })).toEqual({ favorited: true });
    const fav = await listCustomerFavorites(db, c);
    expect([fav.salons.length, fav.stylists.length]).toEqual([1, 1]);
    expect(await listCustomerFavorites(db, await makeUser(db))).toEqual({ salons: [], stylists: [] });
    expect(await toggleFavorite(db, c, { salonId: s.salon.id })).toEqual({ favorited: false });

    await db.update(salons).set({ isActive: false }).where(eq(salons.id, s.salon.id));
    await expect(toggleFavorite(db, c, { salonId: s.salon.id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(toggleFavorite(db, c, { salonId: s.salon.id, stylistId: s.stylist.id })).rejects.toBeInstanceOf(ValidationError);
  });

  it("a user cannot set someone else's uploaded file as their avatar", async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    const [f] = await db.insert(files).values({ ownerId: a.userId, purpose: "avatar", storageKey: "aa/bb/x.png", mimeType: "image/png", sizeBytes: 1, sha256: "a".repeat(64) }).returning();
    await expect(setOwnAvatar(db, b, f!.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setOwnAvatar(db, a, f!.id)).resolves.toBeUndefined();
  });

  it("cancellation rule matches the server rule (2 hours before start)", () => {
    const startsAt = new Date("2026-11-22T10:00:00Z");
    expect(canCustomerCancel({ status: "pending", startsAt }, new Date("2026-11-22T07:59:00Z"))).toBe(true);
    expect(canCustomerCancel({ status: "confirmed", startsAt }, new Date("2026-11-22T08:30:00Z"))).toBe(false);
    expect(canCustomerCancel({ status: "completed", startsAt }, new Date("2026-11-21T00:00:00Z"))).toBe(false);
  });
});
