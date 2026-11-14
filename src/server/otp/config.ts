/**
 * تنظیمات OTP:
 *   AUTH_OTP_MODE=static  → کد ثابت AUTH_STATIC_OTP (فقط توسعه/تست؛ هیچ پیامکی ارسال نمی‌شود)
 *   AUTH_OTP_MODE=sms     → کد تصادفی Better Auth از طریق Provider پیامک (هنوز پیاده‌سازی نشده)
 *
 * در production حالت static ممنوع است، مگر با فعال‌سازی صریح
 * AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION=1 و فهرست IPهای مجاز AUTH_STATIC_OTP_ALLOWED_IPS.
 * پیام خطاها هرگز مقدار کد را شامل نمی‌شوند.
 */
export const OTP_LENGTH = 4;

export class OtpConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OtpConfigError";
  }
}

export type OtpConfig =
  | {
      mode: "static";
      code: string;
      /** فقط وقتی static در production صریحاً فعال شده باشد: درخواست‌ها فقط از این IPها پذیرفته می‌شوند */
      allowedIps: readonly string[] | null;
      /**
       * حالت تست موقت (AUTH_TEST_MODE=true) — احراز هویت واقعی نیست:
       * هر شماره با کد ثابت وارد/ثبت‌نام می‌شود و testAdminPhone همیشه admin است.
       */
      testMode?: { adminPhone: string };
    }
  | { mode: "sms"; provider: string };

/** کد ثابت حالت تست */
export const TEST_MODE_OTP = "1111";
/** شماره‌ای که در حالت تست همیشه نقش admin دارد */
export const TEST_MODE_ADMIN_PHONE = "+989991797982";

/** آیا حالت تست موقت صریحاً فعال است؟ فقط مقدار دقیق true/false پذیرفته می‌شود. */
export function isAuthTestMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.AUTH_TEST_MODE?.trim().toLowerCase();
  if (raw === undefined || raw === "" || raw === "false") return false;
  if (raw === "true") return true;
  throw new OtpConfigError("AUTH_TEST_MODE must be exactly true or false");
}

export const SMS_PROVIDERS = [] as const satisfies readonly string[];

export function resolveOtpConfig(env: NodeJS.ProcessEnv = process.env): OtpConfig {
  // حالت تست موقت: کد ثابت ۱۱۱۱ برای همه شماره‌ها، بدون محدودیت IP (فقط توسعه/تست، نه احراز هویت واقعی)
  if (isAuthTestMode(env)) {
    return { mode: "static", code: TEST_MODE_OTP, allowedIps: null, testMode: { adminPhone: TEST_MODE_ADMIN_PHONE } };
  }

  const isProduction = env.NODE_ENV === "production";
  const mode = env.AUTH_OTP_MODE?.trim().toLowerCase() || (isProduction ? "" : "static");

  if (mode === "static") {
    const code = env.AUTH_STATIC_OTP?.trim() || (isProduction ? "" : "1111");
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
      throw new OtpConfigError(`AUTH_STATIC_OTP must be exactly ${OTP_LENGTH} digits`);
    }
    if (!isProduction) return { mode, code, allowedIps: null };

    if (env.AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION !== "1") {
      throw new OtpConfigError("AUTH_OTP_MODE=static is not allowed in production (see docs/auth.md for controlled test mode)");
    }
    const allowedIps = (env.AUTH_STATIC_OTP_ALLOWED_IPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowedIps.length === 0) {
      throw new OtpConfigError("AUTH_STATIC_OTP_ALLOWED_IPS is required when static OTP is enabled in production");
    }
    return { mode, code, allowedIps };
  }

  if (mode === "sms") {
    const provider = env.SMS_PROVIDER?.trim().toLowerCase();
    if (!provider) throw new OtpConfigError("SMS_PROVIDER is required for AUTH_OTP_MODE=sms");
    if (!(SMS_PROVIDERS as readonly string[]).includes(provider)) {
      throw new OtpConfigError("No SMS provider is implemented yet; see src/server/otp/sender.ts");
    }
    return { mode, provider };
  }

  if (!mode) throw new OtpConfigError("AUTH_OTP_MODE is not set");
  throw new OtpConfigError("Unsupported AUTH_OTP_MODE (allowed: static, sms)");
}
