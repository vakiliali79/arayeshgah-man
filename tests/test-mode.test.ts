import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bookings, profiles, users } from "@/db/schema";
import { requestOtp, verifyLoginOtp } from "@/server/auth/phone-auth";
import { getSessionContext } from "@/server/auth/session";
import { isAuthTestMode, OtpConfigError, resolveOtpConfig, TEST_MODE_ADMIN_PHONE, type OtpConfig } from "@/server/otp/config";
import { normalizeIranMobile } from "@/server/otp/phone";
import { createBooking } from "@/server/bookings/service";
import { BASE_URL, STATIC_OTP_CONFIG, TestBrowser, makeAuth, registerViaService } from "./helpers/auth";
import { SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
const TEST_MODE = resolveOtpConfig({ AUTH_TEST_MODE: "true", NODE_ENV: "test" } as unknown as NodeJS.ProcessEnv);
const h = () => new Headers({ origin: BASE_URL });
const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

afterAll(closeTestDb);

/** ورود کامل از مسیر سرویس (همان مسیر Server Action) و برگرداندن نقش از نشست */
async function loginAndGetRole(auth: ReturnType<typeof makeAuth>, phone: string, code = "1111") {
  const req = await requestOtp(auth, db, { phone, purpose: "login" }, h());
  if (!req.ok) return { ok: false as const, reason: req.reason };
  const res = await verifyLoginOtp(auth, db, { phone, code }, h());
  if (!res.ok) return { ok: false as const, reason: res.reason };
  const browser = new TestBrowser(auth);
  browser.absorb(res.setCookie);
  const ctx = await getSessionContext(auth, db, new Headers({ cookie: browser.cookieHeader }));
  return { ok: true as const, role: ctx?.actor.role, userId: res.userId };
}

describe("AUTH_TEST_MODE configuration", () => {
  it("is off unless explicitly set to true", () => {
    expect(isAuthTestMode(env({}))).toBe(false);
    expect(isAuthTestMode(env({ AUTH_TEST_MODE: "false" }))).toBe(false);
    expect(isAuthTestMode(env({ AUTH_TEST_MODE: "true" }))).toBe(true);
    expect(isAuthTestMode(env({ AUTH_TEST_MODE: "TRUE" }))).toBe(true);
    for (const v of ["1", "yes", "on"]) expect(() => isAuthTestMode(env({ AUTH_TEST_MODE: v }))).toThrow(OtpConfigError);
  });

  it("uses code 1111 with no IP restriction — also in production", () => {
    const cfg = resolveOtpConfig(env({ NODE_ENV: "production", AUTH_TEST_MODE: "true" }));
    expect(cfg).toEqual({ mode: "static", code: "1111", allowedIps: null, testMode: { adminPhone: "+989991797982" } });
    expect(normalizeIranMobile("09991797982")).toBe(TEST_MODE_ADMIN_PHONE);
  });

  it("when off, previous behaviour is unchanged (static still refused in production, IP allow-list still required)", () => {
    expect(() => resolveOtpConfig(env({ NODE_ENV: "production", AUTH_OTP_MODE: "static", AUTH_STATIC_OTP: "1111" }))).toThrow(/not allowed in production/);
    expect(() => resolveOtpConfig(env({ NODE_ENV: "production", AUTH_TEST_MODE: "false", AUTH_OTP_MODE: "static", AUTH_STATIC_OTP: "1111", AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION: "1" }))).toThrow(/AUTH_STATIC_OTP_ALLOWED_IPS/);
    expect(resolveOtpConfig(env({ NODE_ENV: "development" }))).toEqual({ mode: "static", code: "1111", allowedIps: null });
  });

  it("logs a loud warning when an auth instance starts in test mode", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    makeAuth(db, { otp: TEST_MODE });
    expect(warn.mock.calls.flat().join(" ")).toMatch(/TEST AUTHENTICATION ONLY/);
    warn.mockRestore();
  });
});

describe("test mode: sign-in for every number", () => {
  beforeEach(() => resetDb(db));

  const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  it("any new number signs in with 1111 and is created as a customer", async () => {
    quiet();
    const auth = makeAuth(db, { otp: TEST_MODE });
    const numbers = ["09121234567", "۰۹۳۵۱۱۱۲۲۳۳", "+989011112233", "00989201234567", "9361234567"];
    for (const raw of numbers) {
      const phone = normalizeIranMobile(raw)!;
      const res = await loginAndGetRole(auth, phone);
      expect(res, raw).toMatchObject({ ok: true, role: "customer" });
    }
    expect(await db.select().from(users)).toHaveLength(numbers.length);
    // ورود دوباره همان حساب را برمی‌گرداند (حساب تکراری ساخته نمی‌شود)
    const again = await loginAndGetRole(auth, "+989121234567");
    expect(again.ok).toBe(true);
    expect(await db.select().from(users)).toHaveLength(numbers.length);
    vi.restoreAllMocks();
  });

  it("a wrong OTP is rejected and creates no account", async () => {
    quiet();
    const auth = makeAuth(db, { otp: TEST_MODE });
    expect(await loginAndGetRole(auth, "+989121234567", "2222")).toEqual({ ok: false, reason: "invalid_code" });
    expect(await db.select().from(users)).toHaveLength(0);
    // سقف ۳ تلاش برای هر کد همچنان برقرار است
    const browser = new TestBrowser(auth);
    await browser.post("/phone-number/send-otp", { phoneNumber: "+989121234567" });
    for (const code of ["0000", "1234", "9999"]) await browser.post("/phone-number/verify", { phoneNumber: "+989121234567", code });
    expect((await browser.post("/phone-number/verify", { phoneNumber: "+989121234567", code: "1111" })).status).toBe(403);
    vi.restoreAllMocks();
  });

  it("09991797982 is always admin: on first sign-in, on registration and after being demoted", async () => {
    quiet();
    const auth = makeAuth(db, { otp: TEST_MODE });
    const first = await loginAndGetRole(auth, TEST_MODE_ADMIN_PHONE);
    expect(first).toMatchObject({ ok: true, role: "admin" });

    // اگر نقش در دیتابیس تغییر کند، ورود بعدی دوباره admin می‌کند
    await db.update(profiles).set({ role: "customer" }).where(eq(profiles.userId, first.ok ? first.userId : ""));
    expect(await loginAndGetRole(auth, TEST_MODE_ADMIN_PHONE)).toMatchObject({ ok: true, role: "admin" });

    // سایر شماره‌ها admin نمی‌شوند
    expect(await loginAndGetRole(auth, "+989121234567")).toMatchObject({ ok: true, role: "customer" });
    expect(await db.select().from(profiles).where(eq(profiles.role, "admin"))).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("the admin number is admin even through the registration form (any chosen role)", async () => {
    quiet();
    const auth = makeAuth(db, { otp: TEST_MODE });
    const res = await registerViaService(auth, db, { phone: TEST_MODE_ADMIN_PHONE, role: "stylist" });
    expect(res.ok).toBe(true);
    const [p] = await db.select().from(profiles);
    expect(p!.role).toBe("admin");
    vi.restoreAllMocks();
  });

  it("registration in test mode still applies the chosen non-admin role for other numbers", async () => {
    quiet();
    const auth = makeAuth(db, { otp: TEST_MODE });
    const res = await registerViaService(auth, db, { phone: "+989121234567", role: "salon_owner" });
    expect(res.ok).toBe(true);
    const [p] = await db.select().from(profiles);
    expect(p!.role).toBe("salon_owner");
    vi.restoreAllMocks();
  });

  it("existing users and bookings are preserved and existing users keep their role", async () => {
    quiet();
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db, "customer");
    await createBooking(db, customer, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    await db.update(users).set({ phoneNumber: "+989130000001" }).where(eq(users.id, s.stylistUser.userId));
    const before = { users: (await db.select().from(users)).length, bookings: (await db.select().from(bookings)).length };

    const auth = makeAuth(db, { otp: TEST_MODE });
    expect(await loginAndGetRole(auth, "+989130000001")).toMatchObject({ ok: true, role: "stylist", userId: s.stylistUser.userId });
    expect({ users: (await db.select().from(users)).length, bookings: (await db.select().from(bookings)).length }).toEqual(before);
    vi.restoreAllMocks();
  });
});

describe("test mode off: previous security behaviour is unchanged", () => {
  beforeEach(() => resetDb(db));

  it("unknown numbers cannot sign in and the admin number gets no special role", async () => {
    const auth = makeAuth(db, { otp: STATIC_OTP_CONFIG });
    expect(await loginAndGetRole(auth, "+989121234567")).toEqual({ ok: false, reason: "not_registered" });
    expect(await loginAndGetRole(auth, TEST_MODE_ADMIN_PHONE)).toEqual({ ok: false, reason: "not_registered" });
    // ثبت‌نام عادی شماره ادمین تستی → نقش انتخابی (نه admin)
    await registerViaService(auth, db, { phone: TEST_MODE_ADMIN_PHONE, role: "customer" });
    const [p] = await db.select().from(profiles);
    expect(p!.role).toBe("customer");
    // و فراخوانی مستقیم API برای شماره ناشناخته حساب نمی‌سازد
    const r = await new TestBrowser(auth).loginWithOtp("+989351112233");
    expect(r.status).toBe(404);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("IP allow-list mode is unaffected", async () => {
    const restricted: OtpConfig = { mode: "static", code: "1111", allowedIps: ["10.8.0.2"] };
    const auth = makeAuth(db, { otp: restricted });
    expect((await new TestBrowser(auth, "203.0.113.5", { "x-real-ip": "203.0.113.5" }).post("/phone-number/send-otp", { phoneNumber: "+989121234567" })).status).toBe(403);
  });
});
