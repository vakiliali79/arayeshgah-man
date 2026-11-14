import type { DashboardSection } from "@/server/dashboard/access";

export type NavIcon =
  | "home" | "calendar" | "heart" | "star" | "user" | "scissors" | "image" | "clock" | "store" | "users"
  | "chart" | "settings" | "inbox" | "tag" | "grid" | "file" | "shield" | "bell";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** فقط مسیر دقیق فعال باشد (برای صفحه خلاصه) */
  exact?: boolean;
}

export const SECTION_LABEL: Record<DashboardSection, string> = {
  customer: "حساب من",
  stylist: "پنل آرایشگر",
  salon: "پنل سالن",
  admin: "مدیریت کل",
};

export const NAV: Record<DashboardSection, NavItem[]> = {
  customer: [
    { href: "/dashboard/customer", label: "خلاصه", icon: "home", exact: true },
    { href: "/dashboard/customer/bookings", label: "نوبت‌های من", icon: "calendar" },
    { href: "/dashboard/customer/favorites", label: "علاقه‌مندی‌ها", icon: "heart" },
    { href: "/dashboard/customer/reviews", label: "نظرات من", icon: "star" },
    { href: "/dashboard/customer/notifications", label: "اعلان‌ها", icon: "bell" },
    { href: "/dashboard/customer/support", label: "پشتیبانی من", icon: "inbox" },
    { href: "/dashboard/customer/profile", label: "اطلاعات حساب", icon: "user" },
  ],
  stylist: [
    { href: "/dashboard/stylist", label: "خلاصه", icon: "home", exact: true },
    { href: "/dashboard/stylist/bookings", label: "نوبت‌ها", icon: "calendar" },
    { href: "/dashboard/stylist/services", label: "خدمات", icon: "scissors" },
    { href: "/dashboard/stylist/schedule", label: "برنامه کاری", icon: "clock" },
    { href: "/dashboard/stylist/portfolio", label: "نمونه‌کارها", icon: "image" },
    { href: "/dashboard/stylist/reviews", label: "نظرات", icon: "star" },
    { href: "/dashboard/stylist/salons", label: "سالن‌های من", icon: "store" },
    { href: "/dashboard/stylist/profile", label: "پروفایل حرفه‌ای", icon: "user" },
  ],
  salon: [{ href: "/dashboard/salon", label: "سالن‌های من", icon: "store", exact: true }],
  admin: [
    { href: "/dashboard/admin", label: "خلاصه", icon: "chart", exact: true },
    { href: "/dashboard/admin/users", label: "کاربران", icon: "users" },
    { href: "/dashboard/admin/salons", label: "سالن‌ها", icon: "store" },
    { href: "/dashboard/admin/stylists", label: "آرایشگران", icon: "scissors" },
    { href: "/dashboard/admin/bookings", label: "نوبت‌ها", icon: "calendar" },
    { href: "/dashboard/admin/reviews", label: "نظرات", icon: "star" },
    { href: "/dashboard/admin/tickets", label: "پشتیبانی و شکایات", icon: "inbox" },
    { href: "/dashboard/admin/categories", label: "دسته‌بندی خدمات", icon: "tag" },
    { href: "/dashboard/admin/plans", label: "تعرفه‌ها", icon: "grid" },
    { href: "/dashboard/admin/content", label: "محتوا و تنظیمات", icon: "settings" },
    { href: "/dashboard/admin/audit", label: "تاریخچه اقدامات", icon: "file" },
  ],
};

/** منوی داخلی هر سالن */
export const salonNav = (salonId: string): NavItem[] => [
  { href: `/dashboard/salon/${salonId}`, label: "خلاصه سالن", icon: "chart", exact: true },
  { href: `/dashboard/salon/${salonId}/bookings`, label: "نوبت‌ها", icon: "calendar" },
  { href: `/dashboard/salon/${salonId}/services`, label: "خدمات", icon: "scissors" },
  { href: `/dashboard/salon/${salonId}/team`, label: "تیم", icon: "users" },
  { href: `/dashboard/salon/${salonId}/schedule`, label: "برنامه کاری", icon: "clock" },
  { href: `/dashboard/salon/${salonId}/reviews`, label: "نظرات", icon: "star" },
  { href: `/dashboard/salon/${salonId}/settings`, label: "اطلاعات و تصاویر", icon: "settings" },
];
