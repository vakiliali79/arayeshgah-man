import type { OtpConfig } from "./config";

/**
 * قرارداد مستقل ارسال OTP.
 * برای افزودن سرویس پیامک (مثلاً کاوه‌نگار یا ملی‌پیامک) فقط یک کلاس با این interface
 * بنویسید و در createOtpSender ثبت کنید؛ منطق احراز هویت تغییری نمی‌کند.
 * کد OTP را هرگز لاگ نکنید.
 */
export interface OtpSender {
  readonly name: string;
  send(input: { phoneNumber: string; code: string }): Promise<void>;
}

/** حالت static: هیچ پیامکی ارسال نمی‌شود (کد ثابت توسط Better Auth بررسی می‌شود) */
export class NoopOtpSender implements OtpSender {
  readonly name = "none";
  async send(): Promise<void> {}
}

export class OtpDeliveryError extends Error {
  constructor(readonly provider: string) {
    super(`OTP delivery failed via ${provider}`);
    this.name = "OtpDeliveryError";
  }
}

export function createOtpSender(config: OtpConfig): OtpSender {
  if (config.mode === "static") return new NoopOtpSender();
  // نمونه برای آینده:
  //   case "kavenegar": return new KavenegarOtpSender({ apiKey: env.KAVENEGAR_API_KEY, template: … });
  throw new Error(`SMS provider "${config.provider}" is not implemented`);
}
