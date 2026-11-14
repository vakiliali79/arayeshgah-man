import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "@/db/client";
import { createDb } from "@/db/client";
import * as schema from "@/db/schema";
import { createProfileForNewUser } from "@/server/profiles/service";

/**
 * پیکربندی Better Auth.
 * - جداول احراز هویت (users, sessions, accounts, verifications) فقط توسط Better Auth مدیریت می‌شوند.
 * - نقش و اطلاعات پروفایل در جدول جداگانه profiles نگه‌داری می‌شود؛ بنابراین
 *   API عمومی Better Auth (مثل updateUser) هیچ راهی برای تغییر نقش ندارد.
 * - اتصال به مسیر /api/auth و فرم‌ها در فاز بعد انجام می‌شود.
 */
export function createAuth(database: Database) {
  return betterAuth({
    appName: "ArayeshgahMan",
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 72,
      requireEmailVerification: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14, // ۱۴ روز
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      database: { generateId: "uuid" },
    },
    databaseHooks: {
      user: {
        create: {
          // هر کاربر جدید یک پروفایل «مشتری» می‌گیرد؛ نقش هرگز از ورودی کاربر خوانده نمی‌شود.
          after: async (user) => {
            await createProfileForNewUser(database, { userId: user.id, fullName: user.name });
          },
        },
      },
    },
  });
}

/** نمونه‌ای که CLI رسمی Better Auth برای تولید schema می‌خواند. */
export const auth = createAuth(createDb(process.env.DATABASE_URL ?? "postgres://localhost/placeholder"));
