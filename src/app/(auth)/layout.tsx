import { ShieldIcon, SparkleIcon, StarIcon } from "@/components/icons";
import { Alert, Logo } from "@/components/ui";
import { isAuthTestMode, TEST_MODE_OTP } from "@/server/otp/config";
import { toPersianDigits } from "@/lib/utils";

const highlights = [
  { Icon: SparkleIcon, text: "سالن‌ها و آرایشگران تأییدشده در یک‌جا" },
  { Icon: StarIcon, text: "نظرات فقط از مشتریانی که نوبتشان انجام شده" },
  { Icon: ShieldIcon, text: "حفاظت کامل از اطلاعات شخصی شما" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const testMode = isAuthTestMode();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <main className="bg-luxe flex flex-col px-4 py-6 sm:px-8">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="animate-fade-up w-full max-w-md">
            {testMode && (
              <Alert tone="warning" className="mb-6">
                <strong>حالت تست — احراز هویت واقعی نیست.</strong> هیچ پیامکی ارسال نمی‌شود و کد ورود برای همه شماره‌ها{" "}
                <span dir="ltr" className="font-bold">
                  {toPersianDigits(TEST_MODE_OTP)}
                </span>{" "}
                است. از اطلاعات واقعی استفاده نکنید.
              </Alert>
            )}
            {children}
          </div>
        </div>
      </main>

      {/* پنل تزئینی — فقط دسکتاپ */}
      <aside className="relative hidden overflow-hidden bg-primary-900 p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -top-32 -start-32 size-[28rem] rounded-full bg-gold-400/25 blur-3xl" />
        <div className="absolute -bottom-40 -end-20 size-[30rem] rounded-full bg-primary-400/35 blur-3xl" />
        <div className="relative max-w-md space-y-8">
          <h2 className="text-3xl leading-[1.5] font-extrabold">
            لحظه‌ای برای خودتان،
            <br />
            <span className="text-gradient-gold">با اطمینان کامل</span>
          </h2>
          <ul className="space-y-4">
            {highlights.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-100">
                <span className="flex size-10 items-center justify-center rounded-md bg-white/10 text-gold-300 ring-1 ring-white/15">
                  <Icon size={20} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
