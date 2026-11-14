import { sql } from "drizzle-orm";
import { bigint, boolean, check, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tstz } from "./_shared";
import { users } from "./auth";
import { planAudience, serviceCategory } from "./enums";

/**
 * نمایش دسته‌بندی‌های خدمات (برچسب فارسی، ترتیب، فعال/غیرفعال) — قابل مدیریت توسط ادمین.
 * کلیدها همان enum service_category هستند؛ افزودن کلید جدید نیاز به Migration دارد.
 */
export const serviceCategories = pgTable(
  "service_categories",
  {
    key: serviceCategory("key").primaryKey(),
    label: text("label").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [check("service_categories_label_length", sql`char_length(${t.label}) between 2 and 60`)],
);

/** پلن‌های اشتراک برای سالن‌ها و آرایشگران (فقط نمایش تعرفه؛ پرداخت در این فاز نیست) */
export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    audience: planAudience("audience").notNull(),
    priceMonthlyToman: bigint("price_monthly_toman", { mode: "number" }).notNull(),
    features: text("features").array().notNull().default(sql`'{}'::text[]`),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("subscription_plans_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("subscription_plans_price", sql`${t.priceMonthlyToman} between 0 and 1000000000`),
    check("subscription_plans_name_length", sql`char_length(${t.name}) between 2 and 60`),
  ],
);

/** تنظیمات و محتوای قابل ویرایش سایت (کلید ← مقدار JSON) */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});
