import { eq } from "drizzle-orm";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createDb } from "@/db/client";
import { users } from "@/db/schema";
import type { Actor } from "@/server/auth/actor";
import { getTestDatabaseUrl } from "../helpers/env";
import { makeSalonScenario, makeUser } from "../helpers/db";

const BASE = inject("baseURL");
const ALLOWED_IP = inject("allowedIp");
const db = createDb(getTestDatabaseUrl(), { max: 2 });
let browser: Browser;

const PHONES = { customer: "09353330001", victim: "09353330002", owner: "09123330001", admin: "09123330099" } as const;
let salonId = "";
let victimId = "";

async function setPhone(a: Actor, local: string) {
  await db.update(users).set({ phoneNumber: `+98${local.slice(1)}`, phoneNumberVerified: true }).where(eq(users.id, a.userId));
}
// هر «دستگاه» IP جداگانه دارد (محدودیت نرخ ارسال کد به ازای IP، مثل کاربران واقعی جدا)
let device = 0;
const newContext = (storageState?: Awaited<ReturnType<BrowserContext["storageState"]>>) =>
  browser.newContext({ locale: "fa-IR", extraHTTPHeaders: { "x-real-ip": ALLOWED_IP, "x-forwarded-for": `198.51.100.${++device}` }, storageState });

async function login(p: Page, phone: string) {
  await p.goto(`${BASE}/login`);
  await p.fill("#phone", phone);
  await p.click("button[type=submit]");
  await p.locator("#otp-0").waitFor();
  await p.locator("#otp-0").click();
  await p.keyboard.type("1111");
  await p.click("button:has-text('ورود به حساب')");
}
const path = (p: Page) => new URL(p.url()).pathname;

beforeAll(async () => {
  const s = await makeSalonScenario(db); // سالن تأییدنشده
  salonId = s.salon.id;
  await setPhone(s.owner, PHONES.owner);
  await setPhone(await makeUser(db, "customer", "مشتری ماندگار"), PHONES.customer);
  const victim = await makeUser(db, "customer", "کاربر متخلف");
  victimId = victim.userId;
  await setPhone(victim, PHONES.victim);
  await setPhone(await makeUser(db, "admin", "مدیر آزمون"), PHONES.admin);
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  await db.$client.end();
});

describe("persistent sign-in (browser restart, refresh, login page, logout)", () => {
  it("stays signed in across a browser restart until logout", async () => {
    const ctx = await newContext();
    const p = await ctx.newPage();
    await login(p, PHONES.customer);
    await p.waitForURL(/\/dashboard\/customer/);

    const [cookie] = (await ctx.cookies()).filter((c) => c.name.endsWith("arayeshgah.session_token"));
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(29 * 86_400_000); // کوکی ماندگار ۳۰ روزه

    // «بستن و باز کردن مرورگر»: فقط کوکی‌های ماندگار باقی می‌مانند
    const state = await ctx.storageState();
    await ctx.close();
    const restarted = await newContext({ ...state, cookies: state.cookies.filter((c) => c.expires > 0) });
    const q = await restarted.newPage();
    await q.goto(`${BASE}/dashboard`);
    expect(path(q)).toBe("/dashboard/customer");
    await q.reload();
    expect(path(q)).toBe("/dashboard/customer");
    await q.goto(`${BASE}/login`);
    expect(path(q)).toBe("/dashboard/customer"); // کاربر واردشده فرم ورود نمی‌بیند
    await q.goto(`${BASE}/register`);
    expect(path(q)).toBe("/dashboard/customer");
    await q.goto(`${BASE}/`);
    expect(await q.locator("header a[href^='/dashboard']").count()).toBeGreaterThan(0);

    const oldCookies = await restarted.cookies();
    await q.goto(`${BASE}/dashboard/customer`);
    await q.click("aside >> text=خروج از حساب");
    await q.waitForURL(/\/login/);
    await q.goto(`${BASE}/dashboard/customer`);
    expect(path(q)).toBe("/login");
    await restarted.close();

    // کوکی قدیمی پس از خروج در سرور باطل است
    const replay = await newContext();
    await replay.addCookies(oldCookies);
    const r = await replay.newPage();
    await r.goto(`${BASE}/dashboard/customer/bookings`);
    expect(path(r)).toBe("/login");
    expect(new URL(r.url()).searchParams.get("next")).toBe("/dashboard/customer/bookings");
    expect(await r.locator("main").textContent()).toContain("نشست شما منقضی شده است");
    await replay.close();
  });
});

describe("super admin panel", () => {
  it("rejects a salon with a reason; the owner sees it; the action is in the audit log", async () => {
    const ctx = await newContext();
    const p = await ctx.newPage();
    await login(p, PHONES.admin);
    await p.waitForURL(/\/dashboard\/admin/);
    expect(await p.locator("main").textContent()).toContain("رشد کاربران");

    await p.goto(`${BASE}/dashboard/admin/salons?status=pending`);
    await p.click(`a[href="/dashboard/admin/salons/${salonId}"]`);
    await p.waitForURL(`**/dashboard/admin/salons/${salonId}`);
    await p.click("summary:has-text('رد درخواست ثبت')");
    await p.fill("#reason-reject", "تصویر مجوز کسب بارگذاری نشده است");
    p.once("dialog", (d) => d.accept());
    await p.click("button:has-text('رد درخواست')");
    await expect.poll(async () => p.locator("main").textContent(), { timeout: 15_000 }).toContain("درخواست این سالن رد شده است");

    await p.goto(`${BASE}/dashboard/admin/audit`);
    expect(await p.locator("main").textContent()).toContain("رد درخواست سالن");
    await ctx.close();

    const o = await (await newContext()).newPage();
    await login(o, PHONES.owner);
    await o.waitForURL(/\/dashboard\/salon/);
    await o.goto(`${BASE}/dashboard/salon/${salonId}`);
    expect(await o.locator("main").textContent()).toContain("تصویر مجوز کسب بارگذاری نشده است");
  });

  it("suspending a user signs them out immediately and blocks login", async () => {
    const vctx = await newContext();
    const v = await vctx.newPage();
    await login(v, PHONES.victim);
    await v.waitForURL(/\/dashboard\/customer/);

    const a = await (await newContext()).newPage();
    await login(a, PHONES.admin);
    await a.waitForURL(/\/dashboard\/admin/);
    await a.goto(`${BASE}/dashboard/admin/users/${victimId}`);
    await a.click("summary:has-text('تعلیق حساب')");
    await a.fill("#reason-suspend", "ثبت نوبت‌های جعلی");
    a.once("dialog", (d) => d.accept());
    await a.click("button:has-text('تعلیق و خروج از همه دستگاه‌ها')");
    await expect.poll(async () => a.locator("main").textContent(), { timeout: 15_000 }).toContain("این حساب از");

    await v.reload();
    expect(path(v)).toBe("/login");
    // درخواست کد برای حساب تعلیق‌شده در همان مرحله شماره رد می‌شود (کدی ارسال نمی‌شود)
    await v.fill("#phone", PHONES.victim);
    await v.click("button[type=submit]");
    await expect.poll(async () => v.locator("main").textContent(), { timeout: 15_000 }).toContain("تعلیق شده است");
    await vctx.close();
  });

  it("non-admins cannot open any admin page, including the new ones", async () => {
    const c = await (await newContext()).newPage();
    await login(c, PHONES.customer);
    await c.waitForURL(/\/dashboard\/customer/);
    for (const u of ["/dashboard/admin/audit", `/dashboard/admin/users/${victimId}`, `/dashboard/admin/salons/${salonId}`, "/dashboard/admin/tickets"]) {
      await c.goto(`${BASE}${u}`);
      expect(path(c), u).toBe("/dashboard/customer");
    }
  });
});
