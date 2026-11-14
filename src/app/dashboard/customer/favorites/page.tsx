import type { Metadata } from "next";
import Link from "next/link";
import { HeartIcon } from "@/components/icons";
import { buttonVariants, EmptyState, PageHeader, Rating } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { toggleFavoriteAction } from "@/features/dashboard/actions/customer";
import { requireSession } from "@/server/auth/current";
import { listCustomerFavorites } from "@/server/customer/queries";

export const metadata: Metadata = { title: "علاقه‌مندی‌ها" };

export default async function FavoritesPage() {
  const { actor } = await requireSession();
  const fav = await listCustomerFavorites(db, actor);
  const empty = fav.salons.length === 0 && fav.stylists.length === 0;

  return (
    <>
      <PageHeader title="علاقه‌مندی‌ها" description="سالن‌ها و آرایشگرانی که نشان کرده‌اید" />
      {empty ? (
        <EmptyState
          icon={<HeartIcon />}
          title="هنوز چیزی نشان نکرده‌اید"
          description="در صفحه هر سالن یا آرایشگر، دکمه قلب را بزنید تا اینجا ذخیره شود."
          action={<Link href="/salons" className={buttonVariants({ size: "sm" })}>جستجوی سالن‌ها</Link>}
        />
      ) : (
        <div className="space-y-8">
          {[
            { title: "سالن‌ها", items: fav.salons.map((s) => ({ ...s, href: `/salons/${s.slug}`, sub: [s.city, s.district].filter(Boolean).join("، "), field: "salonId" })) },
            { title: "آرایشگران", items: fav.stylists.map((s) => ({ ...s, href: `/stylists/${s.slug}`, sub: s.specialties.join("، "), field: "stylistId" })) },
          ].map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.title} className="space-y-3">
                <h2 className="font-bold">{group.title}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {group.items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
                      <div className="min-w-0">
                        <Link href={it.href} className="font-bold hover:text-primary-700">{it.name}</Link>
                        <p className="truncate text-xs text-muted">{it.sub || "—"}</p>
                        <Rating value={it.ratingAvg} count={it.ratingCount} />
                      </div>
                      <ActionForm action={toggleFavoriteAction} submitLabel="حذف" submitVariant="ghost" submitSize="sm" inline hideMessage>
                        <input type="hidden" name={it.field} value={it.id} />
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </>
  );
}
