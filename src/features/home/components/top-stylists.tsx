import { Avatar, Rating, SectionHeading } from "@/components/ui";
import { toPersianDigits } from "@/lib/utils";
import { topStylists } from "../data";

export function TopStylists() {
  return (
    <section className="container-page pb-14 sm:pb-20">
      <SectionHeading eyebrow="هنرمندان ما" title="آرایشگران محبوب" />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {topStylists.map((s) => (
          <li key={s.id} className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-5 text-center">
            <Avatar name={s.name} className="size-16 text-lg" />
            <div>
              <h3 className="font-bold">{s.name}</h3>
              <p className="text-xs text-muted">{s.specialty}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <Rating value={s.rating} />
              <span>{toPersianDigits(s.jobs)} خدمت</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
