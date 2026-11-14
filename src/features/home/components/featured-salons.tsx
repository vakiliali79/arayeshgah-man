import Link from "next/link";
import { ArrowLeftIcon, StoreIcon } from "@/components/icons";
import { EmptyState, SectionHeading, buttonVariants } from "@/components/ui";
import { SalonCard, type SalonCardData } from "@/features/public/components/cards";

export function FeaturedSalons({ salons }: { salons: SalonCardData[] }) {
  return (
    <section id="salons" className="scroll-mt-20 bg-surface-muted/60 py-14 sm:py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow="منتخب آرایشگاه من"
          title="سالن‌های برتر"
          action={<Link href="/salons" className="hidden items-center gap-1 text-sm font-medium text-primary-700 sm:inline-flex">مشاهده همه <ArrowLeftIcon size={16} /></Link>}
        />
        {salons.length === 0 ? (
          <EmptyState icon={<StoreIcon />} title="به‌زودی سالن‌ها اینجا معرفی می‌شوند" description="اولین سالن‌ها در حال پیوستن به آرایشگاه من هستند. صاحب سالن هستید؟ همین حالا ثبت کنید." action={<Link href="/register-salon" className={buttonVariants({ size: "sm" })}>ثبت سالن</Link>} />
        ) : (
          <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {salons.map((s) => <li key={s.id} className="w-[78%] shrink-0 snap-start sm:w-auto"><SalonCard s={s} /></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
