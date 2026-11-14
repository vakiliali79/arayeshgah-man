import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { DEFAULT_TIMEZONE, id, timestamps, tstz } from "./_shared";
import { users } from "./auth";
import { membershipStatus, salonMemberRole, salonPermission } from "./enums";
import { files } from "./files";

export const salons = pgTable(
  "salons",
  {
    id: id(),
    /** مالک حقوقی سالن؛ منبع اصلی مالکیت */
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    phone: text("phone"),
    city: text("city").notNull(),
    address: text("address").notNull(),
    /** منطقه/محله (برای فیلتر جستجو) */
    district: text("district"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    /** منطقه زمانی IANA؛ ساعات کاری به وقت محلی همین منطقه تفسیر می‌شوند */
    timezone: text("timezone").notNull().default(DEFAULT_TIMEZONE),
    coverFileId: uuid("cover_file_id").references(() => files.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    isVerified: boolean("is_verified").notNull().default(false),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2, mode: "number" }).notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("salons_owner_idx").on(t.ownerId),
    index("salons_city_active_idx").on(t.city, t.isActive),
    check("salons_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("salons_name_length", sql`char_length(${t.name}) between 2 and 120`),
    check("salons_rating_range", sql`${t.ratingAvg} between 0 and 5 and ${t.ratingCount} >= 0`),
    check("salons_phone_format", sql`${t.phone} is null or ${t.phone} ~ '^0[0-9]{10}$'`),
  ],
);

/**
 * عضویت کاربران در سالن (مالک، مدیر، آرایشگر، پذیرش) و مجوزهای هر عضو.
 * یک آرایشگر می‌تواند عضو چند سالن باشد.
 */
export const salonMembers = pgTable(
  "salon_members",
  {
    id: id(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: salonMemberRole("role").notNull(),
    status: membershipStatus("status").notNull().default("invited"),
    permissions: salonPermission("permissions").array().notNull().default(sql`'{}'::salon_permission[]`),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    joinedAt: tstz("joined_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("salon_members_salon_user_uq").on(t.salonId, t.userId),
    // هر سالن دقیقاً یک عضو با نقش owner
    uniqueIndex("salon_members_one_owner_uq").on(t.salonId).where(sql`${t.role} = 'owner'`),
    index("salon_members_user_idx").on(t.userId, t.status),
  ],
);
