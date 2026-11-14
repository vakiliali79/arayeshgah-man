import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { notifications, salons, stylists } from "@/db/schema";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  createBooking,
  getBookingWithHistory,
  listMyBookings,
  listSalonBookings,
  listStylistBookings,
  markNoShow,
  rejectBooking,
} from "@/server/bookings/service";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { createReview } from "@/server/reviews/service";
import { acceptSalonInvitation, inviteSalonMember } from "@/server/salons/service";
import { SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
const after = (iso: string, minutes: number) => ({ now: new Date(new Date(iso).getTime() + minutes * 60_000) });

async function booked() {
  const s = await makeSalonScenario(db);
  const customer = await makeUser(db);
  const booking = await createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
  return { ...s, customer, booking };
}

describe("booking lifecycle", () => {
  beforeEach(() => resetDb(db));
  afterAll(closeTestDb);

  it("customer can cancel before the cutoff and the slot becomes available again", async () => {
    const s = await booked();
    const cancelled = await cancelBooking(db, s.customer, { bookingId: s.booking.id, reason: "تغییر برنامه" }, clock);
    expect(cancelled).toMatchObject({ status: "cancelled", cancelledBy: "customer", cancellationReason: "تغییر برنامه" });
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);

    const other = await makeUser(db);
    await expect(
      createBooking(db, other, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("customer cannot cancel within the cutoff window, but the salon can", async () => {
    const s = await booked();
    const late = after(at(SUNDAY, "10:00"), -60); // یک ساعت قبل از شروع
    await expect(cancelBooking(db, s.customer, { bookingId: s.booking.id }, late)).rejects.toMatchObject({ code: "CANCEL_WINDOW_PASSED" });
    await expect(cancelBooking(db, s.owner, { bookingId: s.booking.id }, late)).resolves.toMatchObject({ status: "cancelled", cancelledBy: "salon" });
  });

  it("only the provider side can confirm/reject; customers and strangers cannot", async () => {
    const s = await booked();
    const stranger = await makeUser(db, "stylist");
    await expect(confirmBooking(db, s.customer, { bookingId: s.booking.id }, clock)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(confirmBooking(db, stranger, { bookingId: s.booking.id }, clock)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(confirmBooking(db, s.stylistUser, { bookingId: s.booking.id }, clock)).resolves.toMatchObject({ status: "confirmed" });
    // رد فقط از حالت pending
    await expect(rejectBooking(db, s.stylistUser, { bookingId: s.booking.id }, clock)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("a receptionist with manage_bookings can confirm; one without it cannot", async () => {
    const s = await booked();
    const rec = await makeUser(db);
    const inv = await inviteSalonMember(db, s.owner, { salonId: s.salon.id, userId: rec.userId, role: "receptionist", permissions: [] });
    await acceptSalonInvitation(db, rec, inv.id);
    await expect(confirmBooking(db, rec, { bookingId: s.booking.id }, clock)).rejects.toBeInstanceOf(ForbiddenError);

    const rec2 = await makeUser(db);
    const inv2 = await inviteSalonMember(db, s.owner, { salonId: s.salon.id, userId: rec2.userId, role: "receptionist" });
    await acceptSalonInvitation(db, rec2, inv2.id);
    await expect(confirmBooking(db, rec2, { bookingId: s.booking.id }, clock)).resolves.toMatchObject({ status: "confirmed" });
  });

  it("rejection frees the slot and notifies the customer", async () => {
    const s = await booked();
    await expect(rejectBooking(db, s.stylistUser, { bookingId: s.booking.id, reason: "پر شده" }, clock)).resolves.toMatchObject({ status: "rejected" });
    const notes = await db.select().from(notifications).where(eq(notifications.userId, s.customer.userId));
    expect(notes.map((n) => n.type)).toContain("booking_rejected");
  });

  it("completion requires confirmation and that the appointment has started", async () => {
    const s = await booked();
    await expect(completeBooking(db, s.stylistUser, { bookingId: s.booking.id }, clock)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await confirmBooking(db, s.stylistUser, { bookingId: s.booking.id }, clock);
    await expect(completeBooking(db, s.stylistUser, { bookingId: s.booking.id }, clock)).rejects.toMatchObject({ code: "NOT_STARTED" });
    const done = await completeBooking(db, s.stylistUser, { bookingId: s.booking.id }, after(at(SUNDAY, "10:00"), 70));
    expect(done).toMatchObject({ status: "completed" });
    // وضعیت نهایی دیگر قابل تغییر نیست
    await expect(cancelBooking(db, s.owner, { bookingId: s.booking.id }, after(at(SUNDAY, "10:00"), 80))).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("records a full status history visible only to participants", async () => {
    const s = await booked();
    await confirmBooking(db, s.stylistUser, { bookingId: s.booking.id }, clock);
    await markNoShow(db, s.owner, { bookingId: s.booking.id }, after(at(SUNDAY, "10:00"), 20));
    const { booking, events } = await getBookingWithHistory(db, s.customer, s.booking.id);
    expect(booking.status).toBe("no_show");
    expect(events.map((e) => [e.fromStatus, e.toStatus, e.actorType])).toEqual([
      [null, "pending", "customer"],
      ["pending", "confirmed", "stylist"],
      ["confirmed", "no_show", "salon"],
    ]);
    const stranger = await makeUser(db);
    await expect(getBookingWithHistory(db, stranger, s.booking.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("booking history listings are scoped to the requester", async () => {
    const s = await booked();
    const other = await makeUser(db);
    expect(await listMyBookings(db, s.customer)).toHaveLength(1);
    expect(await listMyBookings(db, other)).toHaveLength(0);
    expect(await listMyBookings(db, s.customer, { status: ["cancelled"] })).toHaveLength(0);
    expect(await listStylistBookings(db, s.stylistUser, s.stylist.id)).toHaveLength(1);
    await expect(listStylistBookings(db, other, s.stylist.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await listSalonBookings(db, s.owner, s.salon.id)).toHaveLength(1);
    await expect(listSalonBookings(db, other, s.salon.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("reviews: only the customer, only after completion, only once; ratings are aggregated", async () => {
    const s = await booked();
    await expect(createReview(db, s.customer, { bookingId: s.booking.id, rating: 5 })).rejects.toMatchObject({ code: "NOT_COMPLETED" });
    await confirmBooking(db, s.stylistUser, { bookingId: s.booking.id }, clock);
    await completeBooking(db, s.stylistUser, { bookingId: s.booking.id }, after(at(SUNDAY, "10:00"), 70));
    const stranger = await makeUser(db);
    await expect(createReview(db, stranger, { bookingId: s.booking.id, rating: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await createReview(db, s.customer, { bookingId: s.booking.id, rating: 4, comment: "خوب بود" });
    await expect(createReview(db, s.customer, { bookingId: s.booking.id, rating: 5 })).rejects.toBeInstanceOf(ConflictError);

    const [st] = await db.select().from(stylists).where(eq(stylists.id, s.stylist.id));
    const [sa] = await db.select().from(salons).where(eq(salons.id, s.salon.id));
    expect([st!.ratingAvg, st!.ratingCount, sa!.ratingAvg, sa!.ratingCount]).toEqual([4, 1, 4, 1]);
  });
});
