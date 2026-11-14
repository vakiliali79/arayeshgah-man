import { z } from "zod";
import { SELF_ASSIGNABLE_ROLES } from "@/config/roles";
import { OTP_LENGTH } from "@/server/otp/config";
import { normalizeIranMobile } from "@/server/otp/phone";
import { toLatinDigits } from "@/lib/utils/format";

/** هر قالب رایج (۰۹…، ‎+98…، 0098…، ارقام فارسی) → ‎+989XXXXXXXXX */
export const phoneSchema = z
  .string("شماره موبایل را وارد کنید")
  .trim()
  .min(1, "شماره موبایل را وارد کنید")
  .transform((v, ctx) => {
    const normalized = normalizeIranMobile(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)" });
      return z.NEVER;
    }
    return normalized;
  });

export const otpCodeSchema = z
  .string("کد تأیید را وارد کنید")
  .transform((v) => toLatinDigits(v).replace(/\s/g, ""))
  .pipe(z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `کد تأیید ${OTP_LENGTH} رقمی را کامل وارد کنید`));

const fullName = z.string().trim().min(3, "نام و نام خانوادگی حداقل ۳ حرف باشد").max(80, "نام بیش از حد طولانی است");
/** admin هرگز در ثبت‌نام عمومی پذیرفته نمی‌شود */
const role = z.enum(SELF_ASSIGNABLE_ROLES, "نوع حساب را انتخاب کنید");

export const loginPhoneSchema = z.object({ phone: phoneSchema });
export const loginCodeSchema = z.object({ phone: phoneSchema, code: otpCodeSchema });

export const registerPhoneSchema = z.object({
  fullName,
  phone: phoneSchema,
  role,
  terms: z.literal("on", "پذیرش قوانین الزامی است"),
});
export const registerCodeSchema = z.object({ fullName, phone: phoneSchema, role, code: otpCodeSchema });

export type OtpPurposeInput = "login" | "register";

/** وضعیت فرم دومرحله‌ای (شماره → کد) */
export interface OtpFormState {
  step: "phone" | "code";
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"phone" | "code" | "fullName" | "role" | "terms", string>>;
  /** مقادیر فرم برای بازگرداندن/مرحله بعد (شماره به شکل محلی ۰۹…) */
  values?: { phone?: string; fullName?: string; role?: string };
  /** زمان ارسال آخرین کد (برای شمارش معکوس ارسال مجدد) */
  sentAt?: number;
}

export function flattenErrors(error: z.ZodError): OtpFormState["fieldErrors"] {
  const out: NonNullable<OtpFormState["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof typeof out | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
