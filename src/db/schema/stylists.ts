import { sql } from "drizzle-orm";
import { boolean, check, integer, numeric, pgTable, smallint, text, uuid } from "drizzle-orm/pg-core";
import { DEFAULT_TIMEZONE, id, timestamps } from "./_shared";
import { users } from "./auth";

/**
 * اطلاعات تخصصی آرایشگر. ارتباط با سالن‌ها از طریق salon_members است؛
 * آرایشگر مستقل هم می‌تواند خدمات و ساعات کاری مستقل خودش را داشته باشد.
 */
export const stylists = pgTable(
  "stylists",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    /** شناسه یکتای آدرس صفحه عمومی (/stylists/[slug]) */
    slug: text("slug").notNull().unique(),
    /** موقعیت آرایشگر مستقل (برای عضو سالن، شهر سالن ملاک است) */
    city: text("city"),
    district: text("district"),
    bio: text("bio"),
    specialties: text("specialties").array().notNull().default(sql`'{}'::text[]`),
    yearsExperience: smallint("years_experience"),
    /** آیا خارج از سالن هم به‌صورت مستقل نوبت می‌پذیرد */
    acceptsIndependentBookings: boolean("accepts_independent_bookings").notNull().default(false),
    /** منطقه زمانی برای ساعات کاری مستقل */
    timezone: text("timezone").notNull().default(DEFAULT_TIMEZONE),
    isActive: boolean("is_active").notNull().default(true),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2, mode: "number" }).notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("stylists_display_name_length", sql`char_length(${t.displayName}) between 2 and 80`),
    check("stylists_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("stylists_experience_range", sql`${t.yearsExperience} is null or ${t.yearsExperience} between 0 and 70`),
    check("stylists_rating_range", sql`${t.ratingAvg} between 0 and 5 and ${t.ratingCount} >= 0`),
  ],
);
