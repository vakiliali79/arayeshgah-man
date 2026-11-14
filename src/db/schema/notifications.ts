import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, tstz } from "./_shared";
import { users } from "./auth";
import { notificationType } from "./enums";

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    readAt: tstz("read_at"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("notifications_user_unread_idx").on(t.userId).where(sql`${t.readAt} is null`),
    check("notifications_title_length", sql`char_length(${t.title}) between 1 and 200`),
  ],
);
