import { AppError, ValidationError } from "../errors";

/** وضعیت استاندارد فرم‌های Server Action */
export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const idleState: ActionState = { status: "idle" };

/** پیام فارسی برای کدهای خطای دامنه (هیچ جزئیات داخلی به کاربر نشان داده نمی‌شود) */
export const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "لطفاً مقادیر فرم را بررسی کنید.",
  UNAUTHORIZED: "برای این کار ابتدا وارد حساب خود شوید.",
  FORBIDDEN: "اجازه انجام این کار را ندارید.",
  NOT_FOUND: "مورد درخواستی پیدا نشد.",
  SLOT_TAKEN: "این زمان همین حالا رزرو شد. لطفاً زمان دیگری انتخاب کنید.",
  CUSTOMER_OVERLAP: "شما در این بازه زمانی نوبت فعال دیگری دارید.",
  INVALID_SLOT: "زمان انتخاب‌شده معتبر نیست.",
  TOO_SOON: "این زمان گذشته یا خیلی نزدیک است. زمان دیگری انتخاب کنید.",
  TOO_FAR: "امکان رزرو برای این تاریخ دور وجود ندارد.",
  SERVICE_NOT_OFFERED: "این آرایشگر این خدمت را ارائه نمی‌دهد.",
  SALON_MISMATCH: "این خدمت متعلق به سالن انتخاب‌شده نیست.",
  STYLIST_NOT_IN_SALON: "این آرایشگر عضو فعال این سالن نیست.",
  INDEPENDENT_NOT_ACCEPTED: "این آرایشگر نوبت مستقل نمی‌پذیرد.",
  SALON_CLOSED: "سالن در این زمان باز نیست.",
  STYLIST_UNAVAILABLE: "آرایشگر در این زمان در دسترس نیست.",
  TIME_OFF: "این زمان در روزهای تعطیل یا مرخصی است.",
  SELF_BOOKING: "نمی‌توانید برای خودتان نوبت بگیرید.",
  INVALID_TRANSITION: "این تغییر وضعیت برای این نوبت امکان‌پذیر نیست.",
  ALREADY_STARTED: "زمان این نوبت فرا رسیده است.",
  CANCEL_WINDOW_PASSED: "مهلت لغو این نوبت گذشته است (حداقل ۲ ساعت قبل از شروع).",
  NOT_STARTED: "زمان این نوبت هنوز فرا نرسیده است.",
  NOT_COMPLETED: "فقط برای نوبت‌های انجام‌شده می‌توان نظر ثبت کرد.",
  ALREADY_REVIEWED: "برای این نوبت قبلاً نظر ثبت کرده‌اید.",
  SLUG_TAKEN: "این نشانی صفحه قبلاً استفاده شده است.",
  ALREADY_MEMBER: "این کاربر قبلاً عضو یا دعوت‌شده این سالن است.",
  NOT_A_STYLIST: "فقط کاربران دارای پروفایل آرایشگر را می‌توان به‌عنوان آرایشگر افزود.",
  PHONE_TAKEN: "این شماره موبایل قبلاً ثبت شده است.",
  SHIFT_OVERLAP: "این بازه با شیفت دیگری در همان روز هم‌پوشانی دارد.",
  FILE_TOO_LARGE: "حجم فایل بیش از حد مجاز است (حداکثر ۵ مگابایت).",
  UNSUPPORTED_FILE_TYPE: "فقط تصاویر JPG، PNG و WebP پذیرفته می‌شوند.",
  MIME_MISMATCH: "نوع فایل معتبر نیست.",
  FILE_IN_USE: "ابتدا نمونه‌کار مرتبط با این تصویر را حذف کنید.",
  STYLIST_EXISTS: "پروفایل آرایشگر شما قبلاً ساخته شده است.",
  SUPER_ADMIN_PROTECTED: "نقش مدیر کل اصلی قابل تغییر نیست.",
  PROFILE_REQUIRED: "ابتدا پروفایل حرفه‌ای خود را تکمیل کنید.",
  USER_NOT_FOUND: "کاربری با این شماره موبایل پیدا نشد.",
  ALREADY_REQUESTED: "درخواست عضویت شما قبلاً ثبت شده است.",
};

const FIELD_INVALID = "مقدار این فیلد معتبر نیست.";

/** تبدیل هر خطا به وضعیت فرم (خطاهای ناشناخته لاگ می‌شوند و پیام عمومی نمایش داده می‌شود) */
export function toActionError(err: unknown): ActionState {
  if (err instanceof ValidationError) {
    const fieldErrors = Object.fromEntries(Object.keys(err.fieldErrors).map((k) => [k, FIELD_INVALID]));
    return { status: "error", message: ERROR_MESSAGES.VALIDATION_ERROR, fieldErrors };
  }
  if (err instanceof AppError) return { status: "error", message: ERROR_MESSAGES[err.code] ?? ERROR_MESSAGES.VALIDATION_ERROR };
  // redirect()/notFound() در Next با خطا پیاده شده‌اند و باید دوباره پرتاب شوند
  if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string") {
    const digest = (err as { digest: string }).digest;
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND") throw err;
  }
  console.error("[action] unexpected error", err instanceof Error ? err.name : "error");
  return { status: "error", message: "خطایی رخ داد. لطفاً دوباره تلاش کنید." };
}

/** اجرای امن یک عمل و برگرداندن پیام موفقیت */
export async function runAction(fn: () => Promise<unknown>, successMessage: string): Promise<ActionState> {
  try {
    await fn();
    return { status: "success", message: successMessage };
  } catch (err) {
    return toActionError(err);
  }
}

/** FormData → شیء ساده (رشته‌های خالی حذف می‌شوند) */
export function formObject(fd: FormData, numeric: string[] = [], booleans: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION")) continue;
    const value = v.trim();
    if (value === "") continue;
    out[k] = numeric.includes(k) ? Number(value.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))) : value;
  }
  for (const b of booleans) out[b] = fd.get(b) === "on" || fd.get(b) === "true";
  return out;
}
