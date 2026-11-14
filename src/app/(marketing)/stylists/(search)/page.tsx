import { ScissorsIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { db } from "@/db";
import { StylistCard } from "@/features/public/components/cards";
import { Pagination, SearchFilters } from "@/features/public/components/search-filters";
import { pageMetadata } from "@/lib/seo";
import { toPersianDigits } from "@/lib/utils";
import { listActiveCategories } from "@/server/catalog/categories";
import { PAGE_SIZE, parseSearchParams, searchStylists } from "@/server/public/search";

export const metadata = pageMetadata("جستجوی آرایشگران", "آرایشگران مستقل و عضو سالن‌ها را بر اساس تخصص، خدمت، قیمت، امتیاز و زمان آزاد پیدا کنید.", "/stylists");

export default async function StylistsSearchPage({ searchParams }: PageProps<"/stylists">) {
  const raw = await searchParams;
  const p = parseSearchParams(raw);
  const [{ rows, total }, categories] = await Promise.all([searchStylists(db, p), listActiveCategories(db)]);
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-extrabold sm:text-3xl">آرایشگران</h1>
      <p className="mb-6 text-sm text-muted">{total > 0 ? `${toPersianDigits(total)} آرایشگر پیدا شد` : "آرایشگری با این مشخصات پیدا نشد"}</p>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <SearchFilters p={p} categories={categories} basePath="/stylists" kind="stylist" />
        <div>
          {rows.length === 0 ? (
            <EmptyState icon={<ScissorsIcon />} title="نتیجه‌ای پیدا نشد" description="فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید." />
          ) : (
            <ul className="grid grid-cols-2 gap-4 xl:grid-cols-3">{rows.map((s) => <li key={s.id}><StylistCard s={s} /></li>)}</ul>
          )}
          <Pagination total={total} page={p.page} pageSize={PAGE_SIZE} basePath="/stylists" params={raw} />
        </div>
      </div>
    </div>
  );
}
