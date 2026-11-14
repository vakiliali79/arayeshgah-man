import Link from "next/link";
import { BriefcaseIcon } from "@/components/icons";
import { buttonVariants, EmptyState } from "@/components/ui";
import { db } from "@/db";
import { ContentHero } from "@/features/public/components/content-page";
import { pageMetadata } from "@/lib/seo";
import { getSetting } from "@/server/content/settings";

export const metadata = pageMetadata("فرصت‌های شغلی", "موقعیت‌های شغلی باز در تیم آرایشگاه من.", "/careers");

export default async function CareersPage() {
  const careers = await getSetting(db, "careers");
  const openings = careers?.openings ?? [];
  return (
    <>
      <ContentHero eyebrow="فرصت‌های شغلی" title="به تیم آرایشگاه من بپیوندید" description={careers?.intro || "ما به دنبال افرادی هستیم که به ساختن تجربه‌ای بهتر برای مشتریان و کسب‌وکارهای حوزه زیبایی علاقه دارند."} />
      <div className="container-page max-w-3xl py-10">
        {openings.length === 0 ? (
          <EmptyState icon={<BriefcaseIcon />} title="در حال حاضر موقعیت شغلی بازی نداریم" description="می‌توانید رزومه یا معرفی کوتاه خود را از طریق فرم تماس برای ما بفرستید." action={<Link href="/contact" className={buttonVariants({ size: "sm" })}>ارسال پیام</Link>} />
        ) : (
          <ul className="space-y-3">
            {openings.map((o, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface p-5">
                <h2 className="font-bold">{o.title}</h2>
                {o.type && <p className="mt-1 text-xs text-gold-600">{o.type}</p>}
                {o.description && <p className="mt-2 text-sm leading-7 text-muted">{o.description}</p>}
              </li>
            ))}
            <li className="pt-2"><Link href="/contact" className={buttonVariants()}>ارسال درخواست همکاری</Link></li>
          </ul>
        )}
      </div>
    </>
  );
}
