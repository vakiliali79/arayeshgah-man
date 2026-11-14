import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { DEFAULT_TIMEZONE, timestamps, tstz } from "./_shared";
import { users } from "./auth";
import { accountStatus, userRole } from "./enums";
import { files } from "./files";

/**
 * اطلاعات پروفایل و نقش برنامه — جدا از جداول Better Auth.
 * نقش فقط از طریق سرویس‌های سمت سرور تغییر می‌کند.
 */
export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRole("role").notNull().default("customer"),
    /** زمانی که کاربر نقش اولیه خود را انتخاب کرد؛ پس از آن تغییر نقش فقط توسط ادمین */
    roleSelectedAt: tstz("role_selected_at"),
    fullName: text("full_name"),
    phone: text("phone").unique(),
    city: text("city"),
    avatarFileId: uuid("avatar_file_id").references(() => files.id, { onDelete: "set null" }),
    timezone: text("timezone").notNull().default(DEFAULT_TIMEZONE),
    /** حساب تعلیق‌شده نمی‌تواند وارد شود و نشست‌هایش باطل می‌شوند */
    status: accountStatus("status").notNull().default("active"),
    suspendedAt: tstz("suspended_at"),
    suspendedReason: text("suspended_reason"),
    ...timestamps,
  },
  (t) => [
    index("profiles_role_idx").on(t.role),
    check("profiles_suspended_reason_length", sql`${t.suspendedReason} is null or char_length(${t.suspendedReason}) between 3 and 500`),
    check("profiles_phone_format", sql`${t.phone} is null or ${t.phone} ~ '^09[0-9]{9}$'`),
    check("profiles_full_name_length", sql`${t.fullName} is null or char_length(${t.fullName}) between 1 and 80`),
  ],
);
