import { sql } from "drizzle-orm";
import { check, index, pgTable, smallint, text, time, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tstz } from "./_shared";
import { users } from "./auth";
import { salons } from "./salons";
import { stylists } from "./stylists";

/**
 * برنامه هفتگی. سه حالت:
 *  - ساعات کار سالن:            salon_id ✓  stylist_id ✗
 *  - ساعات آرایشگر در یک سالن:   salon_id ✓  stylist_id ✓
 *  - ساعات آرایشگر مستقل:        salon_id ✗  stylist_id ✓
 * زمان‌ها «ساعت محلی» در منطقه زمانی سالن/آرایشگر هستند.
 * day_of_week مطابق EXTRACT(DOW) در PostgreSQL: ۰=یکشنبه … ۶=شنبه.
 * عدم هم‌پوشانی شیفت‌ها با exclusion constraint در مایگریشن سفارشی تضمین می‌شود.
 */
export const workingHours = pgTable(
  "working_hours",
  {
    id: id(),
    salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }),
    stylistId: uuid("stylist_id").references(() => stylists.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
    ...timestamps,
  },
  (t) => [
    index("working_hours_salon_idx").on(t.salonId, t.dayOfWeek),
    index("working_hours_stylist_idx").on(t.stylistId, t.dayOfWeek),
    check("working_hours_has_owner", sql`num_nonnulls(${t.salonId}, ${t.stylistId}) >= 1`),
    check("working_hours_day_range", sql`${t.dayOfWeek} between 0 and 6`),
    check("working_hours_order", sql`${t.closesAt} > ${t.opensAt}`),
  ],
);

/**
 * تعطیلی‌ها و بازه‌های عدم حضور (بازه مطلق timestamptz، مستقل از منطقه زمانی).
 *  - فقط salon_id: کل سالن تعطیل است
 *  - فقط stylist_id: آرایشگر در همه جا غایب است
 *  - هر دو: آرایشگر فقط در آن سالن غایب است
 */
export const workingTimeOff = pgTable(
  "working_time_off",
  {
    id: id(),
    salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }),
    stylistId: uuid("stylist_id").references(() => stylists.id, { onDelete: "cascade" }),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("working_time_off_salon_period_idx").on(t.salonId, t.startsAt, t.endsAt),
    index("working_time_off_stylist_period_idx").on(t.stylistId, t.startsAt, t.endsAt),
    check("working_time_off_has_owner", sql`num_nonnulls(${t.salonId}, ${t.stylistId}) >= 1`),
    check("working_time_off_order", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
