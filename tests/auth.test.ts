import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { profiles, sessions, users } from "@/db/schema";
import { createAuth } from "@/server/auth/better-auth";
import { MemoryMailer } from "@/server/mail/mailer";
import { BASE_URL, TestBrowser, makeAuth, sessionCookieName } from "./helpers/auth";
import { closeTestDb, getTestDb, resetDb } from "./helpers/db";

const db = getTestDb();
const PASSWORD = "Password123";

afterAll(closeTestDb);

/** ثبت‌نام + تأیید ایمیل از طریق لینک ارسالی */
async function registerAndVerify(browser: TestBrowser, mailer: MemoryMailer, email: string, name = "کاربر تست") {
  const res = await browser.post("/sign-up/email", { name, email, password: PASSWORD, callbackURL: "/verify-email" });
  expect(res.status).toBe(200);
  const mail = mailer.last("verification");
  expect(mail?.to).toBe(email);
  const url = mail!.text.match(/https?:\/\/\S+/)![0];
  const verify = await browser.get(url);
  expect(verify.status).toBe(302);
  expect(verify.headers.get("location")).toBe("/verify-email");
  return url;
}

describe("Better Auth — email & password", () => {
  beforeEach(() => resetDb(db));

  it("registration creates the user, a customer profile, sends a verification email and no session", async () => {
    const { auth, mailer } = makeAuth(db);
    const browser = new TestBrowser(auth);
    const res = await browser.post("/sign-up/email", { name: "سارا", email: "Sara@Example.com", password: PASSWORD });
    expect(res.status).toBe(200);

    const [user] = await db.select().from(users).where(eq(users.email, "sara@example.com"));
    expect(user).toMatchObject({ name: "سارا", emailVerified: false });
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user!.id));
    expect(profile).toMatchObject({ role: "customer", fullName: "سارا" });

    expect(mailer.last("verification")?.to).toBe("sara@example.com");
    expect(browser.jar.has(sessionCookieName())).toBe(false); // requireEmailVerification
    expect(await browser.session()).toBeNull();
  });

  it("duplicate registration returns the same generic response, creates nothing and sends no email", async () => {
    const { auth, mailer } = makeAuth(db);
    const first = await new TestBrowser(auth).post("/sign-up/email", { name: "الف", email: "dup@example.com", password: PASSWORD });
    const sentBefore = mailer.sent.length;
    const second = await new TestBrowser(auth).post("/sign-up/email", { name: "ب", email: "dup@example.com", password: "Another123" });
    expect(second.status).toBe(first.status);
    expect(Object.keys((await second.json()) as object).sort()).toEqual(["token", "user"]);
    expect(await db.select().from(users).where(eq(users.email, "dup@example.com"))).toHaveLength(1);
    expect(mailer.sent.length).toBe(sentBefore);
  });

  it("login is refused until the email is verified", async () => {
    const { auth } = makeAuth(db);
    const browser = new TestBrowser(auth);
    await browser.post("/sign-up/email", { name: "x", email: "unverified@example.com", password: PASSWORD });
    const res = await browser.post("/sign-in/email", { email: "unverified@example.com", password: PASSWORD });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("email verification marks the user verified and signs them in", async () => {
    const { auth, mailer } = makeAuth(db);
    const browser = new TestBrowser(auth);
    await registerAndVerify(browser, mailer, "verify@example.com");
    const [user] = await db.select().from(users).where(eq(users.email, "verify@example.com"));
    expect(user!.emailVerified).toBe(true);
    expect((await browser.session())?.user.email).toBe("verify@example.com");
  });

  it("an invalid verification token redirects back with an error code", async () => {
    const { auth } = makeAuth(db);
    const res = await new TestBrowser(auth).get(`${BASE_URL}/api/auth/verify-email?token=bogus&callbackURL=%2Fverify-email`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^\/verify-email\?error=/);
  });

  it("successful login sets an httpOnly, SameSite=Lax session cookie", async () => {
    const { auth, mailer } = makeAuth(db);
    await registerAndVerify(new TestBrowser(auth), mailer, "login@example.com");
    const browser = new TestBrowser(auth);
    const res = await browser.post("/sign-in/email", { email: "login@example.com", password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = browser.lastSetCookies.find((c) => c.startsWith(`${sessionCookieName()}=`));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect((await browser.session())?.user.email).toBe("login@example.com");
  });

  it("invalid credentials: wrong password and unknown email are indistinguishable", async () => {
    const { auth, mailer } = makeAuth(db);
    await registerAndVerify(new TestBrowser(auth), mailer, "real@example.com");
    const wrong = await new TestBrowser(auth).post("/sign-in/email", { email: "real@example.com", password: "Wrong12345" });
    const unknown = await new TestBrowser(auth).post("/sign-in/email", { email: "nobody@example.com", password: "Wrong12345" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(((await wrong.json()) as { code: string }).code).toBe(((await unknown.json()) as { code: string }).code);
  });

  it("logout deletes the session server-side and clears the cookie", async () => {
    const { auth, mailer } = makeAuth(db);
    const browser = new TestBrowser(auth);
    await registerAndVerify(browser, mailer, "logout@example.com");
    const stolenCookie = browser.cookieHeader;
    const res = await browser.post("/sign-out");
    expect(res.status).toBe(200);
    expect(browser.jar.has(sessionCookieName())).toBe(false);
    expect(await browser.session()).toBeNull();
    // کوکی کپی‌شده قبلی هم دیگر معتبر نیست
    const replay = await auth.api.getSession({ headers: new Headers({ cookie: stolenCookie }) });
    expect(replay).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("sessions persist in PostgreSQL across auth instances (e.g. server restart)", async () => {
    const { auth, mailer } = makeAuth(db);
    const browser = new TestBrowser(auth);
    await registerAndVerify(browser, mailer, "persist@example.com");
    const { auth: restarted } = makeAuth(db);
    const res = await restarted.api.getSession({ headers: new Headers({ cookie: browser.cookieHeader }) });
    expect(res?.user.email).toBe("persist@example.com");
    expect(await db.select().from(sessions)).toHaveLength(1);
  });

  it("a forged or tampered session cookie is rejected", async () => {
    const { auth, mailer } = makeAuth(db);
    const browser = new TestBrowser(auth);
    await registerAndVerify(browser, mailer, "tamper@example.com");
    const value = browser.jar.get(sessionCookieName())!;
    const tampered = `${sessionCookieName()}=${value.slice(0, -4)}AAAA`;
    expect(await auth.api.getSession({ headers: new Headers({ cookie: tampered }) })).toBeNull();
  });

  it("password reset: generic response, single-use token, old password and sessions revoked", async () => {
    const { auth, mailer } = makeAuth(db);
    const owner = new TestBrowser(auth);
    await registerAndVerify(owner, mailer, "reset@example.com");
    expect(await owner.session()).not.toBeNull();

    // درخواست برای ایمیل ناموجود همان پاسخ را می‌گیرد و ایمیلی ارسال نمی‌شود
    const before = mailer.sent.length;
    const unknown = await new TestBrowser(auth).post("/request-password-reset", { email: "ghost@example.com", redirectTo: "/reset-password" });
    expect(unknown.status).toBe(200);
    expect(mailer.sent.length).toBe(before);

    const anon = new TestBrowser(auth);
    const req = await anon.post("/request-password-reset", { email: "reset@example.com", redirectTo: "/reset-password" });
    expect(req.status).toBe(200);
    const link = mailer.last("password-reset")!.text.match(/https?:\/\/\S+/)![0];

    const landing = await anon.get(link);
    expect(landing.status).toBe(302);
    const location = new URL(landing.headers.get("location")!, BASE_URL);
    expect(location.pathname).toBe("/reset-password");
    const token = location.searchParams.get("token")!;
    expect(token).toBeTruthy();

    const reset = await anon.post("/reset-password", { token, newPassword: "NewPassword456" });
    expect(reset.status).toBe(200);
    // توکن یک‌بار مصرف
    expect((await anon.post("/reset-password", { token, newPassword: "Another789" })).status).toBe(400);
    // نشست قبلی باطل شد
    expect(await owner.session()).toBeNull();
    // رمز قدیم کار نمی‌کند، رمز جدید کار می‌کند
    expect((await new TestBrowser(auth).post("/sign-in/email", { email: "reset@example.com", password: PASSWORD })).status).toBe(401);
    expect((await new TestBrowser(auth).post("/sign-in/email", { email: "reset@example.com", password: "NewPassword456" })).status).toBe(200);
  });

  it("rejects a password shorter than the minimum", async () => {
    const { auth } = makeAuth(db);
    const res = await new TestBrowser(auth).post("/sign-up/email", { name: "x", email: "short@example.com", password: "abc1" });
    expect(res.status).toBe(400);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it("rate-limits repeated sign-in attempts from one IP", async () => {
    const { auth } = makeAuth(db, { rateLimitEnabled: true });
    const browser = new TestBrowser(auth, "198.51.100.7");
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await browser.post("/sign-in/email", { email: "a@example.com", password: "Wrong12345" })).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("Better Auth — role & privilege escalation", () => {
  beforeEach(() => resetDb(db));

  it("a role submitted to the public sign-up endpoint is ignored", async () => {
    const { auth } = makeAuth(db);
    const res = await new TestBrowser(auth).post("/sign-up/email", { name: "x", email: "evil@example.com", password: PASSWORD, role: "admin" });
    expect(res.status).toBe(200);
    const [user] = await db.select().from(users).where(eq(users.email, "evil@example.com"));
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user!.id));
    expect(profile!.role).toBe("customer");
  });

  it("user-update, change-email and delete-user endpoints are disabled", async () => {
    const { auth, mailer } = makeAuth(db);
    const browser = new TestBrowser(auth);
    await registerAndVerify(browser, mailer, "upd@example.com");
    for (const path of ["/update-user", "/change-email", "/delete-user"]) {
      const res = await browser.post(path, { name: "hacked", role: "admin", newEmail: "x@example.com" });
      expect(res.status).toBe(404);
    }
    const [profile] = await db.select().from(profiles).innerJoin(users, eq(users.id, profiles.userId)).where(eq(users.email, "upd@example.com"));
    expect(profile!.profiles.role).toBe("customer");
    expect(profile!.users.name).toBe("کاربر تست");
  });
});

describe("Better Auth — production hardening", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to start in production without a strong secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => createAuth(db, { mailer: new MemoryMailer(), secret: "short", baseURL: "https://example.test" })).toThrow(/BETTER_AUTH_SECRET/);
    vi.unstubAllEnvs();
  });

  it("uses __Secure- prefixed Secure cookies in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await resetDb(db);
    const mailer = new MemoryMailer();
    const auth = createAuth(db, { mailer, secret: "x".repeat(40), baseURL: "https://example.test", rateLimitEnabled: false });
    vi.unstubAllEnvs();
    const res = await auth.handler(
      new Request("https://example.test/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://example.test" },
        body: JSON.stringify({ name: "x", email: "secure@example.com", password: PASSWORD }),
      }),
    );
    expect(res.status).toBe(200);
    const url = mailer.last("verification")!.text.match(/https?:\/\/\S+/)![0];
    const verify = await auth.handler(new Request(url, { headers: { origin: "https://example.test" }, redirect: "manual" }));
    const cookie = verify.headers.getSetCookie().find((c) => c.startsWith(`${sessionCookieName(true)}=`));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });
});
