import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { Mailer } from "@/server/mail/mailer";
import { passwordResetEmail, verificationEmail } from "@/server/mail/templates";
import { ensureProfile } from "@/server/profiles/service";

export { AUTH_COOKIE_PREFIX } from "./constants";
import { AUTH_COOKIE_PREFIX } from "./constants";

/** مدت اعتبار */
export const AUTH_TTL = {
  session: 60 * 60 * 24 * 14, // ۱۴ روز
  sessionUpdateAge: 60 * 60 * 24, // تمدید روزانه
  emailVerification: 60 * 60 * 24, // ۲۴ ساعت
  passwordReset: 60 * 60, // ۱ ساعت
} as const;

export interface CreateAuthOptions {
  mailer: Mailer;
  secret?: string;
  baseURL?: string;
  /** پیش‌فرض: فقط در production فعال (رفتار Better Auth) */
  rateLimitEnabled?: boolean;
}

/** در production راز ضعیف یا ناموجود پذیرفته نمی‌شود (به جز هنگام build) */
function resolveSecret(secret: string | undefined): string | undefined {
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV === "production" && !isBuild && (!secret || secret.length < 32)) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters in production");
  }
  return secret;
}

/**
 * پیکربندی Better Auth.
 * - جداول users/sessions/accounts/verifications فقط توسط Better Auth مدیریت می‌شوند.
 * - نقش در جدول profiles است و هیچ endpoint عمومی Better Auth به آن دسترسی ندارد.
 * - ورودی‌های ثبت‌نام (مثل role) که در اسکیمای Better Auth نیستند نادیده گرفته می‌شوند.
 */
export function createAuth(database: Database, options: CreateAuthOptions) {
  const { mailer } = options;
  return betterAuth({
    appName: "ArayeshgahMan",
    secret: resolveSecret(options.secret ?? process.env.BETTER_AUTH_SECRET),
    baseURL: options.baseURL ?? process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, { provider: "pg", schema, usePlural: true }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 72,
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: AUTH_TTL.passwordReset,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await mailer.send(passwordResetEmail(user.email, user.name, url));
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true, // ورود با ایمیل تأییدنشده یک لینک تازه ارسال می‌کند
      autoSignInAfterVerification: true,
      expiresIn: AUTH_TTL.emailVerification,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.send(verificationEmail(user.email, user.name, url));
      },
    },

    session: {
      expiresIn: AUTH_TTL.session,
      updateAge: AUTH_TTL.sessionUpdateAge,
    },

    rateLimit: {
      enabled: options.rateLimitEnabled,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 300, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/reset-password": { window: 300, max: 5 },
        "/send-verification-email": { window: 300, max: 3 },
      },
    },

    // سطح حمله را کوچک نگه می‌داریم: تغییر کاربر/ایمیل/حذف حساب از طریق API عمومی غیرفعال است
    disabledPaths: ["/update-user", "/change-email", "/delete-user"],

    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      database: { generateId: "uuid" },
    },

    databaseHooks: {
      user: {
        create: {
          // هر کاربر جدید یک پروفایل «مشتری» می‌گیرد؛ نقش هرگز از ورودی کاربر خوانده نمی‌شود.
          after: async (user) => {
            await ensureProfile(database, { userId: user.id, fullName: user.name });
          },
        },
      },
    },

    // باید آخرین plugin باشد تا Server Actions بتوانند کوکی ست کنند
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
