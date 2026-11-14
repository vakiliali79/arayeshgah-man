import { CalendarIcon, MapPinIcon, SearchIcon, ShieldIcon, StarIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { toPersianDigits } from "@/lib/utils";

const stats = [
  { value: 1200, suffix: "+", label: "سالن فعال" },
  { value: 8500, suffix: "+", label: "آرایشگر حرفه‌ای" },
  { value: 4.9, suffix: "", label: "رضایت کاربران" },
];

const slots = [
  { time: "۱۰:۰۰", state: "booked" },
  { time: "۱۱:۳۰", state: "selected" },
  { time: "۱۴:۰۰", state: "booked" },
  { time: "۱۶:۳۰", state: "free" },
] as const;

const slotStyles = {
  booked: "bg-surface-muted text-muted/60 line-through",
  selected: "bg-primary text-primary-foreground",
  free: "bg-surface-muted text-foreground",
} as const;

export function Hero() {
  return (
    <section className="bg-luxe relative overflow-hidden">
      <div className="container-page grid items-center gap-10 pt-10 pb-14 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20 lg:pb-24">
        <div className="animate-fade-up space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-surface/70 px-3.5 py-1.5 text-xs font-medium text-gold-600 backdrop-blur">
            <StarIcon size={14} /> تجربه‌ای لوکس از رزرو آنلاین زیبایی
          </span>
          <h1 className="text-[2rem] leading-[1.35] font-black sm:text-5xl sm:leading-[1.3]">
            زیبایی شما،
            <br />
            <span className="text-gradient-gold">در زمانی که می‌خواهید</span>
          </h1>
          <p className="max-w-lg text-base leading-8 text-muted sm:text-lg">
            بهترین سالن‌ها و آرایشگران شهر را پیدا کنید، نمونه‌کارها و نظرات را ببینید و نوبت خود را در کمتر از یک
            دقیقه رزرو کنید.
          </p>

          <form role="search" action="#salons" className="rounded-lg border border-border bg-surface p-2 shadow-lift">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex h-12 shrink-0 items-center sm:flex-1 gap-2.5 rounded-md bg-surface-muted px-3.5">
                <SearchIcon size={18} className="text-muted" />
                <span className="sr-only">خدمت یا سالن</span>
                <input name="q" placeholder="خدمت، سالن یا آرایشگر…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70" />
              </label>
              <label className="flex h-12 items-center gap-2.5 rounded-md bg-surface-muted px-3.5 sm:w-44">
                <MapPinIcon size={18} className="text-muted" />
                <span className="sr-only">شهر</span>
                <input name="city" placeholder="تهران" className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70" />
              </label>
              <Button type="submit" size="lg" className="h-12">
                جستجو
              </Button>
            </div>
          </form>

          <dl className="grid max-w-md grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-xl font-extrabold sm:text-2xl">
                  {toPersianDigits(s.value.toLocaleString("en-US"))}
                  <span className="text-gold-500">{s.suffix}</span>
                </dd>
                <dd className="text-xs text-muted sm:text-sm">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* کارت تزئینی پیش‌نمایش رزرو */}
        <div className="relative mx-auto hidden w-full max-w-sm sm:block" aria-hidden>
          <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-primary-200/60 via-gold-100/60 to-transparent blur-2xl" />
          <div className="relative space-y-4 rounded-xl border border-border bg-surface p-5 shadow-lift">
            <div className="h-44 rounded-lg bg-gradient-to-br from-primary-600 via-primary-400 to-gold-300" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">سالن زیبایی رز طلایی</p>
                <p className="text-xs text-muted">رنگ و لایت · ۹۰ دقیقه</p>
              </div>
              <span className="rounded-full bg-gold-50 px-2.5 py-1 text-xs font-semibold text-gold-600">۴٫۹ ★</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {slots.map((s) => (
                <span key={s.time} className={`rounded-sm py-2 ${slotStyles[s.state]}`}>
                  {s.time}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5 text-xs text-success">
              <ShieldIcon size={16} /> نوبت شما قطعی و بدون تداخل ثبت شد
            </div>
          </div>
          <div className="absolute -bottom-5 -start-6 flex items-center gap-2 rounded-md border border-border bg-surface px-3.5 py-2.5 text-xs shadow-lift">
            <CalendarIcon size={16} className="text-primary-600" /> پنجشنبه، ساعت ۱۱:۳۰
          </div>
        </div>
      </div>
    </section>
  );
}
