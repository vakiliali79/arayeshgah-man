import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, smallint, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tstz } from "./_shared";
import { users } from "./auth";
import { bookingActor, bookingStatus } from "./enums";
import { salons } from "./salons";
import { services } from "./services";
import { stylists } from "./stylists";

/**
 * نوبت‌ها. قیمت، مدت و نام خدمت هنگام ثبت «اسنپ‌شات» می‌شوند تا تغییرات بعدی خدمت
 * روی تاریخچه اثر نگذارد.
 *
 * جلوگیری از تداخل در سطح دیتابیس (مایگریشن سفارشی 0001):
 *   EXCLUDE USING gist (stylist_id WITH =, tstzrange(starts_at, blocked_until) WITH &&)
 *   WHERE status IN ('pending','confirmed')
 */
export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    stylistId: uuid("stylist_id")
      .notNull()
      .references(() => stylists.id, { onDelete: "restrict" }),
    /** null یعنی نوبت مستقل آرایشگر (خارج از سالن) */
    salonId: uuid("salon_id").references(() => salons.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    status: bookingStatus("status").notNull().default("pending"),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    /** پایان بازه اشغال آرایشگر = ends_at + زمان آماده‌سازی */
    blockedUntil: tstz("blocked_until").notNull(),
    serviceName: text("service_name").notNull(),
    durationMinutes: smallint("duration_minutes").notNull(),
    bufferMinutes: smallint("buffer_minutes").notNull().default(0),
    priceToman: bigint("price_toman", { mode: "number" }).notNull(),
    /** منطقه زمانی محل ارائه خدمت در زمان رزرو */
    timezone: text("timezone").notNull(),
    customerNote: text("customer_note"),
    cancellationReason: text("cancellation_reason"),
    cancelledBy: bookingActor("cancelled_by"),
    confirmedAt: tstz("confirmed_at"),
    completedAt: tstz("completed_at"),
    cancelledAt: tstz("cancelled_at"),
    rejectedAt: tstz("rejected_at"),
    ...timestamps,
  },
  (t) => [
    index("bookings_customer_starts_idx").on(t.customerId, t.startsAt.desc()),
    index("bookings_stylist_starts_idx").on(t.stylistId, t.startsAt),
    index("bookings_salon_starts_idx").on(t.salonId, t.startsAt).where(sql`${t.salonId} is not null`),
    index("bookings_status_idx").on(t.status),
    check("bookings_time_order", sql`${t.endsAt} > ${t.startsAt} and ${t.blockedUntil} >= ${t.endsAt}`),
    check(
      "bookings_duration_matches",
      sql`${t.endsAt} - ${t.startsAt} = make_interval(mins => ${t.durationMinutes}::int)
        and ${t.blockedUntil} - ${t.endsAt} = make_interval(mins => ${t.bufferMinutes}::int)`,
    ),
    check("bookings_price_non_negative", sql`${t.priceToman} >= 0`),
    check("bookings_note_length", sql`${t.customerNote} is null or char_length(${t.customerNote}) <= 500`),
    check(
      "bookings_status_timestamps",
      sql`(${t.status} <> 'cancelled' or ${t.cancelledAt} is not null)
        and (${t.status} <> 'rejected' or ${t.rejectedAt} is not null)
        and (${t.status} <> 'completed' or ${t.completedAt} is not null)
        and (${t.status} <> 'confirmed' or ${t.confirmedAt} is not null)`,
    ),
  ],
);

/** تاریخچه تغییر وضعیت هر نوبت (Audit trail) */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: bookingStatus("from_status"),
    toStatus: bookingStatus("to_status").notNull(),
    actorType: bookingActor("actor_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("booking_events_booking_idx").on(t.bookingId, t.createdAt)],
);
