import Link from "next/link";
import { CalendarIcon, ChartIcon, ImageIcon, StarIcon, StoreIcon, UserIcon, UsersIcon, ClockIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui";
import { ContentHero } from "@/features/public/components/content-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("ویژه کسب‌وکارها", "ابزار مدیریت نوبت، برنامه کاری، تیم و خدمات برای سالن‌ها و آرایشگران.", "/businesses");

const FEATURES = [
  { Icon: CalendarIcon, title: "رزرو آنلاین بدون تداخل", text: "مشتریان فقط زمان‌های واقعاً آزاد را می‌بینند و سیستم از رزرو هم‌زمان یک زمان جلوگیری می‌کند." },
  { Icon: ClockIcon, title: "برنامه کاری و تعطیلات", text: "ساعات کاری سالن، شیفت هر آرایشگر و روزهای تعطیل را تعریف کنید." },
  { Icon: UsersIcon, title: "مدیریت تیم و دسترسی‌ها", text: "آرایشگران، مدیر و پذیرش را با سطح دسترسی دلخواه به تیم اضافه کنید." },
  { Icon: StarIcon, title: "نظرات واقعی مشتریان", text: "فقط مشتریانی که نوبتشان انجام شده نظر می‌دهند و شما می‌توانید پاسخ دهید." },
  { Icon: ImageIcon, title: "صفحه اختصاصی و نمونه‌کار", text: "خدمات، قیمت‌ها، تیم و گالری کارهایتان را در صفحه عمومی نمایش دهید." },
  { Icon: ChartIcon, title: "گزارش نوبت و درآمد", text: "تعداد نوبت‌ها، وضعیت آن‌ها و درآمد نوبت‌های انجام‌شده را دنبال کنید." },
];

export default function BusinessesPage() {
  return (
    <>
      <ContentHero eyebrow="ویژه کسب‌وکارها" title="کسب‌وکار زیبایی خود را حرفه‌ای مدیریت کنید" description="سالن دارید یا آرایشگر مستقل هستید؟ آرایشگاه من نوبت‌دهی، برنامه کاری و ارتباط با مشتریان را برایتان ساده می‌کند." />
      <section className="container-page py-12">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, text }) => (
            <li key={title} className="rounded-lg border border-border bg-surface p-6">
              <span className="mb-4 flex size-12 items-center justify-center rounded-md bg-gold-50 text-gold-600"><Icon size={24} /></span>
              <h2 className="mb-2 font-bold">{title}</h2>
              <p className="text-sm leading-7 text-muted">{text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link href="/register-salon" className="rounded-lg bg-primary-900 p-6 text-primary-foreground hover:bg-primary-800">
            <StoreIcon size={28} className="mb-3 text-gold-300" />
            <p className="text-lg font-bold">ثبت سالن</p>
            <p className="mt-1 text-sm text-primary-200">برای صاحبان سالن زیبایی</p>
          </Link>
          <Link href="/join-as-stylist" className="rounded-lg border border-border bg-surface p-6 hover:shadow-lift">
            <UserIcon size={28} className="mb-3 text-primary-600" />
            <p className="text-lg font-bold">همکاری آرایشگران</p>
            <p className="mt-1 text-sm text-muted">برای آرایشگران مستقل یا عضو سالن</p>
          </Link>
        </div>
        <p className="mt-6 text-center text-sm"><Link href="/pricing" className={buttonVariants({ variant: "ghost" })}>مشاهده تعرفه‌ها</Link></p>
      </section>
    </>
  );
}
