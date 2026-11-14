import { and, eq } from "drizzle-orm";
import { isAPIError } from "better-auth/api";
import type { DbOrTx } from "@/db/client";
import { users } from "@/db/schema";
import type { SelfAssignableRole } from "@/config/roles";
import { applyRegistrationChoices, isPhoneTaken } from "../profiles/service";
import type { Auth } from "./better-auth";

export interface RegistrationInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: SelfAssignableRole;
}

export type RegistrationResult =
  | { ok: true }
  | { ok: false; reason: "phone_taken" | "weak_password" | "invalid" | "unknown" };

export const VERIFY_EMAIL_CALLBACK = "/verify-email";

/**
 * ثبت‌نام: ورودی باید قبلاً با registerSchema اعتبارسنجی شده باشد.
 * - کاربر توسط Better Auth ساخته می‌شود (hook → پروفایل customer)
 * - نقش انتخابی (فقط customer/stylist/salon_owner) و موبایل سمت سرور اعمال می‌شوند
 * - برای ایمیل تکراری Better Auth پاسخی یکسان با موفقیت برمی‌گرداند (جلوگیری از شناسایی ایمیل‌ها)
 */
export async function registerUser(auth: Auth, db: DbOrTx, input: RegistrationInput, headers: Headers): Promise<RegistrationResult> {
  if (await isPhoneTaken(db, input.phone)) return { ok: false, reason: "phone_taken" };

  let createdId: string;
  try {
    const res = await auth.api.signUpEmail({
      body: { name: input.fullName, email: input.email, password: input.password, callbackURL: VERIFY_EMAIL_CALLBACK },
      headers,
    });
    createdId = res.user.id;
  } catch (err) {
    if (isAPIError(err)) {
      const code = (err.body as { code?: string } | undefined)?.code;
      if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") return { ok: false, reason: "weak_password" };
      if (err.status === "BAD_REQUEST" || err.status === "UNPROCESSABLE_ENTITY") return { ok: false, reason: "invalid" };
    }
    console.error("[auth] sign-up failed", err);
    return { ok: false, reason: "unknown" };
  }

  // در پاسخ عمومی ایمیل تکراری، شناسه ساختگی است و با هیچ کاربری مطابقت ندارد.
  // برای اطمینان، انتخاب‌ها فقط روی کاربر تازه و تأییدنشده با همین ایمیل اعمال می‌شوند.
  const [fresh] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, createdId), eq(users.email, input.email.toLowerCase()), eq(users.emailVerified, false)))
    .limit(1);
  if (fresh) await applyRegistrationChoices(db, fresh.id, { role: input.role, phone: input.phone });

  return { ok: true };
}
