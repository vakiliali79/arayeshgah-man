import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { users } from "./auth";
import { files } from "./files";
import { salons } from "./salons";
import { services } from "./services";
import { stylists } from "./stylists";

/** نمونه‌کار آرایشگر و/یا سالن. تصویر در جدول files (متادیتا) و روی دیسک است. */
export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: id(),
    stylistId: uuid("stylist_id").references(() => stylists.id, { onDelete: "cascade" }),
    salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    fileId: uuid("file_id")
      .notNull()
      .unique()
      .references(() => files.id, { onDelete: "restrict" }),
    title: text("title"),
    description: text("description"),
    isPublished: boolean("is_published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("portfolio_stylist_idx").on(t.stylistId, t.sortOrder),
    index("portfolio_salon_idx").on(t.salonId, t.sortOrder),
    check("portfolio_has_owner", sql`num_nonnulls(${t.stylistId}, ${t.salonId}) >= 1`),
    check("portfolio_title_length", sql`${t.title} is null or char_length(${t.title}) <= 120`),
  ],
);
