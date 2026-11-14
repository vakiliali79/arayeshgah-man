"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { requestOtp, verifyLoginOtp, verifyRegistrationOtp, type OtpFailure } from "@/server/auth/phone-auth";
import { toLocalPhone } from "@/server/otp/phone";
import { clientIp, consumeOtpLimits } from "@/server/security/rate-limit";
import { safeRedirectPath } from "./redirect";
import {
  flattenErrors,
  loginCodeSchema,
  loginPhoneSchema,
  registerCodeSchema,
  registerPhoneSchema,
  type OtpFormState,
} from "./schemas";

const MESSAGES: Record<OtpFailure, string> = {
  not_registered: "حسابی با این شماره موبایل وجود ندارد. ابتدا ثبت‌نام کنید.",
  already_registered: "این شماره موبایل قبلاً ثبت شده است. از صفحه ورود وارد شوید.",
  invalid_phone: "شماره موبایل معتبر نیست.",
  invalid_code: "کد تأیید اشتباه است. دوباره تلاش کنید.",
  expired: "کد تأیید منقضی شده یا معتبر نیست. کد جدید دریافت کنید.",
  too_many_attempts: "تعداد تلاش‌های ناموفق زیاد بود. کد جدید دریافت کنید.",
  rate_limited: "تعداد درخواست‌ها زیاد است. لطفاً چند دقیقه دیگر دوباره تلاش کنید.",
  unavailable: "ورود با کد تأیید در حال حاضر در دسترس نیست.",
  unknown: "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
};

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// ------------------------------------------------------------------ ورود

/** ورود — مرحله ۱: دریافت شماره و ارسال کد */
export async function requestLoginOtpAction(_prev: OtpFormState, fd: FormData): Promise<OtpFormState> {
  const values = { phone: str(fd, "phone") };
  const parsed = loginPhoneSchema.safeParse(values);
  if (!parsed.success) return { step: "phone", status: "error", fieldErrors: flattenErrors(parsed.error), values };
  const phone = parsed.data.phone;

  const h = await headers();
  if (!consumeOtpLimits("request", clientIp(h), phone)) {
    return { step: "phone", status: "error", message: MESSAGES.rate_limited, values };
  }
  const res = await requestOtp(auth, db, { phone, purpose: "login" }, h);
  if (!res.ok) return { step: "phone", status: "error", message: MESSAGES[res.reason], values };
  return { step: "code", status: "idle", values: { phone: toLocalPhone(phone) }, sentAt: Date.now() };
}

/** ورود — مرحله ۲: بررسی کد و ساخت نشست */
export async function verifyLoginOtpAction(_prev: OtpFormState, fd: FormData): Promise<OtpFormState> {
  const values = { phone: str(fd, "phone") };
  const parsed = loginCodeSchema.safeParse({ phone: values.phone, code: str(fd, "code") });
  if (!parsed.success) return { step: "code", status: "error", fieldErrors: flattenErrors(parsed.error), values };
  const { phone, code } = parsed.data;

  const h = await headers();
  if (!consumeOtpLimits("verify", clientIp(h), phone)) {
    return { step: "code", status: "error", message: MESSAGES.rate_limited, values };
  }
  // nextCookies plugin کوکی نشست (httpOnly) را روی پاسخ Server Action ست می‌کند
  const res = await verifyLoginOtp(auth, db, { phone, code }, h);
  if (!res.ok) return { step: res.reason === "not_registered" ? "phone" : "code", status: "error", message: MESSAGES[res.reason], values };

  const next = safeRedirectPath(fd.get("next"), "");
  redirect(next || `${ROUTES.dashboard}?welcome=login`);
}

// ------------------------------------------------------------------ ثبت‌نام

/** ثبت‌نام — مرحله ۱: نام، نوع حساب و شماره؛ ارسال کد */
export async function requestRegisterOtpAction(_prev: OtpFormState, fd: FormData): Promise<OtpFormState> {
  const values = { phone: str(fd, "phone"), fullName: str(fd, "fullName"), role: str(fd, "role") };
  const parsed = registerPhoneSchema.safeParse({ ...values, terms: fd.get("terms") ?? undefined });
  if (!parsed.success) return { step: "phone", status: "error", fieldErrors: flattenErrors(parsed.error), values };
  const phone = parsed.data.phone;

  const h = await headers();
  if (!consumeOtpLimits("request", clientIp(h), phone)) {
    return { step: "phone", status: "error", message: MESSAGES.rate_limited, values };
  }
  const res = await requestOtp(auth, db, { phone, purpose: "register" }, h);
  if (!res.ok) {
    if (res.reason === "already_registered") {
      return { step: "phone", status: "error", fieldErrors: { phone: MESSAGES.already_registered }, values };
    }
    return { step: "phone", status: "error", message: MESSAGES[res.reason], values };
  }
  return {
    step: "code",
    status: "idle",
    values: { phone: toLocalPhone(phone), fullName: parsed.data.fullName, role: parsed.data.role },
    sentAt: Date.now(),
  };
}

/** ثبت‌نام — مرحله ۲: بررسی کد، ساخت حساب و ورود */
export async function verifyRegisterOtpAction(_prev: OtpFormState, fd: FormData): Promise<OtpFormState> {
  const values = { phone: str(fd, "phone"), fullName: str(fd, "fullName"), role: str(fd, "role") };
  // همه مقادیر مرحله قبل دوباره سمت سرور اعتبارسنجی می‌شوند (نقش admin رد می‌شود)
  const parsed = registerCodeSchema.safeParse({ ...values, code: str(fd, "code") });
  if (!parsed.success) {
    const fieldErrors = flattenErrors(parsed.error);
    const onlyCode = Object.keys(fieldErrors ?? {}).every((k) => k === "code");
    return { step: onlyCode ? "code" : "phone", status: "error", fieldErrors, values };
  }
  const { phone, code, fullName, role } = parsed.data;

  const h = await headers();
  if (!consumeOtpLimits("verify", clientIp(h), phone)) {
    return { step: "code", status: "error", message: MESSAGES.rate_limited, values };
  }
  const res = await verifyRegistrationOtp(auth, db, { phone, code, fullName, role }, h);
  if (!res.ok) {
    return { step: res.reason === "already_registered" ? "phone" : "code", status: "error", message: MESSAGES[res.reason], values };
  }
  redirect(`${ROUTES.dashboard}?welcome=registered`);
}

// ------------------------------------------------------------------ خروج

export async function signOutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // نشست از قبل نامعتبر است
  }
  redirect(ROUTES.login);
}
