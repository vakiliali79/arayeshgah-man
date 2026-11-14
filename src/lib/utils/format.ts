const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** تبدیل ارقام لاتین به فارسی */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => faDigits[Number(d)] ?? d);
}

/** تبدیل ارقام فارسی/عربی به لاتین (برای ورودی کاربر) */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** نمایش مبلغ به تومان */
export function formatToman(amount: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
}
