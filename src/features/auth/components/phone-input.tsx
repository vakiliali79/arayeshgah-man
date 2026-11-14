import { Input, type InputProps } from "@/components/ui";

/** فیلد شماره موبایل (چپ‌چین، صفحه‌کلید عددی) */
export function PhoneInput(props: Omit<InputProps, "type" | "dir" | "inputMode">) {
  return <Input type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09121234567" maxLength={20} {...props} />;
}
