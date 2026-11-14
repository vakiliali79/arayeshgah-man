import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { SectionHeading } from "@/components/ui";
import { StylistCard, type StylistCardData } from "@/features/public/components/cards";

export function TopStylists({ stylists }: { stylists: StylistCardData[] }) {
  if (stylists.length === 0) return null;
  return (
    <section className="container-page pb-14 sm:pb-20">
      <SectionHeading
        eyebrow="هنرمندان ما"
        title="آرایشگران محبوب"
        action={<Link href="/stylists" className="hidden items-center gap-1 text-sm font-medium text-primary-700 sm:inline-flex">همه آرایشگران <ArrowLeftIcon size={16} /></Link>}
      />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stylists.map((s) => <li key={s.id}><StylistCard s={s} /></li>)}
      </ul>
    </section>
  );
}
