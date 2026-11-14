import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { profiles } from "@/db/schema";
import { safeRedirectPath } from "@/features/auth/redirect";
import { loginCodeSchema, registerCodeSchema, registerPhoneSchema } from "@/features/auth/schemas";
import { proxy } from "@/proxy";
import { getSessionContext, hasRole } from "@/server/auth/session";
import { adminSetUserRole } from "@/server/profiles/service";
import { FixedWindowRateLimiter, authRateLimits, clientIp, consumeAll, consumeOtpLimits } from "@/server/security/rate-limit";
import { TestBrowser, makeAuth, registerViaService } from "./helpers/auth";
import { closeTestDb, getTestDb, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);

describe("form schemas (server-side validation)", () => {
  const base = { fullName: "سارا کریمی", phone: "۰۹۱۲ ۱۲۳ ۴۵۶۷", terms: "on" };

  it("normalizes the mobile number and never accepts admin", () => {
    expect(registerPhoneSchema.parse({ ...base, role: "stylist" }).phone).toBe("+989121234567");
    expect(registerPhoneSchema.safeParse({ ...base, role: "admin" }).success).toBe(false);
    expect(registerCodeSchema.safeParse({ ...base, role: "admin", code: "1111" }).success).toBe(false);
    expect(registerPhoneSchema.safeParse({ ...base, role: "customer", terms: undefined }).success).toBe(false);
    expect(registerPhoneSchema.safeParse({ ...base, role: "customer", phone: "02122223333" }).success).toBe(false);
  });

  it("requires exactly 4 digits for the code (Persian digits allowed)", () => {
    expect(loginCodeSchema.parse({ phone: "09121234567", code: "۱۱۱۱" }).code).toBe("1111");
    for (const code of ["111", "11111", "abcd", ""]) expect(loginCodeSchema.safeParse({ phone: "09121234567", code }).success).toBe(false);
  });
});

describe("session context (server-side session + role)", () => {
  beforeEach(() => resetDb(db));

  it("returns null without a valid session", async () => {
    const auth = makeAuth(db);
    expect(await getSessionContext(auth, db, new Headers())).toBeNull();
    expect(await getSessionContext(auth, db, new Headers({ cookie: "arayeshgah.session_token=forged.value" }))).toBeNull();
  });

  it("reads the role from the database, so server-side role changes apply immediately", async () => {
    const auth = makeAuth(db);
    const res = await registerViaService(auth, db, { phone: "+989121234567", role: "customer" });
    if (!res.ok) throw new Error("registration failed");
    const browser = new TestBrowser(auth);
    browser.absorb(res.setCookie);
    const headers = new Headers({ cookie: browser.cookieHeader });

    const ctx = await getSessionContext(auth, db, headers);
    expect(ctx?.actor.role).toBe("customer");
    expect(ctx?.user.phoneNumber).toBe("+989121234567");
    expect(hasRole(ctx!, ["admin"])).toBe(false);

    const admin = await makeUser(db, "admin");
    await adminSetUserRole(db, admin, { userId: ctx!.user.id, role: "salon_owner" });
    expect((await getSessionContext(auth, db, headers))?.actor.role).toBe("salon_owner");
  });

  it("self-heals a missing profile as a customer", async () => {
    const auth = makeAuth(db);
    const res = await registerViaService(auth, db, { phone: "+989121234567", role: "stylist" });
    if (!res.ok) throw new Error("registration failed");
    await db.delete(profiles);
    const browser = new TestBrowser(auth);
    browser.absorb(res.setCookie);
    const ctx = await getSessionContext(auth, db, new Headers({ cookie: browser.cookieHeader }));
    expect(ctx?.profile.role).toBe("customer");
  });
});

describe("proxy (protected routes)", () => {
  it("redirects guests from /dashboard to /login with a safe next parameter", () => {
    const res = proxy(new NextRequest("http://localhost:3000/dashboard/salon?tab=1"));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/dashboard/salon?tab=1");
  });

  it("lets requests with a session cookie through (real validation happens in the page)", () => {
    expect(proxy(new NextRequest("http://localhost:3000/dashboard", { headers: { cookie: "arayeshgah.session_token=a.b" } })).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(new NextRequest("https://x.test/dashboard", { headers: { cookie: "__Secure-arayeshgah.session_token=a.b" } })).headers.get("x-middleware-next")).toBe("1");
  });

  it("only allows same-site relative redirect targets", () => {
    expect(safeRedirectPath("/dashboard/salon")).toBe("/dashboard/salon");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", 42]) {
      expect(safeRedirectPath(bad)).toBe("/dashboard");
    }
  });
});

describe("server-action rate limiter", () => {
  it("blocks after the limit within the window and resets afterwards", () => {
    const rl = new FixedWindowRateLimiter(3, 1000);
    const t = 1_000_000;
    expect([1, 2, 3].map(() => rl.consume("k", t).allowed)).toEqual([true, true, true]);
    expect(rl.consume("k", t + 10)).toMatchObject({ allowed: false });
    expect(rl.consume("k", t + 1001).allowed).toBe(true);
  });

  it("requires every key (IP and phone) to be within limits", () => {
    const rl = new FixedWindowRateLimiter(1, 60_000);
    expect(consumeAll(rl, ["ip:1", "phone:+989121234567"])).toBe(true);
    expect(consumeAll(rl, ["ip:2", "phone:+989121234567"])).toBe(false); // همان شماره از IP دیگر
  });

  it("OTP requests: strict per phone number, looser per IP (shared mobile IPs)", () => {
    Object.values(authRateLimits).forEach((l) => l.reset());
    const phone = "+989121234567";
    const results = Array.from({ length: 6 }, (_, i) => consumeOtpLimits("request", `10.0.0.${i}`, phone));
    expect(results).toEqual([true, true, true, true, true, false]); // ۶مین درخواست برای همان شماره
    Object.values(authRateLimits).forEach((l) => l.reset());
    const perIp = Array.from({ length: 21 }, (_, i) => consumeOtpLimits("request", "10.0.0.1", `+98912000${String(i).padStart(4, "0")}`));
    expect(perIp.filter(Boolean)).toHaveLength(20);
    expect(perIp.at(-1)).toBe(false);
  });

  it("extracts the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
