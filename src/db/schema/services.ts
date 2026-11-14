import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgTable, primaryKey, smallint, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { serviceCategories } from "./platform";
import { salons } from "./salons";
import { stylists } from "./stylists";

/**
 * خدمت متعلق به یک سالن یا یک آرایشگر مستقل (دقیقاً یکی).
 * قیمت به تومان و به‌صورت عدد صحیح ذخیره می‌شود؛ قیمت رزرو همیشه از اینجا خوانده می‌شود، نه از کلاینت.
 */
export const services = pgTable(
  "services",
  {
    id: id(),
    salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }),
    stylistId: uuid("stylist_id").references(() => stylists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** کلید دسته‌بندی (کلید خارجی به service_categories) */
    category: text("category")
      .notNull()
      .references(() => serviceCategories.key, { onUpdate: "cascade", onDelete: "restrict" }),
    durationMinutes: smallint("duration_minutes").notNull(),
    /** زمان آماده‌سازی بعد از خدمت؛ در بازه اشغال آرایشگر لحاظ می‌شود */
    bufferMinutes: smallint("buffer_minutes").notNull().default(0),
    priceToman: bigint("price_toman", { mode: "number" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("services_salon_idx").on(t.salonId).where(sql`${t.salonId} is not null`),
    index("services_stylist_idx").on(t.stylistId).where(sql`${t.stylistId} is not null`),
    check("services_single_owner", sql`num_nonnulls(${t.salonId}, ${t.stylistId}) = 1`),
    check("services_duration_range", sql`${t.durationMinutes} between 5 and 720 and ${t.durationMinutes} % 5 = 0`),
    check("services_buffer_range", sql`${t.bufferMinutes} between 0 and 120`),
    check("services_price_range", sql`${t.priceToman} >= 0 and ${t.priceToman} <= 1000000000`),
    check("services_name_length", sql`char_length(${t.name}) between 2 and 120`),
  ],
);

/** کدام آرایشگر کدام خدمت را ارائه می‌دهد (با قیمت/مدت اختصاصی اختیاری) */
export const stylistServices = pgTable(
  "stylist_services",
  {
    stylistId: uuid("stylist_id")
      .notNull()
      .references(() => stylists.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    customPriceToman: bigint("custom_price_toman", { mode: "number" }),
    customDurationMinutes: smallint("custom_duration_minutes"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.stylistId, t.serviceId] }),
    index("stylist_services_service_idx").on(t.serviceId),
    check("stylist_services_price_range", sql`${t.customPriceToman} is null or ${t.customPriceToman} between 0 and 1000000000`),
    check(
      "stylist_services_duration_range",
      sql`${t.customDurationMinutes} is null or (${t.customDurationMinutes} between 5 and 720 and ${t.customDurationMinutes} % 5 = 0)`,
    ),
  ],
);
