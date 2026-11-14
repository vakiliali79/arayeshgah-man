import { CalendarIcon, SearchIcon, SparkleIcon } from "@/components/icons";
import { SectionHeading } from "@/components/ui";
import { toPersianDigits } from "@/lib/utils";

const steps = [
  { Icon: SearchIcon, title: "جستجو و مقایسه", text: "سالن‌ها را بر اساس خدمت، موقعیت، امتیاز و نمونه‌کار مقایسه کنید." },
  { Icon: CalendarIcon, title: "انتخاب زمان", text: "از میان زمان‌های واقعاً آزاد انتخاب کنید؛ بدون تداخل و انتظار." },
  { Icon: SparkleIcon, title: "تجربه زیبایی", text: "یادآوری خودکار دریافت کنید و پس از خدمت، تجربه‌تان را ثبت کنید." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container-page scroll-mt-20 py-14 sm:py-20">
      <SectionHeading eyebrow="ساده و سریع" title="رزرو در سه قدم" className="justify-center text-center [&>div]:mx-auto" />
      <ol className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        {steps.map(({ Icon, title, text }, i) => (
          <li key={title} className="relative rounded-lg border border-border bg-surface p-6">
            <span className="absolute top-5 end-5 text-4xl font-black text-primary-50">{toPersianDigits(i + 1)}</span>
            <span className="mb-4 flex size-12 items-center justify-center rounded-md bg-gold-50 text-gold-600">
              <Icon size={24} />
            </span>
            <h3 className="mb-2 font-bold">{title}</h3>
            <p className="text-sm leading-7 text-muted">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
