import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { profiles, users } from "@/db/schema";
import { forgotPasswordSchema, registerSchema, resetPasswordSchema } from "@/features/auth/schemas";
import { safeRedirectPath } from "@/features/auth/redirect";
import { proxy } from "@/proxy";
import { registerUser, type RegistrationInput } from "@/server/auth/registration";
import { getSessionContext, hasRole } from "@/server/auth/session";
import { adminSetUserRole } from "@/server/profiles/service";
import { FixedWindowRateLimiter, clientIp, consumeAll } from "@/server/security/rate-limit";
import { TestBrowser, makeAuth } from "./helpers/auth";
import { closeTestDb, getTestDb, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);

const input = (over: Partial<RegistrationInput> = {}): RegistrationInput => ({
  fullName: "نگار احمدی",
  email: "negar@example.com",
  phone: "09121112233",
  password: "Password123",
  role: "stylist",
  ...over,
});
const noHeaders = () => new Headers({ origin: "http://localhost:3000" });

async function verifyAndLogin(auth: ReturnType<typeof makeAuth>["auth"], mailer: ReturnType<typeof makeAuth>["mailer"], email: string) {
  const browser = new TestBrowser(auth);
  const url = mailer.last("verification")!.text.match(/https?:\/\/\S+/)![0];
  await browser.get(url);
  expect(mailer.last("verification")!.to).toBe(email);
  return browser;
}

describe("registration service (server action backend)", () => {
  beforeEach(() => resetDb(db));

  it("creates the user and applies the chosen role and phone server-side", async () => {
    const { auth } = makeAuth(db);
    expect(await registerUser(auth, db, input(), noHeaders())).toEqual({ ok: true });
    const [row] = await db.select().from(profiles).innerJoin(users, eq(users.id, profiles.userId)).where(eq(users.email, "negar@example.com"));
    expect(row!.profiles).toMatchObject({ role: "stylist", phone: "09121112233", fullName: "نگار احمدی" });
    expect(row!.profiles.roleSelectedAt).toBeInstanceOf(Date);
  });

  it("a duplicate registration cannot change the existing account's role or phone", async () => {
    const { auth } = makeAuth(db);
    await registerUser(auth, db, input({ role: "customer", phone: "09120000000" }), noHeaders());
    // مهاجم با ایمیل قربانی و نقش salon_owner ثبت‌نام می‌کند
    const res = await registerUser(auth, db, input({ role: "salon_owner", phone: "09129999999", password: "Attacker123" }), noHeaders());
    expect(res).toEqual({ ok: true }); // همان پاسخ عمومی
    const rows = await db.select().from(profiles);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: "customer", phone: "09120000000" });
  });

  it("rejects a phone number that is already registered", async () => {
    const { auth } = makeAuth(db);
    await registerUser(auth, db, input(), noHeaders());
    expect(await registerUser(auth, db, input({ email: "other@example.com" }), noHeaders())).toEqual({ ok: false, reason: "phone_taken" });
  });

  it("the registration form schema never accepts admin and enforces the password policy", () => {
    const base = { fullName: "سارا کریمی", email: "s@example.com", phone: "۰۹۱۲۱۲۳۴۵۶۷", password: "Password123", terms: "on" };
    expect(registerSchema.safeParse({ ...base, role: "admin" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "salon_owner" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, role: "customer", password: "onlyletters" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "customer", terms: undefined }).success).toBe(false);
    expect(registerSchema.parse({ ...base, role: "customer" }).phone).toBe("09121234567");
  });

  it("reset-password schema requires matching passwords and a well-formed token", () => {
    const ok = { token: "abcdefghijklmnopqrstuvwx", password: "NewPass123", confirmPassword: "NewPass123" };
    expect(resetPasswordSchema.safeParse(ok).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ ...ok, confirmPassword: "Different1" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...ok, token: "../../etc" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("session context (server-side session + role)", () => {
  beforeEach(() => resetDb(db));

  it("returns null without a valid session", async () => {
    const { auth } = makeAuth(db);
    expect(await getSessionContext(auth, db, new Headers())).toBeNull();
    expect(await getSessionContext(auth, db, new Headers({ cookie: "arayeshgah.session_token=forged.value" }))).toBeNull();
  });

  it("reads the role from the database, so server-side role changes apply immediately", async () => {
    const { auth, mailer } = makeAuth(db);
    await registerUser(auth, db, input({ role: "customer" }), noHeaders());
    const browser = await verifyAndLogin(auth, mailer, "negar@example.com");
    const headers = new Headers({ cookie: browser.cookieHeader });

    const ctx = await getSessionContext(auth, db, headers);
    expect(ctx?.actor.role).toBe("customer");
    expect(hasRole(ctx!, ["admin"])).toBe(false);

    const admin = await makeUser(db, "admin");
    await adminSetUserRole(db, admin, { userId: ctx!.user.id, role: "salon_owner" });
    const after = await getSessionContext(auth, db, headers);
    expect(after?.actor.role).toBe("salon_owner");
    expect(hasRole(after!, ["salon_owner", "admin"])).toBe(true);
  });

  it("self-heals a missing profile as a customer", async () => {
    const { auth, mailer } = makeAuth(db);
    await registerUser(auth, db, input({ role: "stylist" }), noHeaders());
    const browser = await verifyAndLogin(auth, mailer, "negar@example.com");
    await db.delete(profiles);
    const ctx = await getSessionContext(auth, db, new Headers({ cookie: browser.cookieHeader }));
    expect(ctx?.profile.role).toBe("customer");
    expect(await db.select().from(profiles)).toHaveLength(1);
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
    const req = new NextRequest("http://localhost:3000/dashboard", { headers: { cookie: "arayeshgah.session_token=abc.def" } });
    expect(proxy(req).headers.get("x-middleware-next")).toBe("1");
    const secure = new NextRequest("https://example.test/dashboard", { headers: { cookie: "__Secure-arayeshgah.session_token=abc.def" } });
    expect(proxy(secure).headers.get("x-middleware-next")).toBe("1");
  });

  it("ignores public routes", () => {
    expect(proxy(new NextRequest("http://localhost:3000/")).headers.get("x-middleware-next")).toBe("1");
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

  it("requires every key (IP and email) to be within limits", () => {
    const rl = new FixedWindowRateLimiter(1, 60_000);
    expect(consumeAll(rl, ["ip:1", "email:a"])).toBe(true);
    expect(consumeAll(rl, ["ip:2", "email:a"])).toBe(false); // همان ایمیل از IP دیگر
  });

  it("extracts the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
