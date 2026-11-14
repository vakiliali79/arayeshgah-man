import Link from "next/link";
import { CalendarIcon, CheckIcon, StoreIcon, UserIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui";

const perks = ["تقویم هوشمند و جلوگیری از تداخل نوبت", "مدیریت پرسنل، خدمات و قیمت‌ها", "صفحه اختصاصی و نمایش نمونه‌کار", "گزارش درآمد و رضایت مشتریان"];

export function ForBusiness() {
  return (
    <section id="for-business" className="container-page scroll-mt-20 pb-14 sm:pb-20">
      <div className="relative overflow-hidden rounded-xl bg-primary-900 px-6 py-10 text-primary-foreground sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute -top-24 -end-24 size-72 rounded-full bg-gold-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -start-16 size-72 rounded-full bg-primary-400/30 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            <p className="text-xs font-semibold text-gold-300">ویژه سالن‌داران و آرایشگران</p>
            <h2 className="text-2xl leading-[1.5] font-extrabold sm:text-3xl">کسب‌وکار زیبایی خود را حرفه‌ای مدیریت کنید</h2>
            <ul className="space-y-2.5 text-sm text-primary-100">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <CheckIcon size={18} className="text-gold-300" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/register-salon" className="rounded-lg bg-white/8 p-5 ring-1 ring-white/15 transition hover:bg-white/12">
              <StoreIcon size={26} className="mb-3 text-gold-300" />
              <p className="font-bold">ثبت سالن</p>
              <p className="mt-1 text-xs text-primary-200">برای صاحبان سالن زیبایی</p>
            </Link>
            <Link href="/join-as-stylist" className="rounded-lg bg-white/8 p-5 ring-1 ring-white/15 transition hover:bg-white/12">
              <UserIcon size={26} className="mb-3 text-gold-300" />
              <p className="font-bold">همکاری آرایشگر</p>
              <p className="mt-1 text-xs text-primary-200">برای آرایشگران مستقل یا عضو سالن</p>
            </Link>
            <Link href="/businesses" className={buttonVariants({ variant: "gold", size: "lg", className: "sm:col-span-2" })}>
              <CalendarIcon size={18} /> آشنایی با امکانات کسب‌وکارها
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
