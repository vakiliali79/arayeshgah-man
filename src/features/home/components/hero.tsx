import { MapPinIcon, SearchIcon, ShieldIcon, StarIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { toPersianDigits } from "@/lib/utils";

/** بخش اول صفحه اصلی؛ آمار فقط از داده واقعی و فقط در صورت وجود */
export function Hero({ salonCount, stylistCount, avgRating }: { salonCount: number; stylistCount: number; avgRating: number | null }) {
  const stats = [
    salonCount > 0 && { value: toPersianDigits(salonCount.toLocaleString("en-US")), label: "سالن فعال" },
    stylistCount > 0 && { value: toPersianDigits(stylistCount.toLocaleString("en-US")), label: "آرایشگر" },
    avgRating && { value: toPersianDigits(avgRating.toFixed(1)), label: "میانگین رضایت" },
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <section className="bg-luxe relative overflow-hidden">
      <div className="container-page grid items-center gap-10 pt-10 pb-14 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20 lg:pb-24">
        <div className="animate-fade-up space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-surface/70 px-3.5 py-1.5 text-xs font-medium text-gold-600 backdrop-blur">
            <StarIcon size={14} /> رزرو آنلاین خدمات زیبایی
          </span>
          <h1 className="text-[2rem] leading-[1.35] font-black sm:text-5xl sm:leading-[1.3]">
            زیبایی شما،
            <br />
            <span className="text-gradient-gold">در زمانی که می‌خواهید</span>
          </h1>
          <p className="max-w-lg text-base leading-8 text-muted sm:text-lg">
            سالن‌ها و آرایشگران را پیدا کنید، خدمات، قیمت‌ها و نظرات را ببینید و از میان زمان‌های واقعاً آزاد، نوبت خود را رزرو کنید.
          </p>

          <form role="search" action="/salons" className="rounded-lg border border-border bg-surface p-2 shadow-lift">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex h-12 shrink-0 items-center gap-2.5 rounded-md bg-surface-muted px-3.5 sm:flex-1">
                <SearchIcon size={18} className="text-muted" />
                <span className="sr-only">نام سالن یا خدمت</span>
                <input name="q" placeholder="نام سالن یا خدمت…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70" />
              </label>
              <label className="flex h-12 items-center gap-2.5 rounded-md bg-surface-muted px-3.5 sm:w-44">
                <MapPinIcon size={18} className="text-muted" />
                <span className="sr-only">شهر</span>
                <input name="city" placeholder="شهر" className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70" />
              </label>
              <Button type="submit" size="lg" className="h-12">جستجو</Button>
            </div>
          </form>

          {stats.length > 0 && (
            <dl className="grid max-w-md grid-cols-3 gap-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-xl font-extrabold sm:text-2xl">{s.value}</dd>
                  <dd className="text-xs text-muted sm:text-sm">{s.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* تصویر توضیحی فرایند رزرو (نمونه رابط کاربری، نه داده واقعی) */}
        <div className="relative mx-auto hidden w-full max-w-sm sm:block" aria-hidden>
          <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-primary-200/60 via-gold-100/60 to-transparent blur-2xl" />
          <div className="relative space-y-4 rounded-xl border border-border bg-surface p-5 shadow-lift">
            <p className="text-sm font-bold">انتخاب زمان</p>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {["۱۰:۰۰", "۱۱:۳۰", "۱۴:۰۰", "۱۶:۳۰"].map((t, i) => (
                <span key={t} className={`rounded-sm py-2 ${i === 1 ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground"}`}>{t}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5 text-xs text-success">
              <ShieldIcon size={16} /> زمان‌ها لحظه‌ای بررسی می‌شوند؛ دو نفر یک نوبت را رزرو نمی‌کنند
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
