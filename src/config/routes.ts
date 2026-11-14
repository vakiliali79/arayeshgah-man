import type { UserRole } from "./roles";

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  dashboard: "/dashboard",
} as const;

/** مسیرهایی که نیاز به ورود دارند (پیشوند) — proxy فقط وجود کوکی را بررسی می‌کند */
export const PROTECTED_PREFIXES = ["/dashboard"] as const;

/** صفحات مهمان؛ اگر نشست معتبر باشد (بررسی سمت سرور در خود صفحه) به داشبورد هدایت می‌شود */
export const GUEST_ONLY_ROUTES = [ROUTES.login, ROUTES.register, ROUTES.forgotPassword] as const;

/**
 * دسترسی نقش‌ها به بخش‌های داشبورد — در مراحل بعد تکمیل می‌شود.
 * کلید: پیشوند مسیر، مقدار: نقش‌های مجاز
 */
export const ROLE_ACCESS: Record<string, readonly UserRole[]> = {
  "/dashboard/admin": ["admin"],
  "/dashboard/salon": ["salon_owner", "admin"],
  "/dashboard/stylist": ["stylist", "admin"],
};
