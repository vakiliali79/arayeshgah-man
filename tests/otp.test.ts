import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { OtpConfigError, resolveOtpConfig } from "@/server/otp/config";
import { formatPhoneForDisplay, normalizeIranMobile, toLocalPhone } from "@/server/otp/phone";
import { createOtpSender, NoopOtpSender } from "@/server/otp/sender";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe("Iranian mobile normalization", () => {
  it("normalizes all common formats to +989XXXXXXXXX", () => {
    for (const v of ["09121234567", "9121234567", "+989121234567", "00989121234567", "989121234567", "۰۹۱۲۱۲۳۴۵۶۷", "٠٩١٢١٢٣٤٥٦٧", "0912-123-4567", " 0912 123 4567 ", "+98 (912) 123 4567"]) {
      expect(normalizeIranMobile(v), v).toBe("+989121234567");
    }
  });

  it("rejects landlines, short/long numbers and garbage", () => {
    for (const v of ["02122223333", "0912123456", "091212345678", "+19121234567", "abc", "", "0912١٢٣abcd"]) {
      expect(normalizeIranMobile(v), v).toBeNull();
    }
  });

  it("converts to local display formats", () => {
    expect(toLocalPhone("+989121234567")).toBe("09121234567");
    expect(formatPhoneForDisplay("+989121234567")).toBe("0912 123 4567");
    expect(() => toLocalPhone("09121234567")).toThrow();
  });
});

describe("OTP configuration", () => {
  it("defaults to static 1111 in development", () => {
    expect(resolveOtpConfig(env({ NODE_ENV: "development" }))).toEqual({ mode: "static", code: "1111", allowedIps: null });
    expect(resolveOtpConfig(env({ NODE_ENV: "test", AUTH_OTP_MODE: "static", AUTH_STATIC_OTP: "4826" }))).toMatchObject({ code: "4826" });
  });

  it("requires a 4-digit static code", () => {
    for (const code of ["111", "11111", "abcd"]) {
      expect(() => resolveOtpConfig(env({ NODE_ENV: "development", AUTH_OTP_MODE: "static", AUTH_STATIC_OTP: code }))).toThrow(/4 digits/);
    }
  });

  it("refuses static OTP in production unless explicitly enabled with an IP allow-list", () => {
    const prod = { NODE_ENV: "production", AUTH_OTP_MODE: "static", AUTH_STATIC_OTP: "1111" };
    expect(() => resolveOtpConfig(env(prod))).toThrow(/not allowed in production/);
    expect(() => resolveOtpConfig(env({ ...prod, AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION: "true" }))).toThrow(/not allowed in production/);
    expect(() => resolveOtpConfig(env({ ...prod, AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION: "1" }))).toThrow(/AUTH_STATIC_OTP_ALLOWED_IPS/);
    expect(resolveOtpConfig(env({ ...prod, AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION: "1", AUTH_STATIC_OTP_ALLOWED_IPS: "10.8.0.2, 10.8.0.3" }))).toEqual({
      mode: "static",
      code: "1111",
      allowedIps: ["10.8.0.2", "10.8.0.3"],
    });
    // بدون تنظیم صریح، production حالت پیش‌فرض ندارد
    expect(() => resolveOtpConfig(env({ NODE_ENV: "production" }))).toThrow(/AUTH_OTP_MODE is not set/);
    // حتی بدون AUTH_STATIC_OTP، کد پیش‌فرض ۱۱۱۱ در production استفاده نمی‌شود
    expect(() => resolveOtpConfig(env({ NODE_ENV: "production", AUTH_OTP_MODE: "static", AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION: "1", AUTH_STATIC_OTP_ALLOWED_IPS: "10.0.0.1" }))).toThrow(/4 digits/);
  });

  it("does not echo the static code in errors", () => {
    try {
      resolveOtpConfig(env({ NODE_ENV: "production", AUTH_OTP_MODE: "static", AUTH_STATIC_OTP: "7391" }));
    } catch (e) {
      expect((e as Error).message).not.toContain("7391");
    }
  });

  it("sms mode requires a provider and none is implemented yet", () => {
    expect(() => resolveOtpConfig(env({ NODE_ENV: "production", AUTH_OTP_MODE: "sms" }))).toThrow(/SMS_PROVIDER/);
    expect(() => resolveOtpConfig(env({ NODE_ENV: "production", AUTH_OTP_MODE: "sms", SMS_PROVIDER: "kavenegar" }))).toThrow(OtpConfigError);
    expect(() => resolveOtpConfig(env({ NODE_ENV: "production", AUTH_OTP_MODE: "email" }))).toThrow(/Unsupported/);
  });

  it("static mode uses a sender that sends nothing", async () => {
    const sender = createOtpSender({ mode: "static", code: "1111", allowedIps: null });
    expect(sender).toBeInstanceOf(NoopOtpSender);
    await expect(sender.send({ phoneNumber: "+989121234567", code: "1111" })).resolves.toBeUndefined();
  });
});

describe("no email / Resend dependency remains", () => {
  it("package.json has no Resend or mail packages", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(all.filter((d) => /resend|nodemailer|mail/i.test(d))).toEqual([]);
  });

  it("no source file imports Resend or the removed mail module", () => {
    const out = execSync(`grep -rlE "from ['\\"](resend|@/server/mail)|server/mail/|sendVerificationEmail|sendResetPassword" src scripts || true`, { encoding: "utf8" });
    expect(out.trim()).toBe("");
  });
});
