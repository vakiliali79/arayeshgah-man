"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { registerUser, VERIFY_EMAIL_CALLBACK } from "@/server/auth/registration";
import { authRateLimits, clientIp, consumeAll } from "@/server/security/rate-limit";
import { safeRedirectPath } from "./redirect";
import {
  flattenErrors,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type AuthFormState,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "./schemas";

const TOO_MANY = "تعداد تلاش‌ها زیاد است. لطفاً چند دقیقه دیگر دوباره امتحان کنید.";
const GENERIC = "خطایی رخ داد. لطفاً دوباره تلاش کنید.";

function errorCode(err: unknown): string | undefined {
  return isAPIError(err) ? (err.body as { code?: string } | undefined)?.code : undefined;
}

// ------------------------------------------------------------------ ورود

export async function signInAction(
  _prev: AuthFormState<LoginInput>,
  formData: FormData,
): Promise<AuthFormState<LoginInput>> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const values = { email: raw.email };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };

  const h = await headers();
  if (!consumeAll(authRateLimits.signIn, [`ip:${clientIp(h)}`, `email:${parsed.data.email}`])) {
    return { status: "error", message: TOO_MANY, values };
  }

  try {
    // nextCookies plugin کوکی نشست (httpOnly) را روی پاسخ Server Action ست می‌کند
    await auth.api.signInEmail({
      // اگر ایمیل تأیید نشده باشد، Better Auth لینک تازه‌ای با همین مقصد ارسال می‌کند
      body: { email: parsed.data.email, password: parsed.data.password, callbackURL: VERIFY_EMAIL_CALLBACK },
      headers: h,
    });
  } catch (err) {
    const code = errorCode(err);
    if (code === "EMAIL_NOT_VERIFIED") {
      return {
        status: "error",
        message: "ایمیل شما هنوز تأیید نشده است. لینک تأیید جدیدی به ایمیلتان ارسال شد.",
        values,
      };
    }
    if (isAPIError(err) && err.status === "TOO_MANY_REQUESTS") return { status: "error", message: TOO_MANY, values };
    if (!isAPIError(err)) console.error("[auth] sign-in failed", err);
    // پیام یکسان برای ایمیل ناموجود و رمز اشتباه
    return { status: "error", message: "ایمیل یا رمز عبور نادرست است.", values };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

// ------------------------------------------------------------------ ثبت‌نام

export async function signUpAction(
  _prev: AuthFormState<RegisterInput>,
  formData: FormData,
): Promise<AuthFormState<RegisterInput>> {
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
    terms: formData.get("terms") ?? undefined,
  };
  // رمز عبور هرگز به کلاینت بازگردانده نمی‌شود
  const values = { fullName: raw.fullName, email: raw.email, phone: raw.phone, role: raw.role };

  // registerSchema نقش admin را رد می‌کند (فقط customer / stylist / salon_owner)
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };

  const h = await headers();
  if (!consumeAll(authRateLimits.signUp, [`ip:${clientIp(h)}`])) return { status: "error", message: TOO_MANY, values };

  const result = await registerUser(auth, db, parsed.data, h);
  if (!result.ok) {
    if (result.reason === "phone_taken") {
      return { status: "error", fieldErrors: { phone: "این شماره موبایل قبلاً ثبت شده است" }, values };
    }
    if (result.reason === "weak_password") {
      return { status: "error", fieldErrors: { password: "رمز عبور انتخابی مجاز نیست" }, values };
    }
    return { status: "error", message: "ثبت‌نام انجام نشد. لطفاً دوباره تلاش کنید.", values };
  }

  // برای ایمیل تکراری هم همین پیام نمایش داده می‌شود (عدم افشای وجود حساب)
  return {
    status: "success",
    message: "اگر این ایمیل قبلاً ثبت نشده باشد، حساب شما ساخته شد و لینک تأیید به آن ارسال شد. پس از تأیید وارد شوید.",
  };
}

// ------------------------------------------------------------------ خروج

export async function signOutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (err) {
    if (!isAPIError(err)) console.error("[auth] sign-out failed", err);
  }
  redirect(ROUTES.login);
}

// ------------------------------------------------------------------ فراموشی رمز

const RESET_SENT =
  "اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی رمز عبور به آن ارسال شد. لینک تا ۱ ساعت معتبر است.";

export async function requestPasswordResetAction(
  _prev: AuthFormState<ForgotPasswordInput>,
  formData: FormData,
): Promise<AuthFormState<ForgotPasswordInput>> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values: raw };

  const h = await headers();
  if (!consumeAll(authRateLimits.passwordReset, [`ip:${clientIp(h)}`, `email:${parsed.data.email}`])) {
    return { status: "error", message: TOO_MANY, values: raw };
  }

  try {
    await auth.api.requestPasswordReset({ body: { email: parsed.data.email, redirectTo: ROUTES.resetPassword }, headers: h });
  } catch (err) {
    // خطا افشا نمی‌شود تا وجود حساب قابل تشخیص نباشد
    console.error("[auth] password reset request failed", err);
  }
  return { status: "success", message: RESET_SENT };
}

export async function resetPasswordAction(
  _prev: AuthFormState<ResetPasswordInput>,
  formData: FormData,
): Promise<AuthFormState<ResetPasswordInput>> {
  const raw = {
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error) };

  const h = await headers();
  if (!consumeAll(authRateLimits.passwordReset, [`ip:${clientIp(h)}`])) return { status: "error", message: TOO_MANY };

  try {
    // همه نشست‌های قبلی کاربر باطل می‌شوند (revokeSessionsOnPasswordReset)
    await auth.api.resetPassword({ body: { token: parsed.data.token, newPassword: parsed.data.password }, headers: h });
  } catch (err) {
    if (errorCode(err) === "INVALID_TOKEN" || (isAPIError(err) && err.status === "BAD_REQUEST")) {
      return { status: "error", message: "لینک بازیابی نامعتبر یا منقضی شده است. لطفاً دوباره درخواست دهید." };
    }
    console.error("[auth] password reset failed", err);
    return { status: "error", message: GENERIC };
  }
  redirect(`${ROUTES.login}?notice=password_reset`);
}

// ------------------------------------------------------------------ ارسال مجدد تأیید ایمیل

export async function resendVerificationAction(
  _prev: AuthFormState<ForgotPasswordInput>,
  formData: FormData,
): Promise<AuthFormState<ForgotPasswordInput>> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values: raw };

  const h = await headers();
  if (!consumeAll(authRateLimits.resendVerification, [`ip:${clientIp(h)}`, `email:${parsed.data.email}`])) {
    return { status: "error", message: TOO_MANY, values: raw };
  }
  try {
    await auth.api.sendVerificationEmail({ body: { email: parsed.data.email, callbackURL: VERIFY_EMAIL_CALLBACK }, headers: h });
  } catch (err) {
    if (!isAPIError(err)) console.error("[auth] resend verification failed", err);
  }
  return { status: "success", message: "اگر حساب تأییدنشده‌ای با این ایمیل وجود داشته باشد، لینک تأیید جدید ارسال شد." };
}
