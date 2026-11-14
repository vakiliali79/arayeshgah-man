import Link from "next/link";
import { BrushIcon, EyeIcon, FaceIcon, HandIcon, ScissorsIcon, SparkleIcon, StarIcon } from "@/components/icons";
import { SectionHeading } from "@/components/ui";
import type { ServiceCategory } from "@/db/types";
import { toPersianDigits } from "@/lib/utils";

/** آیکن دسته‌بندی‌های پایه؛ دسته‌بندی‌های افزوده‌شده توسط ادمین آیکن عمومی می‌گیرند */
const icons: Record<string, typeof ScissorsIcon> = {
  hair: ScissorsIcon, color: BrushIcon, nail: HandIcon, skin: FaceIcon, makeup: SparkleIcon, brow_lash: EyeIcon, spa: StarIcon, other: StarIcon,
};

export function Categories({ items }: { items: { key: ServiceCategory; label: string; salons: number }[] }) {
  return (
    <section id="categories" className="container-page scroll-mt-20 py-14 sm:py-20">
      <SectionHeading eyebrow="دسته‌بندی خدمات" title="امروز چه خدمتی می‌خواهید؟" />
      <ul className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-8">
        {items.map((c) => {
          const Icon = icons[c.key] ?? StarIcon;
          return (
            <li key={c.key}>
              <Link href={`/salons?category=${c.key}`} className="group flex h-full flex-col items-center gap-3 rounded-lg border border-border bg-surface p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift">
                <span className="flex size-12 items-center justify-center rounded-md bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary group-hover:text-gold-300"><Icon size={24} /></span>
                <span className="text-xs leading-5 font-semibold sm:text-sm">{c.label}</span>
                <span className="text-[0.7rem] text-muted">{c.salons > 0 ? `${toPersianDigits(c.salons)} سالن` : "به‌زودی"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
