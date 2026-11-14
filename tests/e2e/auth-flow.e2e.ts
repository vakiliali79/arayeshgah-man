import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createDb } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { getTestDatabaseUrl } from "../helpers/env";

const BASE = inject("baseURL");
const OUTBOX = inject("outbox");
const EMAIL = "e2e.stylist@example.com";
const PASSWORD = "Password123";
const NEW_PASSWORD = "NewPassword456";

let browser: Browser;
let page: Page;

async function latestMailLink(tag: string, to: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const files = (await readdir(OUTBOX)).filter((f) => f.includes(tag)).sort();
    for (const f of files.reverse()) {
      const msg = JSON.parse(await readFile(path.join(OUTBOX, f), "utf8")) as { to: string; text: string };
      if (msg.to === to) return msg.text.match(/https?:\/\/\S+/)![0];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no ${tag} mail for ${to}`);
}

/** صبر تا المان ظاهر شود و متن مورد نظر را داشته باشد */
async function expectText(locator: Locator, text: string) {
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  await expect.poll(async () => (await locator.textContent()) ?? "", { timeout: 15_000 }).toContain(text);
}

async function login(email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}

describe("auth end-to-end (production build, real browser)", () => {
  beforeAll(async () => {
    browser = await chromium.launch();
    page = await (await browser.newContext({ locale: "fa-IR" })).newPage();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it("guests are redirected from the dashboard to login", async () => {
    await page.goto(`${BASE}/dashboard`);
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/dashboard");
    expect(await page.getAttribute("html", "dir")).toBe("rtl");
  });

  it("registers a stylist through the existing form", async () => {
    await page.goto(`${BASE}/register`);
    await page.click("text=آرایشگر");
    await page.fill("#fullName", "نگار احمدی");
    await page.fill("#phone", "09121112233");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.check("input[name=terms]");
    await page.click("button[type=submit]");
    await expectText(page.locator("[role=status]").first(), "لینک تأیید");
  });

  it("cannot log in before verifying the email", async () => {
    await login(EMAIL, PASSWORD);
    await expectText(page.locator("[role=alert]").first(), "تأیید نشده");
  });

  it("verifies the email from the link, is signed in and sees the stylist dashboard", async () => {
    await page.goto(await latestMailLink("verification", EMAIL));
    expect(new URL(page.url()).pathname).toBe("/verify-email");
    await expectText(page.locator("h1"), "تأیید شد");
    await page.click("text=ورود به داشبورد");
    await page.waitForURL(`${BASE}/dashboard`);
    await expectText(page.locator("main"), "نگار احمدی");
    await expectText(page.locator("main"), "آرایشگر");

    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name.endsWith("arayeshgah.session_token"));
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
  });

  it("the session persists across page loads and a logged-in user skips the login page", async () => {
    await page.goto(`${BASE}/dashboard`);
    await expectText(page.locator("main"), "نگار احمدی");
    await page.goto(`${BASE}/login`);
    await page.waitForURL(`${BASE}/dashboard`);
  });

  it("logs out and loses access to the dashboard", async () => {
    await page.click("text=خروج");
    await page.waitForURL(/\/login/);
    await page.goto(`${BASE}/dashboard`);
    expect(new URL(page.url()).pathname).toBe("/login");
  });

  it("shows a generic error for invalid credentials", async () => {
    await login(EMAIL, "WrongPassword1");
    await expectText(page.locator("[role=alert]").first(), "ایمیل یا رمز عبور نادرست است");
  });

  it("logs in with valid credentials and returns to the requested page", async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL(`${BASE}/dashboard`);
  });

  it("resets the password via email link and signs in with the new password", async () => {
    await page.click("text=خروج");
    await page.waitForURL(/\/login/);
    await page.click("text=رمز عبور را فراموش کرده‌اید؟");
    await page.fill("#email", EMAIL);
    await page.click("button[type=submit]");
    await expectText(page.locator("[role=status]").first(), "لینک بازیابی");

    await page.goto(await latestMailLink("password-reset", EMAIL));
    expect(new URL(page.url()).pathname).toBe("/reset-password");
    await page.fill("#password", NEW_PASSWORD);
    await page.fill("#confirmPassword", NEW_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL(/\/login\?notice=password_reset/);
    await expectText(page.locator("[role=status]").first(), "رمز عبور شما تغییر کرد");

    await login(EMAIL, PASSWORD);
    await expectText(page.locator("[role=alert]").first(), "نادرست");
    await login(EMAIL, NEW_PASSWORD);
    await page.waitForURL(`${BASE}/dashboard`);
  });

  it("a tampered registration form cannot create an admin", async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await p.fill("#fullName", "مهاجم سیستم");
    await p.fill("#phone", "09125556677");
    await p.fill("#email", "attacker@example.com");
    await p.fill("#password", PASSWORD);
    await p.check("input[name=terms]");
    // دست‌کاری پس از hydration و درست قبل از ارسال: مقدار رادیو را به admin تغییر می‌دهیم
    const submitted = await p.evaluate(() => {
      const radio = document.querySelector<HTMLInputElement>("input[name=role]")!;
      radio.value = "admin";
      radio.checked = true;
      return new FormData(radio.form!).get("role");
    });
    expect(submitted).toBe("admin");
    await p.click("button[type=submit]");
    await expectText(p.locator("fieldset [role=alert]"), "نوع حساب");
    await ctx.close();

    // بررسی مستقیم دیتابیس: هیچ کاربری ساخته نشده و هیچ ادمینی وجود ندارد
    const db = createDb(getTestDatabaseUrl(), { max: 1 });
    try {
      expect(await db.select().from(users).where(eq(users.email, "attacker@example.com"))).toHaveLength(0);
      expect(await db.select().from(profiles).where(eq(profiles.role, "admin"))).toHaveLength(0);
    } finally {
      await db.$client.end();
    }
  });

  it("an invalid reset link shows an error instead of the form", async () => {
    await page.goto(`${BASE}/reset-password?error=INVALID_TOKEN`);
    await expectText(page.locator("[role=alert]").first(), "نامعتبر");
    expect(await page.locator("#password").count()).toBe(0);
  });
});
