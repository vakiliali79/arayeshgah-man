import { z } from "zod";
import { SELF_ASSIGNABLE_ROLES } from "@/config/roles";
import { toLatinDigits } from "@/lib/utils/format";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "ایمیل را وارد کنید")
  .max(254, "ایمیل بیش از حد طولانی است")
  .pipe(z.email("ایمیل معتبر نیست"));

/** سیاست رمز عبور (برای ثبت‌نام و بازیابی) */
const newPassword = z
  .string()
  .min(8, "رمز عبور حداقل ۸ کاراکتر باشد")
  .max(72, "رمز عبور حداکثر ۷۲ کاراکتر باشد")
  .regex(/[A-Za-z]/, "رمز عبور باید حداقل یک حرف انگلیسی داشته باشد")
  .regex(/\d/, "رمز عبور باید حداقل یک عدد داشته باشد");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "رمز عبور را وارد کنید").max(72),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, "نام و نام خانوادگی حداقل ۳ حرف باشد").max(80, "نام بیش از حد طولانی است"),
  email,
  phone: z
    .string()
    .transform((v) => toLatinDigits(v).replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود")),
  password: newPassword,
  role: z.enum(SELF_ASSIGNABLE_ROLES, "نوع حساب را انتخاب کنید"),
  terms: z.literal("on", "پذیرش قوانین الزامی است"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "لینک بازیابی نامعتبر است").max(512).regex(/^[A-Za-z0-9_-]+$/, "لینک بازیابی نامعتبر است"),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "تکرار رمز عبور مطابقت ندارد", path: ["confirmPassword"] });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export interface AuthFormState<T> {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors<T>;
  /** مقادیر قبلی برای بازگرداندن به فرم (بدون رمز عبور) */
  values?: Partial<Record<keyof T, string>>;
}

export function flattenErrors<T>(error: z.ZodError): FieldErrors<T> {
  const out: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof T | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
