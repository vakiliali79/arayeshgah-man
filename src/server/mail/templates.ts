import type { MailMessage } from "./mailer";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, cta: { label: string; url: string }) {
  const url = escapeHtml(cta.url);
  return `<!doctype html><html lang="fa" dir="rtl"><body style="margin:0;background:#fbf8f4;font-family:Tahoma,sans-serif;color:#1d1519">
<div style="max-width:480px;margin:32px auto;background:#fff;border:1px solid #ebe2d9;border-radius:16px;padding:28px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
<p style="line-height:1.9;color:#6f6168;margin:0 0 24px">${escapeHtml(body)}</p>
<a href="${url}" style="display:inline-block;background:#5f2c4a;color:#fffaf6;text-decoration:none;padding:12px 22px;border-radius:12px">${escapeHtml(cta.label)}</a>
<p style="font-size:12px;color:#6f6168;margin-top:24px;line-height:1.8">اگر این درخواست را شما ثبت نکرده‌اید، این ایمیل را نادیده بگیرید.</p>
</div></body></html>`;
}

export function verificationEmail(to: string, name: string, url: string): MailMessage {
  const title = "تأیید ایمیل — آرایشگاه من";
  const body = `${name} عزیز، برای فعال‌سازی حساب کاربری خود روی دکمه زیر بزنید. این لینک تا ۲۴ ساعت معتبر است.`;
  return {
    tag: "verification",
    to,
    subject: title,
    text: `${body}\n\n${url}`,
    html: layout(title, body, { label: "تأیید ایمیل", url }),
  };
}

export function passwordResetEmail(to: string, name: string, url: string): MailMessage {
  const title = "بازیابی رمز عبور — آرایشگاه من";
  const body = `${name} عزیز، برای انتخاب رمز عبور جدید روی دکمه زیر بزنید. این لینک تا ۱ ساعت و فقط یک‌بار معتبر است.`;
  return {
    tag: "password-reset",
    to,
    subject: title,
    text: `${body}\n\n${url}`,
    html: layout(title, body, { label: "انتخاب رمز جدید", url }),
  };
}
