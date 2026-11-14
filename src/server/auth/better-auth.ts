import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { OTP_LENGTH, resolveOtpConfig, type OtpConfig } from "@/server/otp/config";
import { getRegistrationIntent } from "@/server/otp/intent";
import { isCanonicalPhone, toLocalPhone } from "@/server/otp/phone";
import { createOtpSender, type OtpSender } from "@/server/otp/sender";
import { ensureProfile } from "@/server/profiles/service";

export { AUTH_COOKIE_PREFIX } from "./constants";
import { AUTH_COOKIE_PREFIX } from "./constants";

/** مدت اعتبار */
export const AUTH_TTL = {
  session: 60 * 60 * 24 * 14, // ۱۴ روز
  sessionUpdateAge: 60 * 60 * 24, // تمدید روزانه
  otp: 5 * 60, // ۵ دقیقه
} as const;

/** هر کد فقط ۳ بار قابل امتحان است؛ پس از آن کد جدید لازم است */
export const OTP_ALLOWED_ATTEMPTS = 3;

/** آدرس جایگزین برای ستون email (اجباری در مدل Better Auth)؛ دامنه رزروشده .invalid هرگز قابل تحویل نیست */
export const PLACEHOLDER_EMAIL_DOMAIN = "phone.arayeshgahman.invalid";

const OTP_PATHS = new Set(["/phone-number/send-otp", "/phone-number/verify"]);

export interface CreateAuthOptions {
  /** پیش‌فرض: از env (resolveOtpConfig) */
  otp?: OtpConfig;
  /** پیش‌فرض: بر اساس otp.mode (createOtpSender) */
  otpSender?: OtpSender;
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

/** IP کلاینت برای allowlist حالت آزمایشی: فقط X-Real-IP که پروکسی معکوس بازنویسی می‌کند */
export function allowlistIp(headers: Headers | undefined): string | null {
  return headers?.get("x-real-ip")?.trim() || null;
}

type EndpointCtx = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * حالت static: Better Auth کد تصادفی را ذخیره می‌کند؛ همان رکورد (همان شماره، همان انقضا،
 * شمارنده تلاش صفر) با کد ثابت جایگزین می‌شود تا همه حفاظت‌های داخلی Better Auth
 * (انقضا، حداکثر تلاش، یک‌بارمصرف بودن، وابستگی به شماره) حفظ شوند.
 * اگر ساختار داخلی Better Auth تغییر کند، به‌جای پذیرش ناامن خطا می‌دهد (fail closed).
 */
async function applyStaticCode(ctx: EndpointCtx | undefined, phone: string, generated: string, staticCode: string) {
  if (!ctx) throw new Error("Static OTP requires an endpoint context");
  const identifier = `phone-number-otp-${phone}`;
  const stored = await ctx.context.internalAdapter.findVerificationValue(identifier);
  if (!stored || stored.value !== `${generated}:0`) {
    throw new Error("Static OTP: unexpected verification record (Better Auth internals changed)");
  }
  await ctx.context.internalAdapter.updateVerificationByIdentifier(identifier, { value: `${staticCode}:0` });
}

/**
 * پیکربندی Better Auth — احراز هویت فقط با شماره موبایل و OTP.
 * - ورود/ثبت‌نام ایمیلی و رمز عبور غیرفعال است.
 * - نقش در جدول profiles است و هیچ endpoint عمومی Better Auth به آن دسترسی ندارد.
 * - ساخت کاربر فقط داخل فرایند ثبت‌نام سمت سرور (RegistrationIntent) مجاز است.
 */
/** حالت تست هر نمونه auth (برای سرویس ورود/ثبت‌نام) */
const authTestModes = new WeakMap<object, { adminPhone: string }>();

/** اگر این نمونه در حالت تست موقت ساخته شده باشد، تنظیمات آن را برمی‌گرداند */
export function getAuthTestMode(auth: object): { adminPhone: string } | undefined {
  return authTestModes.get(auth);
}

export function createAuth(database: Database, options: CreateAuthOptions = {}) {
  const otp = options.otp ?? resolveOtpConfig();
  const instance = buildAuth(database, { ...options, otp });
  if (otp.mode === "static" && otp.testMode) authTestModes.set(instance, otp.testMode);
  return instance;
}

function buildAuth(database: Database, options: CreateAuthOptions) {
  const otp = options.otp ?? resolveOtpConfig();
  const sender = options.otpSender ?? createOtpSender(otp);
  /** حالت تست موقت (AUTH_TEST_MODE=true): هر شماره وارد می‌شود؛ احراز هویت واقعی نیست */
  const testMode = otp.mode === "static" ? otp.testMode : undefined;
  if (testMode && process.env.NEXT_PHASE !== "phase-production-build") {
    console.warn(
      "[auth] ⚠ AUTH_TEST_MODE=true — TEST AUTHENTICATION ONLY: any mobile number signs in with a fixed code and " +
        "one configured number is always admin. Never use this for real users.",
    );
  }

  return betterAuth({
    appName: "ArayeshgahMan",
    secret: resolveSecret(options.secret ?? process.env.BETTER_AUTH_SECRET),
    baseURL: options.baseURL ?? process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, { provider: "pg", schema, usePlural: true }),

    emailAndPassword: { enabled: false },

    session: {
      expiresIn: AUTH_TTL.session,
      updateAge: AUTH_TTL.sessionUpdateAge,
    },

    rateLimit: {
      enabled: options.rateLimitEnabled,
      window: 60,
      max: 100,
      customRules: {
        "/phone-number/send-otp": { window: 60, max: 3 },
        "/phone-number/verify": { window: 60, max: 10 },
      },
    },

    // سطح حمله حداقلی: مسیرهای ایمیل/رمز عبور و تغییر اطلاعات کاربر غیرفعال‌اند
    disabledPaths: [
      "/update-user",
      "/change-email",
      "/delete-user",
      "/change-password",
      "/set-password",
      "/sign-in/phone-number",
      "/phone-number/request-password-reset",
      "/phone-number/reset-password",
      "/send-verification-email",
      "/verify-email",
      "/request-password-reset",
      "/reset-password",
      "/reset-password/:token",
    ],

    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      database: { generateId: "uuid" },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!OTP_PATHS.has(ctx.path)) return;

        // حالت آزمایشی در production: فقط از IPهای مجاز
        if (otp.mode === "static" && otp.allowedIps) {
          const ip = allowlistIp(ctx.headers);
          if (!ip || !otp.allowedIps.includes(ip)) {
            throw new APIError("FORBIDDEN", { code: "OTP_NOT_AVAILABLE", message: "OTP login is not available" });
          }
        }

        if (ctx.path === "/phone-number/verify") {
          const body = (ctx.body ?? {}) as { phoneNumber?: unknown; updatePhoneNumber?: unknown };
          if (body.updatePhoneNumber) {
            throw new APIError("FORBIDDEN", { code: "PHONE_CHANGE_DISABLED", message: "Changing the phone number is not supported" });
          }
          // ورود فقط برای حساب موجود؛ ساخت حساب فقط در فرایند ثبت‌نام برنامه
          // (در حالت تست، شماره ناشناخته هنگام ورود خودکار با نقش customer ثبت‌نام می‌شود)
          if (!testMode && typeof body.phoneNumber === "string" && !getRegistrationIntent(body.phoneNumber)) {
            const [existing] = await database
              .select({ id: schema.users.id })
              .from(schema.users)
              .where(eq(schema.users.phoneNumber, body.phoneNumber))
              .limit(1);
            if (!existing) throw new APIError("NOT_FOUND", { code: "ACCOUNT_NOT_FOUND", message: "No account for this phone number" });
          }
        }
      }),
    },

    databaseHooks: {
      user: {
        create: {
          // لایه دوم دفاع: بدون نیت ثبت‌نام هیچ کاربری ساخته نمی‌شود
          before: async (user) => {
            const phone = (user as { phoneNumber?: string | null }).phoneNumber;
            if (!phone) return false;
            if (!testMode && !getRegistrationIntent(phone)) return false;
          },
          // هر کاربر جدید یک پروفایل «مشتری» می‌گیرد؛ نقش هرگز از ورودی کاربر خوانده نمی‌شود
          after: async (user) => {
            await ensureProfile(database, { userId: user.id, fullName: user.name });
          },
        },
      },
    },

    plugins: [
      phoneNumber({
        otpLength: OTP_LENGTH,
        expiresIn: AUTH_TTL.otp,
        allowedAttempts: OTP_ALLOWED_ATTEMPTS,
        // فقط شکل استاندارد ‎+989XXXXXXXXX‎؛ جلوگیری از ثبت تکراری با قالب متفاوت
        phoneNumberValidator: (value) => isCanonicalPhone(value),
        sendOTP: async ({ phoneNumber: phone, code }, ctx) => {
          if (otp.mode === "static") await applyStaticCode(ctx as EndpointCtx | undefined, phone, code, otp.code);
          else await sender.send({ phoneNumber: phone, code });
        },
        // حالت تست: شماره ادمین تستی پس از هر تأیید موفق نقش admin می‌گیرد (در حالت عادی هیچ اثری ندارد)
        callbackOnVerification: async ({ phoneNumber: phone, user }) => {
          if (!testMode || phone !== testMode.adminPhone) return;
          await ensureProfile(database, { userId: user.id, fullName: user.name });
          await database.update(schema.profiles).set({ role: "admin", roleSelectedAt: new Date() }).where(eq(schema.profiles.userId, user.id));
        },
        signUpOnVerification: {
          getTempEmail: () => `${randomUUID()}@${PLACEHOLDER_EMAIL_DOMAIN}`,
          getTempName: (phone) => getRegistrationIntent(phone)?.fullName ?? toLocalPhone(phone),
        },
      }),
      // باید آخرین plugin باشد تا Server Actions بتوانند کوکی ست کنند
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof buildAuth>;
