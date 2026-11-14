import { eq } from "drizzle-orm";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createDb } from "@/db/client";
import { bookings, salons, users } from "@/db/schema";
import { getTestDatabaseUrl } from "../helpers/env";
import { makeSalonScenario, makeUser } from "../helpers/db";

const BASE = inject("baseURL");
const ALLOWED_IP = inject("allowedIp");
const db = createDb(getTestDatabaseUrl(), { max: 2 });

let browser: Browser;
let salonSlug: string;
let stylistId: string;

async function customerWithPhone(phone: string, name: string) {
  const c = await makeUser(db, "customer", name);
  await db.update(users).set({ phoneNumber: phone, phoneNumberVerified: true }).where(eq(users.id, c.userId));
  return c;
}

async function newPage() {
  const ctx = await browser.newContext({ locale: "fa-IR", extraHTTPHeaders: { "x-real-ip": ALLOWED_IP } });
  return ctx.newPage();
}

async function login(p: Page, phone: string) {
  await p.fill("#phone", phone);
  await p.click("button[type=submit]");
  await p.locator("#otp-0").waitFor();
  await p.locator("#otp-0").click();
  await p.keyboard.type("1111");
  await p.click("button:has-text('ورود به حساب')");
}

describe("booking end-to-end (guest → login → confirm → receipt)", () => {
  beforeAll(async () => {
    const s = await makeSalonScenario(db);
    await db.update(salons).set({ isVerified: true }).where(eq(salons.id, s.salon.id));
    salonSlug = s.salon.slug;
    stylistId = s.stylist.id;
    await customerWithPhone("+989351110001", "مشتری اول");
    await customerWithPhone("+989351110002", "مشتری دوم");
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    await db.$client.end();
  });

  let bookedUrl = "";

  it("books from the salon page through every step and shows the tracking code", async () => {
    const p = await newPage();
    await p.goto(`${BASE}/salons/${salonSlug}`);
    await p.click("#services >> text=رزرو این خدمت");
    await p.waitForURL(/\/book\?/);
    // تنها آرایشگر خودکار انتخاب می‌شود ← مرحله تاریخ
    expect(await p.locator("[aria-current=step]").textContent()).toContain("تاریخ");
    await p.locator("section a[href*='date=']").first().click();
    await p.waitForURL(/date=/);
    expect(await p.locator("[aria-current=step]").textContent()).toContain("ساعت");
    await p.locator("section a[href*='time=']").first().click();
    await p.waitForURL(/time=/);
    bookedUrl = p.url();
    expect(await p.locator("[aria-current=step]").textContent()).toContain("تأیید");

    // مهمان ← ورود و بازگشت به همان مرحله
    await p.click("text=ورود و ادامه رزرو");
    await p.waitForURL(/\/login/);
    await login(p, "09351110001");
    await p.waitForURL((u) => u.pathname === "/book" && u.search.includes("time="));
    await p.fill("#note", "لطفاً رنگ روشن");
    await p.click("button:has-text('ثبت نهایی نوبت')");
    await p.waitForURL(/\/dashboard\/customer\/bookings\/[0-9a-f-]+\?created=1/);
    const receipt = await p.locator("main").first().textContent();
    expect(receipt).toMatch(/AM-[A-Z0-9]{10}/);

    const [b] = await db.select().from(bookings).where(eq(bookings.stylistId, stylistId));
    expect(b).toMatchObject({ status: "pending", priceToman: 1_200_000, customerNote: "لطفاً رنگ روشن" });
    await p.context().close();
  });

  it("another customer cannot take the same time (step shows it is no longer free)", async () => {
    const p = await newPage();
    await p.goto(`${BASE}/login`);
    await login(p, "09351110002");
    await p.waitForURL(/\/dashboard/);
    await p.goto(bookedUrl);
    expect(await p.locator("[aria-current=step]").textContent()).toContain("ساعت");
    expect(await p.locator("main").textContent()).toContain("دیگر آزاد نیست");
    await p.context().close();
  });

  it("a stale confirm form is rejected by the server (overlap check in the transaction)", async () => {
    const p = await newPage();
    await p.goto(`${BASE}/login`);
    await login(p, "09351110002");
    await p.waitForURL(/\/dashboard/);
    // زمان بعدی آزاد را باز می‌کنیم، سپس پیش از ارسال، شخص دیگری همان زمان را رزرو می‌کند
    const u = new URL(bookedUrl);
    u.searchParams.delete("time");
    await p.goto(u.toString());
    await p.locator("section a[href*='time=']").first().click();
    await p.waitForURL(/time=/);
    const t = new URL(p.url());
    const other = await makeUser(db);
    const { createBooking } = await import("@/server/bookings/service");
    const { zonedLocalToIso } = await import("@/lib/format/datetime");
    const [svc] = await db.select({ serviceId: bookings.serviceId }).from(bookings).where(eq(bookings.stylistId, stylistId)).limit(1);
    await createBooking(db, other, { stylistId, serviceId: svc!.serviceId, startsAt: zonedLocalToIso(t.searchParams.get("date")!, t.searchParams.get("time")!, "Asia/Tehran") });
    await p.click("button:has-text('ثبت نهایی نوبت')");
    await expect.poll(async () => p.locator("main").textContent(), { timeout: 15_000 }).toContain("زمان دیگری انتخاب کنید");
    expect(await p.locator("text=انتخاب زمان دیگر").count()).toBe(1);
    expect(new URL(p.url()).pathname).toBe("/book");
    await p.context().close();
  });
});
