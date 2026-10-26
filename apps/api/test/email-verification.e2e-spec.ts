import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, bearer, PASSWORD } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MailerService } from '../src/mail/mailer.service.js';
import { MAX_ATTEMPTS } from '../src/auth/one-time-code.service.js';

describe('Email verification', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailer: MailerService;

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

  /** Register a member and return their token plus the code that was "emailed". */
  async function signUp(email = 'ana@example.com') {
    const res = await api(app).post('/auth/register').send({ email, password: PASSWORD, name: 'Ana', deviceId: 'device-aaaaaaaa' });
    const token: string = res.body.accessToken;
    const code = mailer.outbox.filter((m) => m.to === email).at(-1)?.text.match(/\b(\d{6})\b/)?.[1] ?? '';
    return { token, code, userId: res.body.user.id as string };
  }
  const verify = (token: string, code: string) => api(app).post('/auth/email/verify').set(bearer(token)).send({ code });
  const sendCode = (token: string) => api(app).post('/auth/email/send-code').set(bearer(token));
  const ageActiveCode = (ms: number) =>
    prisma.$executeRawUnsafe(`UPDATE one_time_codes SET created_at = created_at - interval '${ms} milliseconds' WHERE consumed_at IS NULL`);

  it('emails a 6-digit code at sign-up, and the user starts unverified', async () => {
    const { token, code } = await signUp();
    expect(code).toMatch(/^\d{6}$/);
    expect(mailer.outbox).toHaveLength(1);
    expect(mailer.outbox[0]).toMatchObject({ to: 'ana@example.com' });
    expect((await api(app).get('/auth/me').set(bearer(token))).body.emailVerified).toBe(false);
  });

  it('verifies with the right code; repeating it is harmless', async () => {
    const { token, code } = await signUp();
    expect((await verify(token, code)).body).toEqual({ emailVerified: true });
    expect((await api(app).get('/auth/me').set(bearer(token))).body.emailVerified).toBe(true);
    expect((await verify(token, code)).status).toBe(200);
  });

  it('stores only a hash of the code', async () => {
    const { code } = await signUp();
    const row = await prisma.oneTimeCode.findFirstOrThrow();
    expect(row.codeHash).toHaveLength(64);
    expect(row.codeHash).not.toContain(code);
  });

  it('rejects a wrong code and says how many tries are left', async () => {
    const { token, code } = await signUp();
    const wrong = code === '000000' ? '111111' : '000000';
    const res = await verify(token, wrong);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_CODE', attemptsLeft: MAX_ATTEMPTS - 1 });
  });

  it('locks the code after 5 wrong guesses, even for the correct code', async () => {
    const { token, code } = await signUp();
    const wrong = code === '000000' ? '111111' : '000000';
    let last;
    for (let i = 0; i < MAX_ATTEMPTS; i++) last = await verify(token, wrong);
    expect(last!.body.code).toBe('CODE_LOCKED');
    expect((await verify(token, code)).body.code).toBe('CODE_LOCKED');
  });

  it('rejects an expired code', async () => {
    const { token, code } = await signUp();
    await prisma.oneTimeCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await verify(token, code)).body.code).toBe('CODE_EXPIRED');
  });

  it('refuses a second code within a minute, and tells the app how long to wait', async () => {
    const { token } = await signUp();
    const res = await sendCode(token);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('CODE_COOLDOWN');
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.body.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(mailer.outbox).toHaveLength(1); // no second email was sent
  });

  it('after the cooldown, a new code replaces the old one (only one stays active)', async () => {
    const { token, code: first } = await signUp();
    await ageActiveCode(61_000);
    expect((await sendCode(token)).status).toBe(200);
    const second = mailer.outbox.at(-1)!.text.match(/\b(\d{6})\b/)![1]!;
    expect(await prisma.oneTimeCode.count({ where: { consumedAt: null } })).toBe(1);
    if (second !== first) expect((await verify(token, first)).status).toBe(400); // old code is dead
    expect((await verify(token, second)).status).toBe(200);
  });

  it('does not send codes to someone who is already verified', async () => {
    const { token, code } = await signUp();
    await verify(token, code);
    const res = await sendCode(token);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_VERIFIED');
  });

  it("one user's code does not verify another user", async () => {
    const ana = await signUp('ana@example.com');
    const bob = await signUp('bob@example.com');
    const wrong = ana.code === bob.code ? '999999' : ana.code;
    expect((await verify(bob.token, wrong)).status).toBe(400);
    expect((await api(app).get('/auth/me').set(bearer(bob.token))).body.emailVerified).toBe(false);
  });

  it('requires login and a 6-digit code', async () => {
    const { token } = await signUp();
    expect((await api(app).post('/auth/email/verify').send({ code: '123456' })).status).toBe(401);
    expect((await sendCode('nope')).status).toBe(401);
    expect((await verify(token, '12ab56')).status).toBe(400);
    expect((await verify(token, '12345')).status).toBe(400);
  });
});
