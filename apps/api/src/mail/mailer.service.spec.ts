import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { validateEnv } from '../config/env.js';
import { MailerService } from './mailer.service.js';
import { codeEmail } from './templates.js';

const config = (values: Record<string, unknown>) => new ConfigService(values);
const mail = { to: 'ana@example.com', subject: 'Hi', text: 'plain', html: '<b>html</b>' };

/** A MailerService whose SMTP transport is a fake: nothing leaves the test. */
class FakeSmtpMailer extends MailerService {
  readonly sendMail = vi.fn().mockResolvedValue({});
  protected override createTransport() {
    return { sendMail: this.sendMail } as unknown as Transporter;
  }
}

describe('MailerService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('console driver (default) only records the email', async () => {
    const mailer = new MailerService(config({}));
    await mailer.send(mail);
    expect(mailer.outbox).toEqual([mail]);
  });

  it('smtp driver sends from MAIL_FROM with text and html', async () => {
    const mailer = new FakeSmtpMailer(config({ MAIL_DRIVER: 'smtp', MAIL_FROM: 'Coach Connect <me@gmail.com>' }));
    await mailer.send(mail);
    expect(mailer.sendMail).toHaveBeenCalledWith({
      from: 'Coach Connect <me@gmail.com>',
      to: 'ana@example.com',
      subject: 'Hi',
      text: 'plain',
      html: '<b>html</b>',
    });
  });

  it('smtp driver throws when the mail server refuses', async () => {
    const mailer = new FakeSmtpMailer(config({ MAIL_DRIVER: 'smtp', MAIL_FROM: 'a@b.co' }));
    mailer.sendMail.mockRejectedValue(new Error('Invalid login: 535 Username and Password not accepted'));
    await expect(mailer.send(mail)).rejects.toThrow(/Invalid login/);
  });

  it('resend driver posts to the Resend API with the key in a header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"abc"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const mailer = new MailerService(config({ MAIL_DRIVER: 'resend', MAIL_FROM: 'Coach Connect <hello@x.com>', RESEND_API_KEY: 're_secret_key' }));
    await mailer.send(mail);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_secret_key');
    expect(JSON.parse(init.body)).toEqual({ from: 'Coach Connect <hello@x.com>', to: ['ana@example.com'], subject: 'Hi', text: 'plain', html: '<b>html</b>' });
  });

  it('resend driver throws with the reason, but never includes the API key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"The example.com domain is not verified."}', { status: 403 })));
    const mailer = new MailerService(config({ MAIL_DRIVER: 'resend', MAIL_FROM: 'a@b.co', RESEND_API_KEY: 're_secret_key' }));
    const error = await mailer.send(mail).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/403.*not verified/);
    expect((error as Error).message).not.toContain('re_secret_key');
  });
});

describe('start-up check of the mail settings', () => {
  const base = { DATABASE_URL: 'postgresql://x:y@localhost:5432/z', JWT_ACCESS_SECRET: 'x'.repeat(40) };

  it('defaults to console and needs nothing else', () => {
    expect(validateEnv(base)).toMatchObject({ MAIL_DRIVER: 'console' });
  });

  it('smtp without its settings refuses to start and names what is missing', () => {
    expect(() => validateEnv({ ...base, MAIL_DRIVER: 'smtp', SMTP_HOST: 'smtp.gmail.com' })).toThrow(/SMTP_PORT, SMTP_USER, SMTP_PASS/);
  });

  it('resend without a key refuses to start', () => {
    expect(() => validateEnv({ ...base, MAIL_DRIVER: 'resend' })).toThrow(/RESEND_API_KEY/);
  });

  it('accepts a complete smtp setup, and the TEXT "false" really means false', () => {
    const env = validateEnv({ ...base, MAIL_DRIVER: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'me@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop' });
    expect(env).toMatchObject({ SMTP_PORT: 587, SMTP_SECURE: false });
  });

  it('treats blank settings (as copied from .env.example) as "not set"', () => {
    const env = validateEnv({ ...base, MAIL_DRIVER: 'console', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', RESEND_API_KEY: '' });
    expect(env).toMatchObject({ MAIL_DRIVER: 'console' });
    expect(env.SMTP_PORT).toBeUndefined();
  });

  it('rejects an unknown driver name', () => {
    expect(() => validateEnv({ ...base, MAIL_DRIVER: 'carrier-pigeon' })).toThrow(/MAIL_DRIVER/);
  });
});

describe('codeEmail', () => {
  const email = codeEmail({ label: 'verification', heading: 'Verify <you>', intro: 'Enter the code.', code: '482190', minutes: 10, footer: 'Ignore if not you.' });

  it('puts the code in the plain text exactly once, in a findable phrase', () => {
    expect(email.text).toContain('Your verification code is 482190');
    expect(email.text.match(/482190/g)).toHaveLength(1);
  });

  it('shows the code in the HTML and escapes text it was given', () => {
    expect(email.html).toContain('482190');
    expect(email.html).toContain('Verify &lt;you&gt;');
    expect(email.html).not.toContain('Verify <you>');
  });
});

describe('email templates', () => {
  it('verification and reset emails differ and each holds the code once', async () => {
    const { verifyEmailEmail, passwordResetEmail } = await import('./templates.js');
    const v = verifyEmailEmail('123456', 10);
    const r = passwordResetEmail('654321', 10);
    expect(v.subject).toContain('verification');
    expect(r.subject).toContain('Reset');
    expect(v.text.match(/123456/g)).toHaveLength(1);
    expect(r.text.match(/654321/g)).toHaveLength(1);
    expect(v.html).toContain('Email verification');
    expect(r.html).toContain('Password reset');
  });
});
