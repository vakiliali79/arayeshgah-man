import { ContentHero, Prose } from "@/features/public/components/content-page";
import { OnboardingCta } from "@/features/public/components/onboarding-cta";
import { pageMetadata } from "@/lib/seo";
import { getCurrentSession } from "@/server/auth/current";

export const metadata = pageMetadata("ثبت سالن", "سالن خود را در آرایشگاه من ثبت کنید و نوبت آنلاین بگیرید.", "/register-salon");

export default async function RegisterSalonPage() {
  const session = await getCurrentSession();
  return (
    <>
      <ContentHero eyebrow="ثبت سالن" title="سالن خود را در آرایشگاه من ثبت کنید" description="در چند مرحله صفحه سالن خود را بسازید و نوبت‌های آنلاین را مدیریت کنید." />
      <Prose>
        <h2>مراحل ثبت</h2>
        <ul>
          <li>با شماره موبایل و نوع حساب «صاحب سالن» ثبت‌نام کنید.</li>
          <li>از داشبورد، اطلاعات سالن (نام، نشانی، تلفن، موقعیت) را ثبت کنید.</li>
          <li>خدمات و قیمت‌ها، ساعات کاری و تصاویر سالن را اضافه کنید.</li>
          <li>آرایشگران را با شماره موبایلشان به تیم دعوت کنید یا درخواست همکاری آن‌ها را بپذیرید.</li>
          <li>پس از بررسی و تأیید مدیریت، سالن شما در جستجوی آرایشگاه من نمایش داده می‌شود.</li>
        </ul>
        <div className="pt-4">
          <OnboardingCta role={session?.profile.role ?? null} target="salon_owner" registerRole="salon_owner" dashboardHref="/dashboard/salon" label="ثبت‌نام و ثبت سالن" />
        </div>
      </Prose>
    </>
  );
}
