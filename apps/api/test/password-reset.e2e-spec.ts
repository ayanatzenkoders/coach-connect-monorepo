import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, login, bearer, seedUser, PASSWORD } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MailerService } from '../src/mail/mailer.service.js';
import { MAX_ATTEMPTS } from '../src/auth/verification-code.service.js';

describe('Forgot password: email -> verify code -> new password', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailer: MailerService;
  const NEW_PASSWORD = 'Brand-new-pass-9';

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    mailer = app.get(MailerService);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    mailer.outbox.length = 0;
  });

  const forgot = (email: string) => api(app).post('/auth/password/forgot').send({ email });
  const verifyCode = (email: string, code: string) => api(app).post('/auth/password/verify-code').send({ email, code });
  const reset = (resetToken: string, newPassword = NEW_PASSWORD) => api(app).post('/auth/password/reset').send({ resetToken, newPassword });
  const lastCode = (to: string) => mailer.outbox.filter((m) => m.to === to).at(-1)?.text.match(/\b(\d{6})\b/)?.[1] ?? '';
  const wrongOf = (code: string) => (code === '000000' ? '111111' : '000000');

  /** Run steps 1 and 2 and return the reset token. */
  async function getResetToken(email = 'ana@example.com') {
    await forgot(email);
    const res = await verifyCode(email, lastCode(email));
    return res.body.resetToken as string;
  }

  describe('step 1: ask for a code', () => {
    it('emails a code to a real member', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      const res = await forgot('ana@example.com');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ expiresInSeconds: 600, resendAfterSeconds: 60 });
      expect(lastCode('ana@example.com')).toMatch(/^\d{6}$/);
    });

    it('tells the app clearly when there is NO account (so it can offer "Create an account")', async () => {
      const res = await forgot('ghost@example.com');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
      expect(res.body.message).toMatch(/Create an account/i);
      expect(mailer.outbox).toHaveLength(0);
    });

    it('treats staff emails as "no account" (staff do not reset through the app)', async () => {
      await seedUser(prisma, 'boss@example.com', 'ADMIN');
      expect((await forgot('boss@example.com')).body.code).toBe('ACCOUNT_NOT_FOUND');
      expect(mailer.outbox).toHaveLength(0);
    });

    it('asking again inside the minute sends no second email and reports the REAL wait', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      await forgot('ana@example.com');
      const again = await forgot('ana@example.com');
      expect(again.status).toBe(200);
      expect(again.body.resendAfterSeconds).toBeGreaterThan(0);
      expect(again.body.resendAfterSeconds).toBeLessThanOrEqual(60);
      expect(mailer.outbox).toHaveLength(1);
    });

    it('if the email cannot be sent: clear 503 error, and the user can ask again immediately', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      const original = mailer.send.bind(mailer);
      mailer.send = async () => {
        throw new Error('SMTP connection refused');
      };
      const failed = await forgot('ana@example.com');
      expect(failed.status).toBe(503);
      expect(failed.body.code).toBe('EMAIL_SEND_FAILED');
      expect(JSON.stringify(failed.body)).not.toContain('SMTP'); // internal details never reach the app

      mailer.send = original;
      const retry = await forgot('ana@example.com'); // no 60 s wait: the unsent code was cancelled
      expect(retry.status).toBe(200);
      expect(lastCode('ana@example.com')).toMatch(/^\d{6}$/);
    });
  });

  describe('step 2: verify the code', () => {
    it('the right code returns a reset token', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      await forgot('ana@example.com');
      const res = await verifyCode('ana@example.com', lastCode('ana@example.com'));
      expect(res.status).toBe(200);
      expect(res.body.resetToken).toEqual(expect.any(String));
      expect(res.body.expiresInSeconds).toBe(600);
    });

    it('a wrong code is refused and says how many tries are left', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      await forgot('ana@example.com');
      const res = await verifyCode('ana@example.com', wrongOf(lastCode('ana@example.com')));
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVALID_CODE', attemptsLeft: MAX_ATTEMPTS - 1 });
    });

    it('5 wrong guesses lock the code, even for the right one', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      await forgot('ana@example.com');
      const code = lastCode('ana@example.com');
      for (let i = 0; i < MAX_ATTEMPTS; i++) await verifyCode('ana@example.com', wrongOf(code));
      expect((await verifyCode('ana@example.com', code)).body.code).toBe('CODE_LOCKED');
    });

    it('an expired code is refused', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      await forgot('ana@example.com');
      const code = lastCode('ana@example.com');
      await prisma.verificationCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await verifyCode('ana@example.com', code)).body.code).toBe('CODE_EXPIRED');
    });

    it('a code works once: after it is verified it cannot be verified again', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      await forgot('ana@example.com');
      const code = lastCode('ana@example.com');
      expect((await verifyCode('ana@example.com', code)).status).toBe(200);
      expect((await verifyCode('ana@example.com', code)).status).toBe(400);
    });

    it('an unknown email gets ACCOUNT_NOT_FOUND', async () => {
      expect((await verifyCode('ghost@example.com', '123456')).body.code).toBe('ACCOUNT_NOT_FOUND');
    });

    it('an email-verification code cannot be used here (purposes are separate)', async () => {
      await api(app).post('/auth/register').send({ email: 'ana@example.com', password: PASSWORD, name: 'Ana', dateOfBirth: '1990-05-17', deviceId: 'device-aaaaaaaa' });
      const res = await verifyCode('ana@example.com', lastCode('ana@example.com'));
      expect(res.status).toBe(400);
    });
  });

  describe('step 3: set the new password', () => {
    it('changes the password: the new one works, the old one does not', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      const res = await reset(await getResetToken());
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      const withNew = await api(app).post('/auth/login').send({ email: 'ana@example.com', password: NEW_PASSWORD, deviceId: 'device-aaaaaaaa' });
      expect(withNew.status).toBe(200);
      expect((await login(app, 'ana@example.com')).status).toBe(401);
    });

    it('signs out every device, including tokens that had not expired yet', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      const phone = (await login(app, 'ana@example.com', 'device-phone-1')).body;
      const tablet = (await login(app, 'ana@example.com', 'device-tablet1')).body;
      await reset(await getResetToken());
      for (const t of [phone, tablet]) {
        const me = await api(app).get('/auth/me').set(bearer(t.accessToken));
        expect(me.status).toBe(401);
        expect(me.body.code).toBe('SESSION_REVOKED');
        expect((await api(app).post('/auth/refresh').send({ refreshToken: t.refreshToken })).status).toBe(401);
      }
      expect(await prisma.session.count({ where: { revokedReason: 'PASSWORD_CHANGED' } })).toBe(2);
      expect(await prisma.auditLog.count({ where: { action: 'password.reset' } })).toBe(1);
    });

    it('marks an unverified email as verified (they proved they own the inbox)', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      await reset(await getResetToken());
      expect((await prisma.user.findFirstOrThrow({ where: { email: 'ana@example.com' } })).emailVerifiedAt).not.toBeNull();
    });

    it('a reset token works only once', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      const token = await getResetToken();
      expect((await reset(token)).status).toBe(200);
      const second = await reset(token, 'Another-pass-77');
      expect(second.status).toBe(400);
      expect(second.body.code).toBe('RESET_TOKEN_INVALID');
      // and the password is still the one from the first use
      expect((await api(app).post('/auth/login').send({ email: 'ana@example.com', password: NEW_PASSWORD, deviceId: 'device-aaaaaaaa' })).status).toBe(200);
    });

    it('rejects a garbage token, and an ACCESS token used as a reset token', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      expect((await reset('not-a-token')).body.code).toBe('RESET_TOKEN_INVALID');
      const access = (await login(app, 'ana@example.com')).body.accessToken;
      expect((await reset(access)).body.code).toBe('RESET_TOKEN_INVALID');
    });

    it('a reset token cannot be used as a login token', async () => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      const token = await getResetToken();
      const res = await api(app).get('/auth/me').set(bearer(token));
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });

    it.each([
      ['no uppercase letter', 'alllowercase1'],
      ['no lowercase letter', 'ALLUPPERCASE1'],
      ['no number', 'NoNumbersHere'],
      ['too short', 'Ab1'],
    ])('rejects a new password with %s, and the token survives to try again', async (_label, weak) => {
      await seedUser(prisma, 'ana@example.com', 'MEMBER');
      const token = await getResetToken();
      expect((await reset(token, weak)).status).toBe(400);
      expect((await reset(token)).status).toBe(200);
    });
  });
});
