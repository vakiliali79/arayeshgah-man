import { SearchIcon } from "@/components/icons";
import { Input, Select } from "@/components/ui";

/** نوار جستجو/فیلتر مبتنی بر GET (بدون JS؛ نتایج در آدرس صفحه) */
export function FilterBar({ q, qPlaceholder, selects = [] }: { q?: string; qPlaceholder?: string; selects?: { name: string; value?: string; options: { value: string; label: string }[] }[] }) {
  return (
    <form className="mb-5 flex flex-wrap items-end gap-2" role="search">
      {qPlaceholder !== undefined && (
        <div className="min-w-48 flex-1">
          <Input name="q" defaultValue={q} placeholder={qPlaceholder} aria-label="جستجو" startIcon={<SearchIcon size={16} />} />
        </div>
      )}
      {selects.map((s) => (
        <Select key={s.name} name={s.name} defaultValue={s.value ?? ""} aria-label={s.name} className="w-auto min-w-36">
          {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ))}
      <button type="submit" className="h-12 rounded-md bg-primary px-5 text-sm text-primary-foreground">اعمال</button>
    </form>
  );
}
