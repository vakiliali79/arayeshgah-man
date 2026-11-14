import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** نوع پیام برای ردیابی (verification / password-reset) */
  tag: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** فقط برای تست: پیام‌ها در حافظه نگه داشته می‌شوند */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage) {
    this.sent.push(message);
  }
  last(tag?: string) {
    return [...this.sent].reverse().find((m) => !tag || m.tag === tag);
  }
}

/**
 * توسعه: هر ایمیل به‌صورت یک فایل JSON در پوشه outbox نوشته می‌شود (به‌جای ارسال واقعی).
 * پوشه در .gitignore است. هرگز در production استفاده نشود (لینک‌ها شامل توکن هستند).
 */
export class FileOutboxMailer implements Mailer {
  constructor(readonly dir: string) {}
  async send(message: MailMessage) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${message.tag}-${randomUUID().slice(0, 8)}.json`;
    await writeFile(path.join(this.dir, name), JSON.stringify(message, null, 2), { mode: 0o600 });
    console.info(`[mail] ${message.tag} → ${message.to} (outbox: ${path.join(this.dir, name)})`);
  }
}

/** تا زمانی که سرویس ایمیل واقعی (SMTP/API) پیکربندی نشده، ارسال در production خطا می‌دهد */
export class UnconfiguredMailer implements Mailer {
  async send(): Promise<void> {
    throw new Error("Email transport is not configured (set MAIL_TRANSPORT). See docs/auth.md.");
  }
}

export function createMailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer {
  const transport = env.MAIL_TRANSPORT ?? (env.NODE_ENV === "production" ? "none" : "file");
  switch (transport) {
    case "file":
      if (env.NODE_ENV === "production" && env.MAIL_ALLOW_FILE_IN_PRODUCTION !== "1") {
        throw new Error("MAIL_TRANSPORT=file is not allowed in production");
      }
      // مسیر فقط در زمان اجرا تعیین می‌شود؛ از ردیابی فایل‌ها در بیلد مستثنی است
      return new FileOutboxMailer(
        path.resolve(/*turbopackIgnore: true*/ env.MAIL_OUTBOX_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "mail")),
      );
    case "none":
      return new UnconfiguredMailer();
    default:
      throw new Error(`Unsupported MAIL_TRANSPORT "${transport}"`);
  }
}
