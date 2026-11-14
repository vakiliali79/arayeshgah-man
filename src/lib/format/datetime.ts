/** قالب‌بندی تاریخ و ساعت به تقویم شمسی و منطقه زمانی مشخص (پیش‌فرض تهران) */
const DEFAULT_TZ = "Asia/Tehran";

export function formatDate(d: Date | string, tz = DEFAULT_TZ, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: tz, year: "numeric", month: "long", day: "numeric", ...opts }).format(new Date(d));
}

export function formatWeekdayDate(d: Date | string, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date(d));
}

export function formatTime(d: Date | string, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("fa-IR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(d));
}

export function formatDateTime(d: Date | string, tz = DEFAULT_TZ) {
  return `${formatWeekdayDate(d, tz)}، ساعت ${formatTime(d, tz)}`;
}

/** تاریخ محلی YYYY-MM-DD یک لحظه در منطقه زمانی مشخص */
export function localDateKey(d: Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** «HH:MM» از نوع time دیتابیس (۱۰:۰۰:۰۰ → ۱۰:۰۰) با ارقام فارسی */
export function formatClock(t: string) {
  return t.slice(0, 5).replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[Number(x)]!);
}

export const WEEKDAYS_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
/** ترتیب نمایش هفته ایرانی: شنبه تا جمعه (DOW پستگرس) */
export const IRAN_WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
