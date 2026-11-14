"use server";

import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "./redirect";
import {
  flattenErrors,
  loginSchema,
  registerSchema,
  type AuthFormState,
  type LoginInput,
  type RegisterInput,
} from "./schemas";

const NOT_CONFIGURED = "اتصال به سرویس احراز هویت پیکربندی نشده است. فایل ‎.env.local‎ را تنظیم کنید.";

export async function signInAction(
  _prev: AuthFormState<LoginInput>,
  formData: FormData,
): Promise<AuthFormState<LoginInput>> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const values = { email: raw.email };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { status: "error", message: NOT_CONFIGURED, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // پیام عمومی تا وجود یا عدم وجود حساب افشا نشود
    const message =
      error.code === "email_not_confirmed"
        ? "ایمیل شما هنوز تأیید نشده است. لطفاً صندوق ایمیل خود را بررسی کنید."
        : error.status === 429
          ? "تعداد تلاش‌ها زیاد است. لطفاً چند دقیقه دیگر دوباره امتحان کنید."
          : "ایمیل یا رمز عبور نادرست است.";
    return { status: "error", message, values };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

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

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { status: "error", message: NOT_CONFIGURED, values };

  const { email, password, fullName, phone, role } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // نقش درخواستی فقط «پیشنهاد» است؛ تریگر دیتابیس آن را اعتبارسنجی می‌کند و admin را نمی‌پذیرد.
      data: { full_name: fullName, phone, requested_role: role },
      emailRedirectTo: `${siteConfig.url}${ROUTES.authCallback}`,
    },
  });

  if (error) {
    const message =
      error.code === "weak_password"
        ? "رمز عبور انتخابی امن نیست. رمز قوی‌تری انتخاب کنید."
        : error.status === 429
          ? "تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید."
          : "ثبت‌نام انجام نشد. لطفاً دوباره تلاش کنید.";
    return { status: "error", message, values };
  }

  // اگر تأیید ایمیل غیرفعال باشد نشست بلافاصله ساخته می‌شود
  if (data.session) redirect(ROUTES.dashboard);

  return {
    status: "success",
    message: "حساب شما ساخته شد. لینک تأیید به ایمیلتان ارسال شد؛ پس از تأیید وارد شوید.",
  };
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(ROUTES.login);
}
