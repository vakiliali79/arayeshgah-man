import type { Database } from "@/db/client";
import type { SelfAssignableRole } from "@/config/roles";
import { createAuth, type Auth } from "@/server/auth/better-auth";
import { verifyRegistrationOtp } from "@/server/auth/phone-auth";
import type { OtpConfig } from "@/server/otp/config";

export const BASE_URL = "http://localhost:3000";
export const TEST_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
export const STATIC_OTP = "1111";
export const STATIC_OTP_CONFIG: OtpConfig = { mode: "static", code: STATIC_OTP, allowedIps: null };

export function makeAuth(db: Database, opts: { rateLimitEnabled?: boolean; baseURL?: string; otp?: OtpConfig } = {}) {
  return createAuth(db, {
    otp: opts.otp ?? STATIC_OTP_CONFIG,
    secret: TEST_SECRET,
    baseURL: opts.baseURL ?? BASE_URL,
    rateLimitEnabled: opts.rateLimitEnabled ?? false,
  });
}

/**
 * کلاینت HTTP آزمایشی که مستقیماً auth.handler را با Request واقعی صدا می‌زند
 * و کوکی‌ها را مثل مرورگر نگه می‌دارد.
 */
export class TestBrowser {
  readonly jar = new Map<string, string>();
  lastSetCookies: string[] = [];

  constructor(
    readonly auth: Auth,
    readonly ip = "203.0.113.10",
    readonly extraHeaders: Record<string, string> = {},
  ) {}

  get cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  headers(): Headers {
    const h = new Headers({ origin: BASE_URL, "x-forwarded-for": this.ip, ...this.extraHeaders });
    if (this.jar.size) h.set("cookie", this.cookieHeader);
    return h;
  }

  /** کوکی‌های Set-Cookie (مثلاً از خروجی سرویس) را در jar قرار می‌دهد */
  absorb(setCookies: string[]) {
    this.lastSetCookies = setCookies;
    for (const c of setCookies) {
      const [pair = ""] = c.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (!value || /max-age=0/i.test(c)) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  async request(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
    const headers = this.headers();
    if (body !== undefined) headers.set("content-type", "application/json");
    const res = await this.auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" }),
    );
    this.absorb(res.headers.getSetCookie());
    return res;
  }

  post(path: string, body: unknown = {}) {
    return this.request("POST", path, body);
  }

  get(path: string) {
    return this.request("GET", path);
  }

  async session(): Promise<{ user: { id: string; phoneNumber: string | null; phoneNumberVerified: boolean } } | null> {
    return (await (await this.get("/get-session")).json()) as never;
  }

  /** ورود کامل با OTP از طریق HTTP (ارسال کد + تأیید) */
  async loginWithOtp(phone: string, code = STATIC_OTP) {
    const send = await this.post("/phone-number/send-otp", { phoneNumber: phone });
    if (send.status !== 200) return send;
    return this.post("/phone-number/verify", { phoneNumber: phone, code });
  }
}

export const sessionCookieName = (secure = false) => `${secure ? "__Secure-" : ""}arayeshgah.session_token`;

/** ثبت‌نام کامل از مسیر سرویس برنامه (همان مسیری که Server Action استفاده می‌کند) */
export async function registerViaService(
  auth: Auth,
  db: Database,
  input: { phone: string; fullName?: string; role?: SelfAssignableRole; code?: string },
  headers = new Headers({ origin: BASE_URL }),
) {
  await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: input.phone }, headers });
  return verifyRegistrationOtp(
    auth,
    db,
    { phone: input.phone, code: input.code ?? STATIC_OTP, fullName: input.fullName ?? "کاربر تست", role: input.role ?? "customer" },
    headers,
  );
}
