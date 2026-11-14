import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { Input, Select } from "@/components/ui";

type SelectSpec = { name: string; label?: string; value?: string; options: { value: string; label: string }[] };

/** نوار جستجو/فیلتر مبتنی بر GET (بدون JS؛ نتایج در آدرس صفحه) */
export function FilterBar({
  q,
  qPlaceholder,
  selects = [],
  dates,
  dateLabel = "تاریخ",
  hidden = {},
  resetHref,
}: {
  q?: string;
  qPlaceholder?: string;
  selects?: SelectSpec[];
  /** فیلتر بازه تاریخ (YYYY-MM-DD) */
  dates?: { from?: string; to?: string };
  dateLabel?: string;
  hidden?: Record<string, string | undefined>;
  resetHref?: string;
}) {
  return (
    <form className="mb-5 flex flex-wrap items-end gap-2" role="search">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {qPlaceholder !== undefined && (
        <div className="min-w-48 flex-1">
          <Input name="q" defaultValue={q} placeholder={qPlaceholder} aria-label="جستجو" startIcon={<SearchIcon size={16} />} />
        </div>
      )}
      {selects.map((s) => (
        <Select key={s.name} name={s.name} defaultValue={s.value ?? ""} aria-label={s.label ?? s.name} className="w-auto min-w-36">
          {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ))}
      {dates && (
        <>
          <label className="flex flex-col text-xs text-muted">
            {dateLabel} از (میلادی)
            <Input type="date" name="from" defaultValue={dates.from} dir="ltr" className="h-12 w-40" />
          </label>
          <label className="flex flex-col text-xs text-muted">
            تا
            <Input type="date" name="to" defaultValue={dates.to} dir="ltr" className="h-12 w-40" />
          </label>
        </>
      )}
      <button type="submit" className="h-12 rounded-md bg-primary px-5 text-sm text-primary-foreground">اعمال</button>
      {resetHref && <Link href={resetHref} className="flex h-12 items-center rounded-md border border-border px-4 text-sm hover:bg-surface-muted">حذف فیلترها</Link>}
    </form>
  );
}

/** مقدار رشته‌ای پارامتر آدرس */
export const param = (sp: Record<string, string | string[] | undefined>, k: string) => {
  const v = sp[k];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};
