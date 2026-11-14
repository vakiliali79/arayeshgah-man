/** بررسی معتبر بودن نام منطقه زمانی IANA (مثل Asia/Tehran) */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const MINUTE_MS = 60_000;
export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * MINUTE_MS);

/** زمان فعلی (نقطه واحد برای صفحات سرور؛ قابل تعویض در تست) */
export const currentTime = () => new Date();
