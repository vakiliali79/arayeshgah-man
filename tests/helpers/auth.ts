import type { Database } from "@/db/client";
import { createAuth, type Auth } from "@/server/auth/better-auth";
import { MemoryMailer } from "@/server/mail/mailer";

export const BASE_URL = "http://localhost:3000";
export const TEST_SECRET = "test-secret-0123456789abcdef0123456789abcdef";

export function makeAuth(db: Database, opts: { rateLimitEnabled?: boolean; baseURL?: string } = {}) {
  const mailer = new MemoryMailer();
  const auth = createAuth(db, {
    mailer,
    secret: TEST_SECRET,
    baseURL: opts.baseURL ?? BASE_URL,
    rateLimitEnabled: opts.rateLimitEnabled ?? false,
  });
  return { auth, mailer };
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
  ) {}

  get cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  headers(): Headers {
    const h = new Headers({ origin: BASE_URL, "x-forwarded-for": this.ip });
    if (this.jar.size) h.set("cookie", this.cookieHeader);
    return h;
  }

  async request(method: "GET" | "POST", pathOrUrl: string, body?: unknown): Promise<Response> {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE_URL}/api/auth${pathOrUrl}`;
    const headers = this.headers();
    if (body !== undefined) headers.set("content-type", "application/json");
    const res = await this.auth.handler(
      new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" }),
    );
    this.lastSetCookies = res.headers.getSetCookie();
    for (const c of this.lastSetCookies) {
      const [pair = ""] = c.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (!value || /max-age=0/i.test(c)) this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return res;
  }

  post(path: string, body: unknown = {}) {
    return this.request("POST", path, body);
  }

  get(pathOrUrl: string) {
    return this.request("GET", pathOrUrl);
  }

  async session(): Promise<{ user: { id: string; email: string } } | null> {
    const res = await this.get("/get-session");
    return (await res.json()) as { user: { id: string; email: string } } | null;
  }
}

export const sessionCookieName = (secure = false) => `${secure ? "__Secure-" : ""}arayeshgah.session_token`;
