import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { users } from "./auth";
import { bookings } from "./bookings";
import { ticketKind, ticketStatus } from "./enums";
import { reviews } from "./reviews";
import { salons } from "./salons";

/** پیام‌های فرم تماس/پشتیبانی، شکایت‌ها و گزارش نظرات نامناسب (برای بررسی ادمین) */
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: id(),
    kind: ticketKind("kind").notNull(),
    status: ticketStatus("status").notNull().default("open"),
    /** کاربر واردشده (اختیاری؛ فرم تماس برای مهمان هم باز است) */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "set null" }),
    salonId: uuid("salon_id").references(() => salons.id, { onDelete: "set null" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    adminNote: text("admin_note"),
    ...timestamps,
  },
  (t) => [
    index("support_tickets_status_idx").on(t.status, t.createdAt.desc()),
    index("support_tickets_user_idx").on(t.userId),
    check("support_tickets_name_length", sql`char_length(${t.name}) between 2 and 80`),
    check("support_tickets_subject_length", sql`char_length(${t.subject}) between 3 and 120`),
    check("support_tickets_message_length", sql`char_length(${t.message}) between 10 and 4000`),
    check("support_tickets_phone_format", sql`${t.phone} is null or ${t.phone} ~ '^09[0-9]{9}$'`),
  ],
);
