import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

/** کلید اصلی UUID تولیدشده در دیتابیس */
export const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);

/** همه زمان‌ها timestamptz هستند (UTC در دیتابیس، تبدیل به منطقه زمانی فقط در نمایش/اعتبارسنجی) */
export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const timestamps = {
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
};

/** منطقه زمانی پیش‌فرض کسب‌وکارها */
export const DEFAULT_TIMEZONE = "Asia/Tehran";
