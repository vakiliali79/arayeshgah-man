import Link from "next/link";
import { FilterIcon } from "@/components/icons";
import { Checkbox, FormField, Input, Select } from "@/components/ui";
import type { SearchParams } from "@/server/public/search";

/** فیلترهای جستجو (فرم GET؛ بدون JS کار می‌کند؛ در موبایل جمع‌شونده) */
export function SearchFilters({ p, categories, basePath, kind }: { p: SearchParams; categories: { key: string; label: string }[]; basePath: string; kind: "salon" | "stylist" }) {
  const body = (x: string) => (
    <form action={basePath} className="space-y-4" role="search">
      <FormField id={`${x}q`} label={kind === "salon" ? "نام سالن یا خدمت" : "نام آرایشگر"}><Input id={`${x}q`} name="q" defaultValue={p.q} maxLength={80} /></FormField>
      {kind === "stylist" && <FormField id={`${x}specialty`} label="تخصص"><Input id={`${x}specialty`} name="specialty" defaultValue={p.specialty} maxLength={40} placeholder="مثلاً رنگ مو" /></FormField>}
      <div className="grid grid-cols-2 gap-3">
        <FormField id={`${x}city`} label="شهر"><Input id={`${x}city`} name="city" defaultValue={p.city} maxLength={60} /></FormField>
        <FormField id={`${x}district`} label="منطقه"><Input id={`${x}district`} name="district" defaultValue={p.district} maxLength={60} /></FormField>
      </div>
      <FormField id={`${x}category`} label="نوع خدمت">
        <Select id={`${x}category`} name="category" defaultValue={p.category ?? ""}>
          <option value="">همه خدمات</option>
          {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField id={`${x}minPrice`} label="قیمت از (تومان)"><Input id={`${x}minPrice`} name="minPrice" type="number" dir="ltr" min={0} step={10000} defaultValue={p.minPrice} /></FormField>
        <FormField id={`${x}maxPrice`} label="قیمت تا (تومان)"><Input id={`${x}maxPrice`} name="maxPrice" type="number" dir="ltr" min={0} step={10000} defaultValue={p.maxPrice} /></FormField>
      </div>
      <FormField id={`${x}minRating`} label="حداقل امتیاز">
        <Select id={`${x}minRating`} name="minRating" defaultValue={p.minRating ? String(p.minRating) : ""}>
          <option value="">همه</option>
          {[4, 3, 2].map((r) => <option key={r} value={r}>{r.toLocaleString("fa-IR")} و بالاتر</option>)}
        </Select>
      </FormField>
      <Checkbox name="available" value="1" defaultChecked={p.available} label="فقط دارای نوبت آزاد در ۷ روز آینده" />
      <FormField id={`${x}sort`} label="مرتب‌سازی">
        <Select id={`${x}sort`} name="sort" defaultValue={p.sort}>
          <option value="popular">محبوب‌ترین</option>
          <option value="rating">بیشترین امتیاز</option>
          <option value="price_asc">ارزان‌ترین</option>
          <option value="price_desc">گران‌ترین</option>
        </Select>
      </FormField>
      <div className="flex gap-2">
        <button type="submit" className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-foreground">اعمال فیلترها</button>
        <Link href={basePath} className="flex h-11 items-center rounded-md border border-border px-4 text-sm hover:bg-surface-muted">حذف فیلترها</Link>
      </div>
    </form>
  );
  return (
    <>
      <details className="rounded-lg border border-border bg-surface p-4 lg:hidden">
        <summary className="flex cursor-pointer items-center gap-2 font-medium"><FilterIcon size={18} /> فیلتر و مرتب‌سازی</summary>
        <div className="mt-4">{body("m-")}</div>
      </details>
      <aside className="hidden h-fit rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-24 lg:block">{body("d-")}</aside>
    </>
  );
}

/** صفحه‌بندی با حفظ فیلترها */
export function Pagination({ total, page, pageSize, basePath, params }: { total: number; page: number; pageSize: number; basePath: string; params: Record<string, string | string[] | undefined> }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const href = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "page") q.set(k, v);
    q.set("page", String(n));
    return `${basePath}?${q}`;
  };
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="صفحه‌بندی">
      {page > 1 && <Link href={href(page - 1)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-muted">قبلی</Link>}
      <span className="px-3 text-sm text-muted">صفحه {page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}</span>
      {page < pages && <Link href={href(page + 1)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-muted">بعدی</Link>}
    </nav>
  );
}
