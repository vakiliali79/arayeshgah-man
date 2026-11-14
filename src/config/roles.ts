/**
 * نقش‌های سیستم. مقدار رشته‌ای باید با enum دیتابیس (user_role) یکسان باشد.
 */
export const USER_ROLES = ["customer", "stylist", "salon_owner", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** نقش‌هایی که کاربر هنگام ثبت‌نام می‌تواند انتخاب کند (admin فقط توسط سیستم) */
export const SELF_ASSIGNABLE_ROLES = ["customer", "stylist", "salon_owner"] as const;
export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

export const ROLE_META: Record<UserRole, { label: string; description: string }> = {
  customer: { label: "مشتری", description: "رزرو نوبت در بهترین سالن‌ها" },
  stylist: { label: "آرایشگر", description: "مدیریت نوبت‌ها و نمونه‌کارها" },
  salon_owner: { label: "صاحب سالن", description: "مدیریت سالن، پرسنل و خدمات" },
  admin: { label: "مدیر سیستم", description: "مدیریت کل پلتفرم" },
};
