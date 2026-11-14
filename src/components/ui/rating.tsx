import { StarIcon } from "@/components/icons";
import { toPersianDigits } from "@/lib/utils";

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`امتیاز ${value} از ۵`}>
      <StarIcon size={16} className="text-gold-400" />
      <span className="font-semibold">{toPersianDigits(value.toFixed(1))}</span>
      {count !== undefined && <span className="text-muted">({toPersianDigits(count)})</span>}
    </span>
  );
}
