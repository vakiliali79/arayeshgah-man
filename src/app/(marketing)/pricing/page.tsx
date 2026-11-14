import Link from "next/link";
import { CheckIcon, GridIcon } from "@/components/icons";
import { Badge, buttonVariants, EmptyState } from "@/components/ui";
import { db } from "@/db";
import { ContentHero } from "@/features/public/components/content-page";
import { formatToman } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";
import { listPlans } from "@/server/admin/service";

export const metadata = pageMetadata("تعرفه‌ها", "تعرفه‌ها و پلن‌های آرایشگاه من برای سالن‌ها و آرایشگران.", "/pricing");

export default async function PricingPage() {
  const plans = await listPlans(db, true);
  const groups = [
    { key: "salon", title: "سالن‌ها", items: plans.filter((p) => p.audience === "salon") },
    { key: "stylist", title: "آرایشگران", items: plans.filter((p) => p.audience === "stylist") },
  ].filter((g) => g.items.length > 0);
  return (
    <>
      <ContentHero eyebrow="تعرفه‌ها" title="تعرفه‌ها و پلن‌ها" description="پلن مناسب کسب‌وکار خود را انتخاب کنید." />
      <div className="container-page py-10">
        {groups.length === 0 ? (
          <EmptyState icon={<GridIcon />} title="تعرفه‌ها هنوز منتشر نشده‌اند" description="برای اطلاع از شرایط همکاری با ما تماس بگیرید." action={<Link href="/contact" className={buttonVariants({ size: "sm" })}>تماس با ما</Link>} />
        ) : (
          groups.map((g) => (
            <section key={g.key} className="mb-10">
              <h2 className="mb-4 text-xl font-bold">{g.title}</h2>
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => (
                  <li key={p.id} className={`flex flex-col rounded-xl border bg-surface p-6 ${p.isFeatured ? "border-gold-400 shadow-gold" : "border-border"}`}>
                    <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{p.name}</h3>{p.isFeatured && <Badge tone="gold">پیشنهاد ویژه</Badge>}</div>
                    {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
                    <p className="my-5 text-2xl font-extrabold">{p.priceMonthlyToman ? <>{formatToman(p.priceMonthlyToman)}<span className="text-sm font-normal text-muted"> / ماه</span></> : "رایگان"}</p>
                    <ul className="flex-1 space-y-2 text-sm">{p.features.map((f) => <li key={f} className="flex items-start gap-2"><CheckIcon size={16} className="mt-1 text-success" />{f}</li>)}</ul>
                    <Link href={g.key === "salon" ? "/register-salon" : "/join-as-stylist"} className={buttonVariants({ variant: p.isFeatured ? "gold" : "outline", className: "mt-6" })}>شروع</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}
