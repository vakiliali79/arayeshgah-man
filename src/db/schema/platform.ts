import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tstz } from "./_shared";
import { users } from "./auth";
import { planAudience } from "./enums";

/**
 * نمایش دسته‌بندی‌های خدمات (برچسب فارسی، ترتیب، فعال/غیرفعال) — قابل مدیریت توسط ادمین.
 * کلید متنی (حروف کوچک لاتین) است و services.category با کلید خارجی به آن ارجاع می‌دهد؛
 * ادمین می‌تواند دسته‌بندی جدید اضافه کند. حذف دسته‌بندی در حال استفاده ممکن نیست (فقط غیرفعال‌سازی).
 */
export const serviceCategories = pgTable(
  "service_categories",
  {
    key: text("key").primaryKey(),
    label: text("label").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check("service_categories_label_length", sql`char_length(${t.label}) between 2 and 60`),
    check("service_categories_key_format", sql`${t.key} ~ '^[a-z][a-z0-9_]{1,31}$'`),
  ],
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

/**
 * تاریخچه اقدامات مدیریتی (فقط افزودنی): چه کسی، چه زمانی، روی چه چیزی، با چه دلیلی و چه تغییری.
 * یک trigger در دیتابیس ویرایش/حذف ردیف‌ها را رد می‌کند (به جز null شدن actor پس از حذف کاربر).
 */
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    summary: text("summary"),
    reason: text("reason"),
    changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>().notNull().default({}),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("admin_audit_logs_target_idx").on(t.targetType, t.targetId, t.createdAt.desc()),
    index("admin_audit_logs_created_idx").on(t.createdAt.desc()),
    check("admin_audit_logs_action_format", sql`${t.action} ~ '^[a-z_]+\\.[a-z_]+$'`),
    check("admin_audit_logs_reason_length", sql`${t.reason} is null or char_length(${t.reason}) <= 1000`),
  ],
);
