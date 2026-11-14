import { eq } from "drizzle-orm";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createDb } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { getTestDatabaseUrl } from "../helpers/env";

const BASE = inject("baseURL");
const ALLOWED_IP = inject("allowedIp");
const PHONE_LOCAL = "09121112233";
const PHONE_E164 = "+989121112233";

let browser: Browser;
let ctx: BrowserContext;
let page: Page;

async function expectText(locator: Locator, text: string) {
  await locator.first().waitFor({ state: "visible", timeout: 15_000 });
  await expect.poll(async () => (await locator.allTextContents()).join(" | "), { timeout: 15_000 }).toContain(text);
}

/** کد را در خانه‌های جداگانه وارد می‌کند (مثل کاربر) */
async function typeCode(p: Page, code: string) {
  await p.locator("#otp-0").waitFor();
  await p.locator("#otp-0").click();
  await p.keyboard.type(code);
}

async function withDb<T>(fn: (db: ReturnType<typeof createDb>) => Promise<T>) {
  const db = createDb(getTestDatabaseUrl(), { max: 1 });
  try {
    return await fn(db);
  } finally {
    await db.$client.end();
  }
}

describe("phone OTP auth end-to-end (production build, real browser)", () => {
  beforeAll(async () => {
    browser = await chromium.launch();
    // مرورگر از «IP مجاز» می‌آید (هدر X-Real-IP مثل پروکسی nginx)
    ctx = await browser.newContext({ locale: "fa-IR", extraHTTPHeaders: { "x-real-ip": ALLOWED_IP } });
    page = await ctx.newPage();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it("guests are redirected from the dashboard to login", async () => {
    await page.goto(`${BASE}/dashboard`);
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(await page.getAttribute("html", "dir")).toBe("rtl");
  });

  it("login with an unregistered number shows a helpful message", async () => {
    await page.goto(`${BASE}/login`);
    await page.fill("#phone", PHONE_LOCAL);
    await page.click("button[type=submit]");
    await expectText(page.locator("main [role=alert]"), "حسابی با این شماره موبایل وجود ندارد");
  });

  it("registers a stylist with mobile + OTP 1111 and lands on the dashboard signed in", async () => {
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await page.click("text=آرایشگر");
    await page.fill("#fullName", "نگار احمدی");
    await page.fill("#phone", "۰۹۱۲ ۱۱۱ ۲۲۳۳"); // ارقام فارسی و فاصله → نرمال‌سازی
    await page.check("input[name=terms]");
    await page.click("button[type=submit]");

    await expectText(page.locator("[data-testid=otp-phone]"), "۰۹۱۲ ۱۱۱ ۲۲۳۳");
    await typeCode(page, "1111");
    await page.click("button:has-text('تأیید و ساخت حساب')");
    // هدایت به داشبورد نقش (آرایشگر) با پیام موفقیت و فرم ساخت پروفایل حرفه‌ای
    await page.waitForURL(/\/dashboard\/stylist\?welcome=registered/);
    await expectText(page.locator("main"), "ثبت‌نام شما با موفقیت انجام شد");
    await expectText(page.locator("main"), "پروفایل حرفه‌ای خود را بسازید");
    await expectText(page.locator("aside"), "نگار احمدی");
    await expectText(page.locator("aside"), "آرایشگر");

    const session = (await ctx.cookies()).find((c) => c.name.endsWith("arayeshgah.session_token"));
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");

    const row = await withDb(async (db) => (await db.select().from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.phoneNumber, PHONE_E164)))[0]);
    expect(row?.users.phoneNumberVerified).toBe(true);
    expect(row?.profiles.role).toBe("stylist");
  });

  it("the session persists and a signed-in user skips the login page", async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL(`${BASE}/dashboard/stylist`);
    await expectText(page.locator("aside"), "نگار احمدی");
    await page.goto(`${BASE}/login`);
    await page.waitForURL(/\/dashboard/);
  });

  it("logs out and loses access to the dashboard", async () => {
    await page.click("aside >> text=خروج از حساب");
    await page.waitForURL(/\/login/);
    await page.goto(`${BASE}/dashboard`);
    expect(new URL(page.url()).pathname).toBe("/login");
  });

  it("registering the same number again is refused", async () => {
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await page.fill("#fullName", "کاربر دوم");
    await page.fill("#phone", "+98 912 111 2233");
    await page.check("input[name=terms]");
    await page.click("button[type=submit]");
    await expectText(page.locator("main [role=alert]"), "قبلاً ثبت شده است");
  });

  it("a wrong code shows an error; editing the number returns to step one", async () => {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#phone", PHONE_LOCAL);
    await page.click("button[type=submit]");
    await typeCode(page, "2222");
    await page.click("button:has-text('ورود به حساب')");
    await expectText(page.locator("main [role=alert]"), "کد تأیید اشتباه است");

    await page.click("text=ویرایش شماره موبایل");
    await page.locator("#phone").waitFor();
    expect(await page.inputValue("#phone")).toBe(PHONE_LOCAL);
  });

  it("logs in with mobile + OTP 1111 and returns to the requested page", async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.fill("#phone", PHONE_LOCAL);
    await page.click("button[type=submit]");
    await typeCode(page, "1111");
    await page.click("button:has-text('ورود به حساب')");
    await page.waitForURL(`${BASE}/dashboard/stylist`);
    await expectText(page.locator("aside"), "نگار احمدی");
    await page.click("aside >> text=خروج از حساب");
    await page.waitForURL(/\/login/);
  });

  it("a tampered registration form cannot create an admin", async () => {
    const countAdmins = () => withDb(async (db) => (await db.select().from(profiles).where(eq(profiles.role, "admin"))).length);
    const adminsBefore = await countAdmins();
    const c = await browser.newContext({ extraHTTPHeaders: { "x-real-ip": ALLOWED_IP } });
    const p = await c.newPage();
    await p.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await p.fill("#fullName", "مهاجم سیستم");
    await p.fill("#phone", "09125556677");
    await p.check("input[name=terms]");
    const submitted = await p.evaluate(() => {
      const radio = document.querySelector<HTMLInputElement>("input[name=role]")!;
      radio.value = "admin";
      radio.checked = true;
      return new FormData(radio.form!).get("role");
    });
    expect(submitted).toBe("admin");
    await p.click("button[type=submit]");
    await expectText(p.locator("fieldset [role=alert]"), "نوع حساب");
    await c.close();

    const counts = await withDb(async (db) => ({
      attacker: (await db.select().from(users).where(eq(users.phoneNumber, "+989125556677"))).length,
    }));
    expect(counts).toEqual({ attacker: 0 });
    expect(await countAdmins()).toBe(adminsBefore); // هیچ ادمین جدیدی ساخته نشده
  });

  it("static OTP is unavailable to clients outside the allow-list", async () => {
    const c = await browser.newContext(); // بدون X-Real-IP مجاز
    const p = await c.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    // شماره‌ای که سقف نرخ درخواست آن در تست‌های قبلی مصرف نشده است
    await withDb((db) => db.insert(users).values({ name: "x", email: "outsider@e2e.test", phoneNumber: "+989359990000" }));
    await p.fill("#phone", "09359990000");
    await p.click("button[type=submit]");
    await expectText(p.locator("main [role=alert]"), "در دسترس نیست");
    await c.close();
  });
});
