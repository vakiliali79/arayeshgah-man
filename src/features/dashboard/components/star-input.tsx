import { StarIcon } from "@/components/icons";

/** انتخاب امتیاز ۱ تا ۵ با رادیوهای بومی (بدون JS، دسترس‌پذیر) */
export function StarInput({ name = "rating", defaultValue = 5 }: { name?: string; defaultValue?: number }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">امتیاز شما</legend>
      <div dir="ltr" className="flex justify-end gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} defaultChecked={n === defaultValue} className="peer sr-only" />
            <span className="flex size-10 items-center justify-center rounded-md border border-border text-muted transition-colors peer-checked:border-gold-400 peer-checked:bg-gold-50 peer-checked:text-gold-500 peer-focus-visible:ring-4 peer-focus-visible:ring-primary-100">
              <StarIcon size={20} />
              <span className="sr-only">{n} ستاره</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
