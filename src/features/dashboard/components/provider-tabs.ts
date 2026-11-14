import type { ProviderBookingTab } from "@/server/stylists/dashboard";

export const PROVIDER_TABS: { key: ProviderBookingTab; label: string; empty: string }[] = [
  { key: "pending", label: "در انتظار تأیید", empty: "درخواست نوبت جدیدی ندارید." },
  { key: "upcoming", label: "پیش‌رو", empty: "نوبت تأییدشده پیش‌رویی ندارید." },
  { key: "past", label: "گذشته", empty: "نوبت گذشته‌ای وجود ندارد." },
  { key: "cancelled", label: "لغو/رد شده", empty: "نوبت لغوشده‌ای وجود ندارد." },
];
