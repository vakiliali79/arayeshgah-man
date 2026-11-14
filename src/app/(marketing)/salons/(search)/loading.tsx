/** حالت بارگذاری نتایج جستجو */
export default function Loading() {
  return (
    <div className="container-page py-10" aria-busy="true" aria-label="در حال بارگذاری">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-md bg-surface-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-lg bg-surface-muted" />)}
      </div>
    </div>
  );
}
