import { isAPIError } from "better-auth/api";
import { eq, or } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { profiles, users } from "@/db/schema";
import type { SelfAssignableRole } from "@/config/roles";
import { withRegistrationIntent } from "../otp/intent";
import { toLocalPhone } from "../otp/phone";
import { applyRegistrationChoices } from "../profiles/service";
import type { Auth } from "./better-auth";

/**
 * فرایند ورود/ثبت‌نام با موبایل و OTP (منطق سمت سرور؛ Server Actionها فقط پوسته هستند).
 * شماره‌ها باید قبلاً با normalizeIranMobile به شکل ‎+989XXXXXXXXX‎ درآمده باشند.
 */
export type OtpPurpose = "login" | "register";

export type OtpFailure =
  | "not_registered"
  | "already_registered"
  | "invalid_phone"
  | "invalid_code"
  | "expired"
  | "too_many_attempts"
  | "rate_limited"
  | "unavailable"
  | "unknown";

export type OtpResult<T = object> = ({ ok: true } & T) | { ok: false; reason: OtpFailure };

/** آیا این شماره قبلاً حساب دارد؟ (هویت ورود یا شماره پروفایل) */
export async function findAccountByPhone(db: DbOrTx, phone: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(or(eq(users.phoneNumber, phone), eq(profiles.phone, toLocalPhone(phone))))
    .limit(1);
  return row ?? null;
}

function mapError(err: unknown): OtpFailure {
  if (!isAPIError(err)) {
    console.error("[auth] OTP flow failed", err instanceof Error ? err.name : "error");
    return "unknown";
  }
  const code = (err.body as { code?: string } | undefined)?.code;
  switch (code) {
    case "INVALID_OTP":
      return "invalid_code";
    case "OTP_EXPIRED":
    case "OTP_NOT_FOUND":
      return "expired";
    case "TOO_MANY_ATTEMPTS":
      return "too_many_attempts";
    case "INVALID_PHONE_NUMBER":
      return "invalid_phone";
    case "ACCOUNT_NOT_FOUND":
      return "not_registered";
    case "OTP_NOT_AVAILABLE":
      return "unavailable";
  }
  if (err.status === "TOO_MANY_REQUESTS") return "rate_limited";
  if (err.statusCode === 409 || code === "PHONE_NUMBER_EXIST") return "already_registered";
  return "unknown";
}

/** مرحله ۱: درخواست کد (ورود: حساب باید وجود داشته باشد؛ ثبت‌نام: نباید وجود داشته باشد) */
export async function requestOtp(auth: Auth, db: DbOrTx, input: { phone: string; purpose: OtpPurpose }, headers: Headers): Promise<OtpResult> {
  const account = await findAccountByPhone(db, input.phone);
  if (input.purpose === "login" && !account) return { ok: false, reason: "not_registered" };
  if (input.purpose === "register" && account) return { ok: false, reason: "already_registered" };
  try {
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: input.phone }, headers });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: mapError(err) };
  }
}

/** مرحله ۲ ورود: بررسی کد و ساخت نشست (کوکی با nextCookies یا headers برگشتی) */
export async function verifyLoginOtp(
  auth: Auth,
  db: DbOrTx,
  input: { phone: string; code: string },
  headers: Headers,
): Promise<OtpResult<{ userId: string; setCookie: string[] }>> {
  if (!(await findAccountByPhone(db, input.phone))) return { ok: false, reason: "not_registered" };
  try {
    const res = await auth.api.verifyPhoneNumber({ body: { phoneNumber: input.phone, code: input.code }, headers, returnHeaders: true });
    return { ok: true, userId: res.response.user.id, setCookie: res.headers.getSetCookie() };
  } catch (err) {
    return { ok: false, reason: mapError(err) };
  }
}

/**
 * مرحله ۲ ثبت‌نام: بررسی کد، ساخت حساب (فقط داخل RegistrationIntent)، اعمال نقش انتخابی
 * (customer / stylist / salon_owner — هرگز admin) و ورود خودکار.
 */
export async function verifyRegistrationOtp(
  auth: Auth,
  db: DbOrTx,
  input: { phone: string; code: string; fullName: string; role: SelfAssignableRole },
  headers: Headers,
): Promise<OtpResult<{ userId: string; setCookie: string[] }>> {
  if (await findAccountByPhone(db, input.phone)) return { ok: false, reason: "already_registered" };
  try {
    const res = await withRegistrationIntent({ phoneNumber: input.phone, fullName: input.fullName, role: input.role }, () =>
      auth.api.verifyPhoneNumber({ body: { phoneNumber: input.phone, code: input.code }, headers, returnHeaders: true }),
    );
    const userId = res.response.user.id;
    await applyRegistrationChoices(db, userId, { role: input.role, phone: toLocalPhone(input.phone) });
    return { ok: true, userId, setCookie: res.headers.getSetCookie() };
  } catch (err) {
    // ثبت‌نام هم‌زمان با همین شماره: محدودیت unique دیتابیس
    if (!isAPIError(err) && /unique|duplicate/i.test(String((err as Error)?.message))) return { ok: false, reason: "already_registered" };
    return { ok: false, reason: mapError(err) };
  }
}
