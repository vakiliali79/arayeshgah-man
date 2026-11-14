/** لینک صفحه رزرو با پارامترهای انتخاب‌شده (همه در سمت سرور دوباره اعتبارسنجی می‌شوند) */
export function bookHref(p: { salon?: string | null; stylist?: string | null; service?: string | null; date?: string | null; time?: string | null }) {
  const q = new URLSearchParams();
  for (const k of ["salon", "stylist", "service", "date", "time"] as const) {
    const v = p[k];
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `/book?${s}` : "/book";
}
