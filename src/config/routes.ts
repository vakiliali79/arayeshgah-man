import type { UserRole } from "./roles";

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  authCallback: "/auth/callback",
  dashboard: "/dashboard",
} as const;

/** مسیرهایی که نیاز به ورود دارند (پیشوند) */
export const PROTECTED_PREFIXES = ["/dashboard"] as const;

/** مسیرهای مخصوص کاربران مهمان؛ کاربر واردشده به داشبورد هدایت می‌شود */
export const GUEST_ONLY_ROUTES = [ROUTES.login, ROUTES.register] as const;

/**
 * دسترسی نقش‌ها به بخش‌های داشبورد — در مراحل بعد تکمیل می‌شود.
 * کلید: پیشوند مسیر، مقدار: نقش‌های مجاز
 */
export const ROLE_ACCESS: Record<string, readonly UserRole[]> = {
  "/dashboard/admin": ["admin"],
  "/dashboard/salon": ["salon_owner", "admin"],
  "/dashboard/stylist": ["stylist", "admin"],
};
