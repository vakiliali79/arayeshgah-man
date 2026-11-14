/**
 * محدودیت نرخ ساده (fixed window) در حافظه برای Server Actionها.
 * Better Auth محدودیت نرخ خودش را فقط روی درخواست‌های HTTP به /api/auth اعمال می‌کند؛
 * فراخوانی مستقیم auth.api از Server Action از آن عبور نمی‌کند، پس اینجا جداگانه محدود می‌شود.
 *
 * محدودیت: وضعیت در حافظه همان پردازش است. برای چند نمونه سرور باید ذخیره‌ساز مشترک
 * (PostgreSQL/Redis) جایگزین شود.
 */
export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  consume(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    if (this.hits.size > 10_000) this.sweep(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    entry.count += 1;
    return { allowed: entry.count <= this.limit, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  reset() {
    this.hits.clear();
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

/** IP کلاینت از هدرهای پروکسی معکوس (فقط پشت پروکسی مورد اعتماد معتبر است) */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * محدودیت جداگانه برای IP و شماره:
 * - به ازای شماره سخت‌گیرانه (جلوگیری از spam پیامک و حدس کد برای یک حساب)
 * - به ازای IP آسان‌تر، چون اپراتورهای موبایل کاربران زیادی را پشت یک IP مشترک (CGNAT) قرار می‌دهند
 */
export const authRateLimits = {
  otpRequestIp: new FixedWindowRateLimiter(20, 10 * 60_000),
  otpRequestPhone: new FixedWindowRateLimiter(5, 10 * 60_000),
  /** علاوه بر سقف ۳ تلاش Better Auth برای هر کد */
  otpVerifyIp: new FixedWindowRateLimiter(30, 10 * 60_000),
  otpVerifyPhone: new FixedWindowRateLimiter(10, 10 * 60_000),
};

/** مصرف هم‌زمان سهمیه IP و شماره؛ هر دو باید مجاز باشند */
export function consumeOtpLimits(kind: "request" | "verify", ip: string, phone: string): boolean {
  const ipOk = (kind === "request" ? authRateLimits.otpRequestIp : authRateLimits.otpVerifyIp).consume(`ip:${ip}`).allowed;
  const phoneOk = (kind === "request" ? authRateLimits.otpRequestPhone : authRateLimits.otpVerifyPhone).consume(`phone:${phone}`).allowed;
  return ipOk && phoneOk;
}

/** همه کلیدها (مثلاً IP و شماره) باید مجاز باشند */
export function consumeAll(limiter: FixedWindowRateLimiter, keys: string[]) {
  let allowed = true;
  for (const key of keys) if (!limiter.consume(key).allowed) allowed = false;
  return allowed;
}
