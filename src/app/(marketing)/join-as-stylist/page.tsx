import { ContentHero, Prose } from "@/features/public/components/content-page";
import { OnboardingCta } from "@/features/public/components/onboarding-cta";
import { pageMetadata } from "@/lib/seo";
import { getCurrentSession } from "@/server/auth/current";

export const metadata = pageMetadata("همکاری آرایشگران", "به‌عنوان آرایشگر مستقل یا عضو سالن در آرایشگاه من نوبت بگیرید.", "/join-as-stylist");

export default async function JoinAsStylistPage() {
  const session = await getCurrentSession();
  return (
    <>
      <ContentHero eyebrow="همکاری آرایشگران" title="مهارت خود را به مشتریان بیشتری معرفی کنید" description="مستقل کار کنید یا در یک یا چند سالن عضو شوید؛ نوبت‌ها، برنامه کاری و نمونه‌کارهایتان را از یک‌جا مدیریت کنید." />
      <Prose>
        <h2>چگونه شروع کنم؟</h2>
        <ul>
          <li>با شماره موبایل و نوع حساب «آرایشگر» ثبت‌نام کنید.</li>
          <li>پروفایل حرفه‌ای خود (تخصص‌ها، سابقه، معرفی و تصویر) را بسازید.</li>
          <li>برای کار مستقل، خدمات و ساعات کاری خود را تعریف کنید.</li>
          <li>برای همکاری با سالن، با نشانی صفحه سالن درخواست عضویت بدهید یا دعوت سالن را بپذیرید.</li>
          <li>نمونه‌کارهای خود را اضافه کنید تا در صفحه عمومی‌تان نمایش داده شود.</li>
        </ul>
        <div className="pt-4">
          <OnboardingCta role={session?.profile.role ?? null} target="stylist" registerRole="stylist" dashboardHref="/dashboard/stylist" label="ثبت‌نام به‌عنوان آرایشگر" />
        </div>
      </Prose>
    </>
  );
}
