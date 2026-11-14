import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import { files, profiles, users } from "@/db/schema";
import { TEST_MODE_ADMIN_PHONE } from "../otp/config";
import { AppError } from "../errors";

/** شماره مدیر کل اصلی پلتفرم */
export const SUPER_ADMIN_PHONE = TEST_MODE_ADMIN_PHONE;

export class SuperAdminProtectedError extends AppError {
  constructor() {
    super("SUPER_ADMIN_PROTECTED", "The super admin role cannot be changed", 403);
  }
}
import type { UserRole } from "@/db/types";
import { isAdmin, type Actor } from "../auth/actor";
import { ConflictError, ForbiddenError, NotFoundError, PG, findPgError } from "../errors";
import { parseInput } from "../validation";

import { SELF_ASSIGNABLE_ROLES, type SelfAssignableRole } from "@/config/roles";

export { SELF_ASSIGNABLE_ROLES };

const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^09\d{9}$/, "Invalid Iranian mobile number"));

/**
 * ساخت پروفایل «مشتری» برای کاربر (idempotent).
 * از hook ایجاد کاربر در Better Auth و به‌عنوان پشتیبان هنگام خواندن نشست فراخوانی می‌شود،
 * تا حتی در صورت شکست hook، هیچ کاربری بدون پروفایل نماند. نقش هرگز از ورودی خوانده نمی‌شود.
 */
export async function ensureProfile(db: DbOrTx, input: { userId: string; fullName: string | null }) {
  const fullName = input.fullName?.trim().slice(0, 80) || null;
  await db.insert(profiles).values({ userId: input.userId, fullName, role: "customer" }).onConflictDoNothing();
}

/**
 * اعمال انتخاب‌های فرم ثبت‌نام (سمت سرور، بلافاصله پس از ساخت کاربر):
 * - نقش فقط از بین نقش‌های مجاز و فقط اگر قبلاً انتخاب نشده باشد
 * - شماره موبایل اگر تکراری نباشد
 */
export async function applyRegistrationChoices(
  db: DbOrTx,
  userId: string,
  choices: { role: SelfAssignableRole; phone?: string | null },
) {
  const role = parseInput(z.enum(SELF_ASSIGNABLE_ROLES), choices.role);
  await db
    .update(profiles)
    .set({ role, roleSelectedAt: new Date() })
    .where(and(eq(profiles.userId, userId), isNull(profiles.roleSelectedAt), eq(profiles.role, "customer")));
  if (choices.phone) {
    try {
      await db.update(profiles).set({ phone: choices.phone }).where(and(eq(profiles.userId, userId), isNull(profiles.phone)));
    } catch (err) {
      if (findPgError(err)?.code !== PG.UNIQUE_VIOLATION) throw err; // شماره تکراری: بعداً در پروفایل قابل ثبت است
    }
  }
}

/** آیا شماره موبایل قبلاً ثبت شده است؟ */
export async function isPhoneTaken(db: DbOrTx, phone: string) {
  const rows = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.phone, phone)).limit(1);
  return rows.length > 0;
}

const selectRoleSchema = z.object({ role: z.enum(SELF_ASSIGNABLE_ROLES) });

/**
 * انتخاب نقش اولیه پس از ثبت‌نام — فقط یک‌بار و فقط از بین نقش‌های مجاز.
 * پس از آن تغییر نقش فقط توسط ادمین ممکن است.
 */
export async function selectInitialRole(db: DbOrTx, actor: Actor, input: unknown) {
  const { role } = parseInput(selectRoleSchema, input);
  const updated = await db
    .update(profiles)
    .set({ role, roleSelectedAt: new Date() })
    .where(and(eq(profiles.userId, actor.userId), isNull(profiles.roleSelectedAt), eq(profiles.role, "customer")))
    .returning({ role: profiles.role });
  if (updated.length === 0) throw new ForbiddenError("Initial role has already been selected");
  return updated[0]!;
}

const adminSetRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["customer", "stylist", "salon_owner", "admin"]),
});

/** تغییر نقش هر کاربر — فقط ادمین. ادمین نمی‌تواند نقش خودش را تغییر دهد. */
export async function adminSetUserRole(db: DbOrTx, actor: Actor, input: unknown): Promise<{ role: UserRole }> {
  if (!isAdmin(actor)) throw new ForbiddenError();
  const { userId, role } = parseInput(adminSetRoleSchema, input);
  if (userId === actor.userId) throw new ForbiddenError("Admins cannot change their own role");
  // مدیر کل اصلی (۰۹۹۹۱۷۹۷۹۸۲) در هیچ حالتی قابل تغییر نقش نیست
  const [target] = await db.select({ phone: users.phoneNumber }).from(users).where(eq(users.id, userId)).limit(1);
  if (target?.phone === SUPER_ADMIN_PHONE) throw new SuperAdminProtectedError();
  const updated = await db
    .update(profiles)
    .set({ role, roleSelectedAt: new Date() })
    .where(eq(profiles.userId, userId))
    .returning({ role: profiles.role });
  if (updated.length === 0) throw new NotFoundError("Profile");
  return updated[0]!;
}

const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(80).optional(),
    phone: phoneSchema.nullable().optional(),
    city: z.string().trim().max(60).nullable().optional(),
  })
  .strict(); // هر فیلد اضافه (مثل role) رد می‌شود

/** ویرایش پروفایل خود کاربر. نقش، مالکیت و … از این مسیر قابل تغییر نیست. */
export async function updateOwnProfile(db: DbOrTx, actor: Actor, input: unknown) {
  const data = parseInput(updateProfileSchema, input);
  try {
    const [row] = await db.update(profiles).set(data).where(eq(profiles.userId, actor.userId)).returning();
    if (!row) throw new NotFoundError("Profile");
    return row;
  } catch (err) {
    if (findPgError(err)?.code === PG.UNIQUE_VIOLATION) throw new ConflictError("PHONE_TAKEN", "Phone number is already in use");
    throw err;
  }
}

/** تنظیم تصویر پروفایل خود کاربر (فایل باید متعلق به خودش و از نوع avatar باشد) */
export async function setOwnAvatar(db: DbOrTx, actor: Actor, fileId: string | null) {
  if (fileId) {
    const [file] = await db.select().from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).limit(1);
    if (!file || file.ownerId !== actor.userId || file.purpose !== "avatar") throw new ForbiddenError();
  }
  await db.update(profiles).set({ avatarFileId: fileId }).where(eq(profiles.userId, actor.userId));
}
