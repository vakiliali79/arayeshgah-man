import { StoreIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { db } from "@/db";
import { SalonCard } from "@/features/public/components/cards";
import { Pagination, SearchFilters } from "@/features/public/components/search-filters";
import { pageMetadata } from "@/lib/seo";
import { toPersianDigits } from "@/lib/utils";
import { listActiveCategories } from "@/server/catalog/categories";
import { PAGE_SIZE, parseSearchParams, searchSalons } from "@/server/public/search";

export const metadata = pageMetadata("جستجوی سالن‌های زیبایی", "جستجوی سالن‌های زیبایی بر اساس شهر، منطقه، خدمت، قیمت، امتیاز و نوبت آزاد.", "/salons");

export default async function SalonsSearchPage({ searchParams }: PageProps<"/salons">) {
  const raw = await searchParams;
  const p = parseSearchParams(raw);
  const [{ rows, total }, categories] = await Promise.all([searchSalons(db, p), listActiveCategories(db)]);
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="mb-1 text-2xl font-extrabold sm:text-3xl">سالن‌های زیبایی</h1>
      <p className="mb-6 text-sm text-muted">{total > 0 ? `${toPersianDigits(total)} سالن پیدا شد` : "سالنی با این مشخصات پیدا نشد"}</p>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <SearchFilters p={p} categories={categories} basePath="/salons" kind="salon" />
        <div>
          {rows.length === 0 ? (
            <EmptyState icon={<StoreIcon />} title="نتیجه‌ای پیدا نشد" description="فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map((s) => <li key={s.id}><SalonCard s={s} /></li>)}</ul>
          )}
          <Pagination total={total} page={p.page} pageSize={PAGE_SIZE} basePath="/salons" params={raw} />
        </div>
      </div>
    </div>
  );
}
