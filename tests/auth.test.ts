import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { profiles, sessions, users, verifications } from "@/db/schema";
import { createAuth, PLACEHOLDER_EMAIL_DOMAIN } from "@/server/auth/better-auth";
import { findAccountByPhone, requestOtp, verifyLoginOtp, verifyRegistrationOtp } from "@/server/auth/phone-auth";
import { getSessionContext } from "@/server/auth/session";
import { normalizeIranMobile } from "@/server/otp/phone";
import { BASE_URL, STATIC_OTP, TestBrowser, makeAuth, registerViaService, sessionCookieName } from "./helpers/auth";
import { closeTestDb, getTestDb, resetDb } from "./helpers/db";

const db = getTestDb();
const PHONE = "+989121234567";
const h = () => new Headers({ origin: BASE_URL });

afterAll(closeTestDb);

describe("phone OTP registration", () => {
  beforeEach(() => resetDb(db));

  it("registers with the correct OTP 1111: verified phone, chosen role, profile and a session", async () => {
    const auth = makeAuth(db);
    expect(await requestOtp(auth, db, { phone: PHONE, purpose: "register" }, h())).toEqual({ ok: true });
    const res = await verifyRegistrationOtp(auth, db, { phone: PHONE, code: STATIC_OTP, fullName: "سارا کریمی", role: "stylist" }, h());
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const [user] = await db.select().from(users).where(eq(users.id, res.userId));
    expect(user).toMatchObject({ phoneNumber: PHONE, phoneNumberVerified: true, name: "سارا کریمی" });
    expect(user!.email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)).toBe(true);
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, res.userId));
    expect(profile).toMatchObject({ role: "stylist", phone: "09121234567", fullName: "سارا کریمی" });

    // کاربر وارد شده است: کوکی امن و نشست معتبر
    const cookie = res.setCookie.find((c) => c.startsWith(`${sessionCookieName()}=`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const browser = new TestBrowser(auth);
    browser.absorb(res.setCookie);
    expect((await browser.session())?.user).toMatchObject({ phoneNumber: PHONE, phoneNumberVerified: true });
  });

  it("rejects a wrong OTP and creates no account", async () => {
    const auth = makeAuth(db);
    await requestOtp(auth, db, { phone: PHONE, purpose: "register" }, h());
    const res = await verifyRegistrationOtp(auth, db, { phone: PHONE, code: "2222", fullName: "x y z", role: "customer" }, h());
    expect(res).toEqual({ ok: false, reason: "invalid_code" });
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it("prevents registering the same number twice, in any format", async () => {
    const auth = makeAuth(db);
    expect((await registerViaService(auth, db, { phone: PHONE })).ok).toBe(true);
    for (const variant of ["09121234567", "۰۹۱۲۱۲۳۴۵۶۷", "+98 912 123 4567", "00989121234567", "9121234567"]) {
      const phone = normalizeIranMobile(variant)!;
      expect(phone).toBe(PHONE);
      expect(await requestOtp(auth, db, { phone, purpose: "register" }, h())).toEqual({ ok: false, reason: "already_registered" });
    }
    // و حتی اگر مرحله اول دور زده شود
    expect(await verifyRegistrationOtp(auth, db, { phone: PHONE, code: STATIC_OTP, fullName: "x y z", role: "customer" }, h())).toEqual({
      ok: false,
      reason: "already_registered",
    });
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("the database enforces one account per number and the canonical format", async () => {
    await db.insert(users).values({ name: "a", email: "a@x.test", phoneNumber: PHONE });
    await expect(db.insert(users).values({ name: "b", email: "b@x.test", phoneNumber: PHONE })).rejects.toThrow();
    await expect(db.insert(users).values({ name: "c", email: "c@x.test", phoneNumber: "09121234567" })).rejects.toThrow();
  });

  it("public registration can never create an admin", async () => {
    const auth = makeAuth(db);
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: PHONE }, headers: h() });
    // نوع ورودی admin را نمی‌پذیرد؛ حتی با دور زدن TypeScript نقش admin اعمال نمی‌شود
    const res = await verifyRegistrationOtp(auth, db, { phone: PHONE, code: STATIC_OTP, fullName: "مهاجم", role: "admin" as never }, h());
    const admins = await db.select().from(profiles).where(eq(profiles.role, "admin"));
    expect(admins).toHaveLength(0);
    if (res.ok) {
      const [p] = await db.select().from(profiles).where(eq(profiles.userId, res.userId));
      expect(p!.role).toBe("customer");
    }
  });

  it("a raw API verify for an unregistered number does not create an account", async () => {
    const auth = makeAuth(db);
    const browser = new TestBrowser(auth);
    const res = await browser.loginWithOtp(PHONE);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("ACCOUNT_NOT_FOUND");
    expect(await db.select().from(users)).toHaveLength(0);
    // ارسال نقش/نام در بدنه هم بی‌اثر است
    const res2 = await browser.post("/phone-number/verify", { phoneNumber: PHONE, code: STATIC_OTP, role: "admin", name: "x" });
    expect(res2.status).toBe(404);
    expect(await db.select().from(users)).toHaveLength(0);
  });
});

describe("phone OTP login", () => {
  beforeEach(() => resetDb(db));

  it("logs in an existing user with the correct OTP and keeps role and session", async () => {
    const auth = makeAuth(db);
    await registerViaService(auth, db, { phone: PHONE, role: "salon_owner", fullName: "مالک سالن" });
    await db.delete(sessions);

    expect(await requestOtp(auth, db, { phone: PHONE, purpose: "login" }, h())).toEqual({ ok: true });
    const res = await verifyLoginOtp(auth, db, { phone: PHONE, code: STATIC_OTP }, h());
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const browser = new TestBrowser(auth);
    browser.absorb(res.setCookie);
    const ctx = await getSessionContext(auth, db, new Headers({ cookie: browser.cookieHeader }));
    expect(ctx?.actor.role).toBe("salon_owner");
    expect(ctx?.profile.fullName).toBe("مالک سالن");
  });

  it("login over HTTP sets an httpOnly cookie; logout invalidates the session", async () => {
    const auth = makeAuth(db);
    await registerViaService(auth, db, { phone: PHONE });
    const browser = new TestBrowser(auth);
    const res = await browser.loginWithOtp(PHONE);
    expect(res.status).toBe(200);
    expect(browser.lastSetCookies.find((c) => c.startsWith(`${sessionCookieName()}=`))).toMatch(/HttpOnly/i);
    const stolen = browser.cookieHeader;
    expect(await browser.session()).not.toBeNull();

    expect((await browser.post("/sign-out")).status).toBe(200);
    expect(await browser.session()).toBeNull();
    expect(await auth.api.getSession({ headers: new Headers({ cookie: stolen }) })).toBeNull();
  });

  it("sessions persist in PostgreSQL across auth instances", async () => {
    const auth = makeAuth(db);
    await registerViaService(auth, db, { phone: PHONE });
    const browser = new TestBrowser(auth);
    await browser.loginWithOtp(PHONE);
    const restarted = makeAuth(db);
    expect((await restarted.api.getSession({ headers: new Headers({ cookie: browser.cookieHeader }) }))?.user.id).toBeDefined();
  });

  it("an unregistered number cannot log in", async () => {
    const auth = makeAuth(db);
    expect(await requestOtp(auth, db, { phone: PHONE, purpose: "login" }, h())).toEqual({ ok: false, reason: "not_registered" });
    expect(await verifyLoginOtp(auth, db, { phone: PHONE, code: STATIC_OTP }, h())).toEqual({ ok: false, reason: "not_registered" });
  });

  it("an existing (backfilled, unverified) number can log in and becomes verified", async () => {
    const auth = makeAuth(db);
    const [u] = await db.insert(users).values({ name: "قدیمی", email: "old@example.com", emailVerified: true, phoneNumber: PHONE, phoneNumberVerified: false }).returning();
    await db.insert(profiles).values({ userId: u!.id, role: "stylist", phone: "09121234567" });
    const browser = new TestBrowser(auth);
    expect((await browser.loginWithOtp(PHONE)).status).toBe(200);
    const [after] = await db.select().from(users).where(eq(users.id, u!.id));
    expect(after).toMatchObject({ phoneNumberVerified: true, email: "old@example.com" }); // ایمیل قبلی حفظ شد
    expect((await findAccountByPhone(db, PHONE))?.id).toBe(u!.id);
  });
});

describe("OTP security", () => {
  beforeEach(() => resetDb(db));

  it("rejects a wrong code and locks the code after 3 failed attempts", async () => {
    const auth = makeAuth(db);
    await registerViaService(auth, db, { phone: PHONE });
    const browser = new TestBrowser(auth);
    await browser.post("/phone-number/send-otp", { phoneNumber: PHONE });
    const codes: (string | undefined)[] = [];
    for (const code of ["0000", "1234", "9999"]) {
      const r = await browser.post("/phone-number/verify", { phoneNumber: PHONE, code });
      expect(r.status).toBe(400);
      codes.push(((await r.json()) as { code?: string }).code);
    }
    expect(codes).toEqual(["INVALID_OTP", "INVALID_OTP", "INVALID_OTP"]);
    // حتی کد صحیح پس از ۳ تلاش ناموفق پذیرفته نمی‌شود
    const locked = await browser.post("/phone-number/verify", { phoneNumber: PHONE, code: STATIC_OTP });
    expect(locked.status).toBe(403);
    expect(await browser.session()).toBeNull();
    // با درخواست کد جدید دوباره ممکن است
    expect((await browser.loginWithOtp(PHONE)).status).toBe(200);
  });

  it("an OTP is bound to the number it was requested for and is single-use", async () => {
    const auth = makeAuth(db);
    const OTHER = "+989351112233";
    await registerViaService(auth, db, { phone: PHONE });
    await registerViaService(auth, db, { phone: OTHER });
    const browser = new TestBrowser(auth);

    await browser.post("/phone-number/send-otp", { phoneNumber: PHONE });
    // کد برای شماره دیگری درخواست نشده است
    expect((await browser.post("/phone-number/verify", { phoneNumber: OTHER, code: STATIC_OTP })).status).toBe(400);
    expect((await browser.post("/phone-number/verify", { phoneNumber: PHONE, code: STATIC_OTP })).status).toBe(200);
    // یک‌بار مصرف
    expect((await new TestBrowser(auth).post("/phone-number/verify", { phoneNumber: PHONE, code: STATIC_OTP })).status).toBe(400);
  });

  it("an expired OTP is rejected", async () => {
    const auth = makeAuth(db);
    await registerViaService(auth, db, { phone: PHONE });
    const browser = new TestBrowser(auth);
    await browser.post("/phone-number/send-otp", { phoneNumber: PHONE });
    await db.update(verifications).set({ expiresAt: new Date(Date.now() - 1000) });
    const r = await browser.post("/phone-number/verify", { phoneNumber: PHONE, code: STATIC_OTP });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe("OTP_EXPIRED");
  });

  it("only canonical numbers are accepted by the API (no duplicate formats)", async () => {
    const auth = makeAuth(db);
    const r = await new TestBrowser(auth).post("/phone-number/send-otp", { phoneNumber: "09121234567" });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe("INVALID_PHONE_NUMBER");
  });

  it("rate-limits OTP requests and verification attempts per IP", async () => {
    const auth = makeAuth(db, { rateLimitEnabled: true });
    await registerViaService(auth, db, { phone: PHONE });
    const browser = new TestBrowser(auth, "198.51.100.9");
    const sends: number[] = [];
    for (let i = 0; i < 4; i++) sends.push((await browser.post("/phone-number/send-otp", { phoneNumber: PHONE })).status);
    expect(sends).toEqual([200, 200, 200, 429]);

    const verifier = new TestBrowser(auth, "198.51.100.10");
    const verifies: number[] = [];
    for (let i = 0; i < 11; i++) verifies.push((await verifier.post("/phone-number/verify", { phoneNumber: PHONE, code: "0000" })).status);
    expect(verifies.at(-1)).toBe(429);
  });

  it("never returns or logs the OTP code", async () => {
    const SECRET_CODE = "7391"; // کد متمایز برای تشخیص نشت
    const auth = makeAuth(db, { otp: { mode: "static", code: SECRET_CODE, allowedIps: null } });
    const lines: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lines.push(a.map((x) => (x instanceof Error ? x.message : JSON.stringify(x))).join(" "))),
    );
    await registerViaService(auth, db, { phone: PHONE, code: SECRET_CODE });
    const browser = new TestBrowser(auth);
    const send = await browser.post("/phone-number/send-otp", { phoneNumber: PHONE });
    const sendBody = await send.text();
    await browser.post("/phone-number/verify", { phoneNumber: PHONE, code: "0000" });
    spies.forEach((s) => s.mockRestore());

    expect(sendBody).toBe(JSON.stringify({ message: "code sent" }));
    expect(lines.join("\n")).not.toContain(SECRET_CODE);
  });

  it("email, password and profile-change endpoints are disabled", async () => {
    const auth = makeAuth(db);
    await registerViaService(auth, db, { phone: PHONE });
    const browser = new TestBrowser(auth);
    await browser.loginWithOtp(PHONE);
    for (const path of [
      "/sign-up/email",
      "/sign-in/email",
      "/send-verification-email",
      "/request-password-reset",
      "/reset-password",
      "/update-user",
      "/change-email",
      "/delete-user",
      "/sign-in/phone-number",
      "/phone-number/request-password-reset",
    ]) {
      const r = await browser.post(path, { email: "x@example.com", password: "Password123", phoneNumber: PHONE, name: "x", role: "admin" });
      expect([404, 400]).toContain(r.status);
      expect(r.status, path).not.toBe(200);
    }
    // تغییر شماره ورود از طریق API بسته است
    const change = await browser.post("/phone-number/verify", { phoneNumber: "+989350000000", code: STATIC_OTP, updatePhoneNumber: true });
    expect(change.status).toBe(403);
    const [p] = await db.select().from(profiles);
    expect(p!.role).toBe("customer");
  });
});

describe("static OTP in production", () => {
  afterAll(() => vi.unstubAllEnvs());

  it("is refused by default when NODE_ENV=production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_OTP_MODE", "static");
    vi.stubEnv("AUTH_STATIC_OTP", "1111");
    expect(() => createAuth(db, { secret: "x".repeat(40), baseURL: "https://example.test" })).toThrow(/not allowed in production/);
    vi.unstubAllEnvs();
  });

  it("when explicitly enabled, only accepts requests from allow-listed IPs (X-Real-IP)", async () => {
    await resetDb(db);
    const auth = makeAuth(db, { otp: { mode: "static", code: STATIC_OTP, allowedIps: ["10.8.0.2"] } });
    const outsider = new TestBrowser(auth, "203.0.113.50", { "x-real-ip": "203.0.113.50" });
    const r = await outsider.post("/phone-number/send-otp", { phoneNumber: PHONE });
    expect(r.status).toBe(403);
    // جعل X-Forwarded-For بی‌اثر است
    const spoofer = new TestBrowser(auth, "10.8.0.2");
    expect((await spoofer.post("/phone-number/send-otp", { phoneNumber: PHONE })).status).toBe(403);

    const insider = new TestBrowser(auth, "10.8.0.2", { "x-real-ip": "10.8.0.2" });
    expect((await insider.post("/phone-number/send-otp", { phoneNumber: PHONE })).status).toBe(200);
  });
});
