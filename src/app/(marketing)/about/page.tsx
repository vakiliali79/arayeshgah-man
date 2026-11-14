import Link from "next/link";
import { buttonVariants } from "@/components/ui";
import { db } from "@/db";
import { ContentHero, Prose } from "@/features/public/components/content-page";
import { pageMetadata } from "@/lib/seo";
import { getSetting } from "@/server/content/settings";

export const metadata = pageMetadata("درباره ما", "آرایشگاه من؛ پلتفرم رزرو آنلاین و مدیریت خدمات زیبایی برای مشتریان، آرایشگران و سالن‌ها.", "/about");

const DEFAULT = [
  "آرایشگاه من پلتفرمی برای پیدا کردن سالن‌ها و آرایشگران و رزرو آنلاین خدمات زیبایی است. هدف ما ساده‌تر کردن یک تجربه روزمره است: دیدن خدمات، قیمت‌ها، نمونه‌کارها و نظرات واقعی، و انتخاب نوبت از میان زمان‌هایی که واقعاً آزاد هستند.",
  "برای سالن‌ها و آرایشگران، آرایشگاه من ابزاری برای مدیریت نوبت‌ها، برنامه کاری، خدمات، تیم و نظرات مشتریان است؛ تا وقت آن‌ها صرف کار اصلی‌شان شود، نه هماهنگی تلفنی.",
  "در آرایشگاه من نظرها فقط از مشتریانی ثبت می‌شود که نوبتشان انجام شده و سالن‌ها پیش از نمایش عمومی بررسی می‌شوند.",
];

export default async function AboutPage() {
  const about = await getSetting(db, "about");
  const paragraphs = about?.body?.trim() ? about.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : DEFAULT;
  return (
    <>
      <ContentHero eyebrow="درباره ما" title="زیبایی، بدون انتظار و هماهنگی‌های بی‌پایان" />
      <Prose>
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        <div className="flex flex-wrap gap-3 pt-4">
          <Link href="/salons" className={buttonVariants()}>جستجوی سالن‌ها</Link>
          <Link href="/businesses" className={buttonVariants({ variant: "outline" })}>ویژه کسب‌وکارها</Link>
        </div>
      </Prose>
    </>
  );
}
