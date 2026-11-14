import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { profiles, sessions } from "@/db/schema";
import { setUserStatus } from "@/server/admin/users";
import { AUTH_TTL, resolveCookieDomain } from "@/server/auth/better-auth";
import { requestOtp } from "@/server/auth/phone-auth";
import { getSessionContext } from "@/server/auth/session";
import { closeTestDb, getTestDb, makeUser, resetDb } from "./helpers/db";
import { BASE_URL, makeAuth, registerViaService, sessionCookieName, TestBrowser } from "./helpers/auth";

const db = getTestDb();
const auth = makeAuth(db);
afterAll(closeTestDb);

const DAY = 86_400_000;
const PHONE = "+989121234500";

async function signedInBrowser() {
  const res = await registerViaService(auth, db, { phone: PHONE });
  if (!res.ok) throw new Error(`registration failed: ${res.reason}`);
  const b = new TestBrowser(auth);
  b.absorb(res.setCookie);
  return { b, userId: res.userId };
}
const sessionRow = async (userId: string) => (await db.select().from(sessions).where(eq(sessions.userId, userId)))[0]!;
const maxAgeOf = (setCookies: string[]) => Number(/max-age=(\d+)/i.exec(setCookies.find((c) => c.startsWith(sessionCookieName())) ?? "")?.[1] ?? NaN);

describe("persistent sessions", () => {
  beforeEach(() => resetDb(db));

  it("signs in with a persistent 30-day HttpOnly cookie (survives browser restarts)", async () => {
    const res = await registerViaService(auth, db, { phone: PHONE });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const cookie = res.setCookie.find((c) => c.startsWith(sessionCookieName()))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(maxAgeOf(res.setCookie)).toBe(AUTH_TTL.session); // Max-Age ⇒ کوکی ماندگار، نه کوکی موقت مرورگر
    expect(AUTH_TTL.session).toBe(30 * 24 * 3600);
    const row = await sessionRow(res.userId);
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(29.9 * DAY);
  });

  it("server components read the session without silently extending it in the DB", async () => {
    const { b, userId } = await signedInBrowser();
    const old = new Date(Date.now() + 25 * DAY); // آخرین تمدید ۵ روز پیش
    await db.update(sessions).set({ expiresAt: old }).where(eq(sessions.userId, userId));
    const ctx = await getSessionContext(auth, db, b.headers());
    expect(ctx?.user.id).toBe(userId);
    expect((await sessionRow(userId)).expiresAt.getTime()).toBe(old.getTime());
  });

  it("the keep-alive endpoint extends both the DB session and the cookie (rolling 30 days)", async () => {
    const { b, userId } = await signedInBrowser();
    // تازه: تمدید لازم نیست
    const fresh = await b.get("/get-session");
    expect(fresh.status).toBe(200);
    expect(b.lastSetCookies.filter((c) => c.startsWith(sessionCookieName()))).toEqual([]);

    await db.update(sessions).set({ expiresAt: new Date(Date.now() + 25 * DAY) }).where(eq(sessions.userId, userId));
    const res = await b.get("/get-session");
    expect(res.status).toBe(200);
    expect(maxAgeOf(b.lastSetCookies)).toBe(AUTH_TTL.session);
    expect((await sessionRow(userId)).expiresAt.getTime() - Date.now()).toBeGreaterThan(29.9 * DAY);
    expect((await b.session())?.user.id).toBe(userId);
  });

  it("an expired session is rejected and sign-out invalidates the session on the server", async () => {
    const { b, userId } = await signedInBrowser();
    expect(await getSessionContext(auth, db, b.headers())).not.toBeNull();
    const res = await b.post("/sign-out", {});
    expect(res.status).toBe(200);
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
    expect(await getSessionContext(auth, db, new Headers({ cookie: `${sessionCookieName()}=stale.value` }))).toBeNull();

    const { b: b2, userId: u2 } = await (async () => {
      await resetDb(db);
      return signedInBrowser();
    })();
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, u2));
    expect(await getSessionContext(auth, db, b2.headers())).toBeNull();
  });

  it("suspended accounts are signed out everywhere and cannot sign in again", async () => {
    const admin = await makeUser(db, "admin");
    const { b, userId } = await signedInBrowser();
    await setUserStatus(db, admin, { userId, status: "suspended", reason: "تخلف در قوانین" });
    expect(await getSessionContext(auth, db, b.headers())).toBeNull();
    expect(await requestOtp(auth, db, { phone: PHONE, purpose: "login" }, new Headers({ origin: BASE_URL }))).toEqual({ ok: false, reason: "suspended" });
    // دور زدن سرویس برنامه و فراخوانی مستقیم Better Auth هم نشست نمی‌سازد
    const direct = await new TestBrowser(auth).loginWithOtp(PHONE);
    expect(direct.status).not.toBe(200);
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);

    await setUserStatus(db, admin, { userId, status: "active" });
    const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    expect(p!.status).toBe("active");
    const again = await new TestBrowser(auth).loginWithOtp(PHONE);
    expect(again.status).toBe(200);
  });

  it("validates the optional shared cookie domain", () => {
    expect(resolveCookieDomain(undefined)).toBeUndefined();
    expect(resolveCookieDomain(".Example.com")).toBe("example.com");
    expect(() => resolveCookieDomain("http://evil.com/x")).toThrow();
    expect(() => resolveCookieDomain("localhost")).toThrow();
  });
});
