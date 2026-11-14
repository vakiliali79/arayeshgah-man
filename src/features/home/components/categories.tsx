import { BrushIcon, EyeIcon, FaceIcon, HandIcon, ScissorsIcon, SparkleIcon } from "@/components/icons";
import { SectionHeading } from "@/components/ui";
import { toPersianDigits } from "@/lib/utils";
import { categories } from "../data";

const icons = { scissors: ScissorsIcon, brush: BrushIcon, hand: HandIcon, face: FaceIcon, sparkle: SparkleIcon, eye: EyeIcon };

export function Categories() {
  return (
    <section id="categories" className="container-page scroll-mt-20 py-14 sm:py-20">
      <SectionHeading eyebrow="دسته‌بندی خدمات" title="امروز چه خدمتی می‌خواهید؟" />
      <ul className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-6">
        {categories.map((c) => {
          const Icon = icons[c.icon];
          return (
            <li key={c.key}>
              <a
                href="#salons"
                className="group flex h-full flex-col items-center gap-3 rounded-lg border border-border bg-surface p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift sm:p-5"
              >
                <span className="flex size-12 items-center justify-center rounded-md bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary group-hover:text-gold-300 sm:size-14">
                  <Icon size={24} />
                </span>
                <span className="text-xs leading-5 font-semibold sm:text-sm">{c.title}</span>
                <span className="text-[0.7rem] text-muted">{toPersianDigits(c.count)} سالن</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
