import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** Optional nicer version for mail apps that show HTML. */
  html?: string;
}

/**
 * Sends email. Which way is chosen by MAIL_DRIVER in backend/.env:
 *   console  prints the email in this terminal (default; no setup, nothing leaves your Mac)
 *   smtp     a real mail server (Gmail, Brevo, Mailtrap, ...) via nodemailer
 *   resend   the Resend web service over HTTPS (works on hosts that block SMTP, e.g. Render)
 * `send` THROWS if the email could not be sent; callers turn that into a clear error for the app.
 */
@Injectable()
export class MailerService {
  private readonly log = new Logger('Mailer');
  /** The last emails handed to `send` (development and tests only; never used in production logic). */
  readonly outbox: Mail[] = [];
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async send(mail: Mail): Promise<void> {
    this.outbox.push(mail);
    if (this.outbox.length > 50) this.outbox.shift();

    switch (this.config.get<string>('MAIL_DRIVER') ?? 'console') {
      case 'smtp':
        return this.sendSmtp(mail);
      case 'resend':
        return this.sendResend(mail);
      default:
        this.log.log(`EMAIL to ${mail.to} | ${mail.subject}\n${mail.text}`);
    }
  }

  private get from(): string {
    return this.config.getOrThrow<string>('MAIL_FROM');
  }

  // ───── SMTP ─────

  /** Overridable so tests can use a fake transport that sends nothing. */
  protected createTransport(): Transporter {
    return nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      // Settings can arrive as text ("587", "false") depending on how the app was started: convert explicitly.
      port: Number(this.config.getOrThrow('SMTP_PORT')),
      secure: String(this.config.get('SMTP_SECURE') ?? 'false') === 'true',
      auth: { user: this.config.getOrThrow<string>('SMTP_USER'), pass: this.config.getOrThrow<string>('SMTP_PASS') },
      // Never let a stuck mail server hang the request that triggered the email.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  private async sendSmtp(mail: Mail): Promise<void> {
    this.transporter ??= this.createTransport();
    await this.transporter.sendMail({ from: this.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    this.log.log(`Email sent via SMTP to ${mail.to} | ${mail.subject}`);
  }

  // ───── Resend (HTTPS) ─────

  private async sendResend(mail: Mail): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.getOrThrow<string>('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Resend explains the problem in the body (e.g. "domain not verified"). The key is never included.
      throw new Error(`Resend answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    this.log.log(`Email sent via Resend to ${mail.to} | ${mail.subject}`);
  }
}
