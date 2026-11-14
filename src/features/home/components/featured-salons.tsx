import { ArrowLeftIcon, MapPinIcon } from "@/components/icons";
import { Badge, Rating, SectionHeading } from "@/components/ui";
import { featuredSalons } from "../data";

export function FeaturedSalons() {
  return (
    <section id="salons" className="scroll-mt-20 bg-surface-muted/60 py-14 sm:py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow="منتخب آرایشگاه من"
          title="سالن‌های برتر این هفته"
          action={
            <span className="hidden items-center gap-1 text-sm font-medium text-primary-700 sm:inline-flex">
              مشاهده همه <ArrowLeftIcon size={16} />
            </span>
          }
        />
        {/* موبایل: اسکرول افقی؛ دسکتاپ: گرید */}
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {featuredSalons.map((s) => (
            <li key={s.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <article className="group h-full overflow-hidden rounded-lg border border-border bg-surface transition-shadow hover:shadow-lift">
                <div className={`relative aspect-[4/3] bg-gradient-to-br ${s.hue}`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.45),transparent_55%)]" />
                  <span className="absolute top-3 start-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium backdrop-blur">
                    نوبت آزاد امروز
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold leading-7">{s.name}</h3>
                    <Rating value={s.rating} count={s.reviews} />
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <MapPinIcon size={14} /> {s.area}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.tags.map((t) => (
                      <Badge key={t} tone="neutral">{t}</Badge>
                    ))}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
