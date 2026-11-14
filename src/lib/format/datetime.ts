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

/**
 * تاریخ و ساعت محلی (YYYY-MM-DD و HH:MM) در منطقه زمانی مشخص → رشته ISO با offset صحیح
 * (با در نظر گرفتن ساعت تابستانی هر منطقه).
 */
export function zonedLocalToIso(date: string, time: string, tz = DEFAULT_TZ): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  const offsetAt = (ms: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(ms))
        .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    return asUtc - ms;
  };
  let ts = guess - offsetAt(guess);
  ts = guess - offsetAt(ts);
  return new Date(ts).toISOString();
}
