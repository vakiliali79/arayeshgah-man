/**
 * نرمال‌سازی شماره موبایل ایران.
 * شکل استاندارد ذخیره (هویت ورود): E.164 → ‎+989XXXXXXXXX
 * شکل نمایش/تماس (profiles.phone): ‎09XXXXXXXXX
 */
const DIGITS: Record<string, string> = {};
"۰۱۲۳۴۵۶۷۸۹".split("").forEach((d, i) => (DIGITS[d] = String(i)));
"٠١٢٣٤٥٦٧٨٩".split("").forEach((d, i) => (DIGITS[d] = String(i)));

export const CANONICAL_PHONE = /^\+989\d{9}$/;

/** هر قالب رایج را به ‎+989XXXXXXXXX‎ تبدیل می‌کند؛ ورودی نامعتبر → null */
export function normalizeIranMobile(input: string): string | null {
  if (typeof input !== "string" || input.length > 32) return null;
  let s = input.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d]!).replace(/[\s\-().‌‎‏]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith("0098")) s = s.slice(4);
  else if (s.startsWith("98") && s.length === 12) s = s.slice(2);
  else if (s.startsWith("0")) s = s.slice(1);
  return /^9\d{9}$/.test(s) ? `+98${s}` : null;
}

export const isCanonicalPhone = (value: string) => CANONICAL_PHONE.test(value);

/** ‎+989121234567 → 09121234567 */
export function toLocalPhone(canonical: string): string {
  if (!isCanonicalPhone(canonical)) throw new Error("Phone number is not in canonical form");
  return `0${canonical.slice(3)}`;
}

/** نمایش با ارقام لاتین گروه‌بندی‌شده: 0912 123 4567 */
export function formatPhoneForDisplay(canonical: string): string {
  const local = toLocalPhone(canonical);
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
