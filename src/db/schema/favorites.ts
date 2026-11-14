import { sql } from "drizzle-orm";
import { check, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tstz } from "./_shared";
import { users } from "./auth";
import { salons } from "./salons";
import { stylists } from "./stylists";

/** علاقه‌مندی‌های مشتری: یا یک سالن یا یک آرایشگر */
export const favorites = pgTable(
  "favorites",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }),
    stylistId: uuid("stylist_id").references(() => stylists.id, { onDelete: "cascade" }),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("favorites_single_target", sql`num_nonnulls(${t.salonId}, ${t.stylistId}) = 1`),
    uniqueIndex("favorites_customer_salon_uq").on(t.customerId, t.salonId).where(sql`${t.salonId} is not null`),
    uniqueIndex("favorites_customer_stylist_uq").on(t.customerId, t.stylistId).where(sql`${t.stylistId} is not null`),
  ],
);
