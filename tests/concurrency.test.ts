import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { bookings } from "@/db/schema";
import { BookingConflictError, cancelBooking, confirmBooking, createBooking } from "@/server/bookings/service";
import { SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";
import { getTestDatabaseUrl } from "./helpers/env";

const db = getTestDb();

describe("concurrent booking attempts", () => {
  beforeEach(() => resetDb(db));
  afterAll(closeTestDb);

  it("exactly one of many simultaneous requests for the same slot succeeds", async () => {
    const s = await makeSalonScenario(db);
    const customers = await Promise.all(Array.from({ length: 12 }, () => makeUser(db)));

    // هر درخواست از Pool جداگانه (اتصال مستقل) تا واقعاً هم‌زمان در PostgreSQL اجرا شوند
    const pools = customers.map(() => createDb(getTestDatabaseUrl(), { max: 1 }));
    try {
      const results = await Promise.allSettled(
        customers.map((c, i) =>
          createBooking(pools[i]!, c, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(ok).toHaveLength(1);
      expect(failed).toHaveLength(11);
      for (const f of failed) {
        expect(f.reason).toBeInstanceOf(BookingConflictError);
        expect(f.reason.code).toBe("SLOT_TAKEN");
      }
    } finally {
      await Promise.all(pools.map((p) => p.$client.end()));
    }

    const active = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.stylistId, s.stylist.id), inArray(bookings.status, ["pending", "confirmed"])));
    expect(active).toHaveLength(1);
  });

  it("partially overlapping simultaneous requests: at most one wins", async () => {
    const s = await makeSalonScenario(db);
    const times = ["10:00", "10:15", "10:30", "10:45", "11:00"];
    const customers = await Promise.all(times.map(() => makeUser(db)));
    const pools = customers.map(() => createDb(getTestDatabaseUrl(), { max: 1 }));
    try {
      const results = await Promise.allSettled(
        times.map((t, i) =>
          createBooking(pools[i]!, customers[i]!, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, t) }, clock),
        ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    } finally {
      await Promise.all(pools.map((p) => p.$client.end()));
    }
  });

  it("concurrent confirm and cancel on the same booking: exactly one state change applies", async () => {
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db);
    const b = await createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const [p1, p2] = [createDb(getTestDatabaseUrl(), { max: 1 }), createDb(getTestDatabaseUrl(), { max: 1 })];
    try {
      const results = await Promise.allSettled([
        confirmBooking(p1, s.stylistUser, { bookingId: b.id }, clock),
        cancelBooking(p2, customer, { bookingId: b.id }, clock),
      ]);
      const [row] = await db.select().from(bookings).where(eq(bookings.id, b.id));
      // هر دو ممکن است موفق شوند فقط اگر ترتیب confirm → cancel باشد (انتقال مجاز)؛ هرگز وضعیت نامعتبر
      expect(["confirmed", "cancelled"]).toContain(row!.status);
      expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    } finally {
      await Promise.all([p1.$client.end(), p2.$client.end()]);
    }
  });
});
