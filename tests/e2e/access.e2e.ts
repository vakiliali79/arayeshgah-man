import { eq } from "drizzle-orm";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createDb } from "@/db/client";
import { salons, users } from "@/db/schema";
import { createBooking } from "@/server/bookings/service";
import { getTestDatabaseUrl } from "../helpers/env";
import { at, makeSalonScenario, makeUser } from "../helpers/db";
import type { Actor } from "@/server/auth/actor";

const BASE = inject("baseURL");
const ALLOWED_IP = inject("allowedIp");
const db = createDb(getTestDatabaseUrl(), { max: 2 });
let browser: Browser;

const PHONES = { customer: "09352220001", other: "09352220002", stylist: "09132220001", owner: "09122220001", admin: "09122220099" } as const;
const pages: Partial<Record<keyof typeof PHONES, Page>> = {};
let ownSalonId = "";
let foreignSalonId = "";
let customerBookingId = "";
let salonSlug = "";

async function setPhone(a: Actor, local: string) {
  await db.update(users).set({ phoneNumber: `+98${local.slice(1)}`, phoneNumberVerified: true }).where(eq(users.id, a.userId));
}

async function loginAs(who: keyof typeof PHONES) {
  const ctx = await browser.newContext({ locale: "fa-IR", extraHTTPHeaders: { "x-real-ip": ALLOWED_IP, "x-forwarded-for": `198.51.100.${100 + Object.keys(pages).length}` } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill("#phone", PHONES[who]);
  await p.click("button[type=submit]");
  await p.locator("#otp-0").waitFor();
  await p.locator("#otp-0").click();
  await p.keyboard.type("1111");
  await p.click("button:has-text('ورود به حساب')");
  await p.waitForURL(/\/dashboard\/(customer|stylist|salon|admin)/);
  pages[who] = p;
  return p;
}

/** مسیر نهایی پس از همه redirectها و وضعیت HTTP */
async function visit(p: Page, path: string) {
  const res = await p.goto(`${BASE}${path}`);
  return { path: new URL(p.url()).pathname, status: res?.status() ?? 0 };
}

describe("roles and permissions end-to-end (server-side checks)", () => {
  beforeAll(async () => {
    const own = await makeSalonScenario(db);
    const foreign = await makeSalonScenario(db);
    for (const s of [own, foreign]) await db.update(salons).set({ isVerified: true }).where(eq(salons.id, s.salon.id));
    ownSalonId = own.salon.id;
    foreignSalonId = foreign.salon.id;
    salonSlug = own.salon.slug;
    const customer = await makeUser(db, "customer", "مشتری");
    const other = await makeUser(db, "customer", "مشتری دیگر");
    await setPhone(customer, PHONES.customer);
    await setPhone(other, PHONES.other);
    await setPhone(own.stylistUser, PHONES.stylist);
    await setPhone(own.owner, PHONES.owner);
    await setPhone(await makeUser(db, "admin", "مدیر"), PHONES.admin);
    // نوبتی در آینده (روز کاری بعدی، ساعت ۱۱ تهران)
    const d = new Date(Date.now() + 2 * 86_400_000);
    let key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(d);
    if (new Date(`${key}T12:00:00Z`).getUTCDay() === 5) key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date(d.getTime() + 86_400_000));
    const b = await createBooking(db, customer, { stylistId: own.stylist.id, serviceId: own.service.id, startsAt: at(key, "11:00") });
    customerBookingId = b.id;
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    await db.$client.end();
  });

  it("each role lands on its own dashboard", async () => {
    expect(new URL((await loginAs("customer")).url()).pathname).toBe("/dashboard/customer");
    expect(new URL((await loginAs("stylist")).url()).pathname).toBe("/dashboard/stylist");
    expect(new URL((await loginAs("owner")).url()).pathname).toMatch(/^\/dashboard\/salon/);
    expect(new URL((await loginAs("admin")).url()).pathname).toBe("/dashboard/admin");
    await loginAs("other");
  });

  it("customer cannot open stylist, salon or admin areas", async () => {
    const p = pages.customer!;
    for (const path of ["/dashboard/admin", "/dashboard/admin/users", "/dashboard/stylist", "/dashboard/stylist/bookings", "/dashboard/salon", `/dashboard/salon/${ownSalonId}`]) {
      expect((await visit(p, path)).path, path).toBe("/dashboard/customer");
    }
  });

  it("stylist cannot open admin or salon management; owner cannot open admin or stylist areas", async () => {
    for (const path of ["/dashboard/admin", "/dashboard/admin/salons", `/dashboard/salon/${ownSalonId}/settings`]) {
      expect((await visit(pages.stylist!, path)).path, path).toBe("/dashboard/stylist");
    }
    for (const path of ["/dashboard/admin", "/dashboard/admin/tickets", "/dashboard/stylist/schedule"]) {
      expect((await visit(pages.owner!, path)).path, path).toMatch(/^\/dashboard\/salon/);
    }
  });

  it("salon owner cannot see another owner's salon", async () => {
    expect((await visit(pages.owner!, `/dashboard/salon/${ownSalonId}/bookings`)).status).toBe(200);
    const res = await visit(pages.owner!, `/dashboard/salon/${foreignSalonId}/bookings`);
    expect(res.status).toBe(404);
  });

  it("a customer cannot open another customer's booking; the owner sees it in the salon", async () => {
    expect((await visit(pages.customer!, `/dashboard/customer/bookings/${customerBookingId}`)).status).toBe(200);
    expect((await visit(pages.other!, `/dashboard/customer/bookings/${customerBookingId}`)).status).toBe(404);
    await visit(pages.owner!, `/dashboard/salon/${ownSalonId}/bookings?tab=pending`);
    expect(await pages.owner!.locator("main").textContent()).toContain("مشتری");
    await visit(pages.stylist!, "/dashboard/stylist/bookings?tab=pending");
    expect(await pages.stylist!.locator("main").textContent()).toContain("مشتری");
  });

  it("admin can open every admin section", async () => {
    for (const s of ["", "/users", "/salons", "/stylists", "/bookings", "/reviews", "/tickets", "/categories", "/plans", "/content", "/audit"]) {
      const r = await visit(pages.admin!, `/dashboard/admin${s}`);
      expect([r.path, r.status], s).toEqual([`/dashboard/admin${s}`, 200]);
    }
  });

  it("guests are sent to login from every dashboard", async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    for (const path of ["/dashboard/customer", "/dashboard/stylist", "/dashboard/admin", `/dashboard/salon/${ownSalonId}`]) {
      expect((await visit(p, path)).path, path).toBe("/login");
    }
    await ctx.close();
  });

  it("public pages have no broken internal links", async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    const seeds = ["/", "/salons", "/stylists", `/salons/${salonSlug}`, "/about", "/contact", "/careers", "/businesses", "/register-salon", "/join-as-stylist", "/pricing", "/support", "/faq", "/terms", "/privacy", "/book"];
    const links = new Set<string>(seeds);
    for (const s of seeds) {
      await p.goto(`${BASE}${s}`);
      for (const href of await p.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")!))) links.add(href.split("#")[0]!);
    }
    const broken: string[] = [];
    for (const href of links) {
      const res = await ctx.request.get(`${BASE}${href}`, { maxRedirects: 5 });
      if (res.status() >= 400) broken.push(`${href} → ${res.status()}`);
    }
    expect(broken).toEqual([]);
    expect(links.size).toBeGreaterThan(30);
    await ctx.close();
  });
});
