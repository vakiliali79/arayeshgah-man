import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, smallint, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tstz } from "./_shared";
import { users } from "./auth";
import { bookings } from "./bookings";
import { salons } from "./salons";
import { stylists } from "./stylists";

/** هر نوبتِ «انجام‌شده» حداکثر یک نظر دارد (بررسی وضعیت با trigger در مایگریشن 0001) */
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stylistId: uuid("stylist_id")
      .notNull()
      .references(() => stylists.id, { onDelete: "cascade" }),
    salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    reply: text("reply"),
    repliedAt: tstz("replied_at"),
    isHidden: boolean("is_hidden").notNull().default(false),
    /** دلیل مخفی‌سازی توسط مدیریت (تاریخچه کامل در admin_audit_logs) */
    hiddenReason: text("hidden_reason"),
    ...timestamps,
  },
  (t) => [
    index("reviews_stylist_idx").on(t.stylistId, t.createdAt.desc()),
    index("reviews_salon_idx").on(t.salonId, t.createdAt.desc()).where(sql`${t.salonId} is not null`),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
    check("reviews_comment_length", sql`${t.comment} is null or char_length(${t.comment}) <= 2000`),
    check("reviews_reply_length", sql`${t.reply} is null or char_length(${t.reply}) <= 2000`),
  ],
);
