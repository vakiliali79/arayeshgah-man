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

export const authRateLimits = {
  signIn: new FixedWindowRateLimiter(5, 60_000),
  signUp: new FixedWindowRateLimiter(5, 5 * 60_000),
  passwordReset: new FixedWindowRateLimiter(3, 5 * 60_000),
  resendVerification: new FixedWindowRateLimiter(3, 5 * 60_000),
};

/** هر دو کلید (IP و ایمیل) باید مجاز باشند */
export function consumeAll(limiter: FixedWindowRateLimiter, keys: string[]) {
  let allowed = true;
  for (const key of keys) if (!limiter.consume(key).allowed) allowed = false;
  return allowed;
}
