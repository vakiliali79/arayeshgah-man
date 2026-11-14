import { Alert } from "@/components/ui";

const WELCOME: Record<string, string> = {
  registered: "ثبت‌نام شما با موفقیت انجام شد و وارد حساب خود شدید.",
  login: "با موفقیت وارد شدید.",
};

/** پیام موفقیت ورود/ثبت‌نام (از پارامتر ?welcome=) */
export function WelcomeBanner({ welcome }: { welcome: unknown }) {
  const text = typeof welcome === "string" ? WELCOME[welcome] : undefined;
  return text ? <Alert tone="success" className="mb-6">{text}</Alert> : null;
}
