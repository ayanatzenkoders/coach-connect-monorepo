import type { INestApplication } from '@nestjs/common';
import { vi } from 'vitest';
import { createApp, resetDb, api, login, bearer, seedUser, PASSWORD } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MailerService } from '../src/mail/mailer.service.js';

describe('coach sign-up, approval and the pending gate', () => {
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

  const APPLICATION = {
    email: 'carl@x.com',
    password: PASSWORD,
    name: 'Carl Coach',
    dateOfBirth: '1985-03-09',
    phone: '+49 170 1234567',
    bio: 'I help people prepare for hard career conversations.',
    specialties: ['Burnout', 'Salary talks'],
    deviceId: 'device-coach-1',
  };
  const apply = (over: Record<string, unknown> = {}) => api(app).post('/auth/register-coach').send({ ...APPLICATION, ...over });
  const codeFor = (email: string) => mailer.outbox.filter((m) => m.to === email && /verification/i.test(m.subject)).at(-1)?.text.match(/\b(\d{6})\b/)?.[1] ?? '';
  const verify = (token: string, code: string) => api(app).post('/auth/email/verify').set(bearer(token)).send({ code });
  const adminToken = async () => (await login(app, 'admin@x.com', 'admin-device-1', '/admin/auth/login')).body.accessToken as string;

  // The token is fetched BEFORE the request object exists (supertest closes its test server after each request).
  const asAdmin = async (method: 'get' | 'post', path: string) => {
    const token = await adminToken();
    return api(app)[method](path).set(bearer(token));
  };

  /** An admin plus an applicant who has verified their email (the usual "waiting" state). */
  async function waitingCoach() {
    await seedUser(prisma, 'admin@x.com', 'ADMIN', 'Alex Admin');
    const res = await apply();
    await verify(res.body.accessToken, codeFor('carl@x.com'));
    return { id: res.body.user.id as string, token: res.body.accessToken as string };
  }

  describe('applying', () => {
    it('creates an UNAPPROVED coach with everything they wrote, and emails the verification code', async () => {
      const res = await apply();
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ role: 'COACH', emailVerified: false, pendingApproval: true });
      const row = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id }, include: { coachProfile: true } });
      expect(row).toMatchObject({ phone: '+49 170 1234567', role: 'COACH' });
      expect(row.dateOfBirth?.toISOString().slice(0, 10)).toBe('1985-03-09');
      expect(row.coachProfile).toMatchObject({ approved: false, available: false, bio: APPLICATION.bio, specialties: ['Burnout', 'Salary talks'] });
      expect(codeFor('carl@x.com')).toMatch(/^\d{6}$/);
    });

    it('refuses a bad application (400, nothing saved) and a taken email (409)', async () => {
      for (const bad of [{ phone: 'abc' }, { bio: 'short' }, { specialties: [] }, { specialties: ['Not a topic'] }, { dateOfBirth: '2999-01-01' }, { role: 'ADMIN' }]) {
        expect((await apply(bad)).status, JSON.stringify(bad)).toBe(400);
      }
      expect(await prisma.user.count()).toBe(0);
      await apply();
      expect((await apply({ email: 'CARL@x.com' })).status).toBe(409);
    });

    it('a member can also sign up with a date of birth, and it is required', async () => {
      const ok = await api(app).post('/auth/register').send({ email: 'm@x.com', password: PASSWORD, name: 'Mia', dateOfBirth: '2001-12-31', deviceId: 'device-aaaaaaaa' });
      expect(ok.status).toBe(201);
      expect(ok.body.user.pendingApproval).toBe(false);
      expect((await prisma.user.findFirstOrThrow({ where: { email: 'm@x.com' } })).dateOfBirth?.toISOString().slice(0, 10)).toBe('2001-12-31');
      const missing = await api(app).post('/auth/register').send({ email: 'n@x.com', password: PASSWORD, name: 'Nia', deviceId: 'device-aaaaaaaa' });
      expect(missing.status).toBe(400);
    });
  });

  describe('waiting for approval: they cannot use the app', () => {
    it('before verifying the email the applicant can still verify (and read who they are)', async () => {
      const res = await apply();
      const me = await api(app).get('/auth/me').set(bearer(res.body.accessToken));
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ role: 'COACH', pendingApproval: true });
      expect((await verify(res.body.accessToken, codeFor('carl@x.com'))).body).toEqual({ emailVerified: true });
    });

    it('every other route answers 403 COACH_PENDING_APPROVAL, before and after verifying', async () => {
      const { token } = await waitingCoach();
      for (const path of ['/people', '/chats']) {
        const res = await api(app).get(path).set(bearer(token));
        expect([res.status, res.body.code], path).toEqual([403, 'COACH_PENDING_APPROVAL']);
      }
    });

    it('cannot sign in again once verified: 403, and no session is created', async () => {
      await waitingCoach();
      const before = await prisma.session.count({ where: { user: { email: 'carl@x.com' } } });
      const res = await login(app, 'carl@x.com', 'device-coach-2');
      expect([res.status, res.body.code]).toEqual([403, 'COACH_PENDING_APPROVAL']);
      expect(await prisma.session.count({ where: { user: { email: 'carl@x.com' } } })).toBe(before);
      // A wrong password still looks like any other wrong password: nothing about the account leaks.
      const wrong = await api(app).post('/auth/login').send({ email: 'carl@x.com', password: 'Wrong-pass-1', deviceId: 'device-coach-2' });
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('an applicant who has NOT verified yet may sign in again to finish verifying', async () => {
      await apply();
      const res = await login(app, 'carl@x.com', 'device-coach-2');
      expect(res.status).toBe(200);
      expect(res.body.user.pendingApproval).toBe(true);
    });

    it('is invisible to members in the People list', async () => {
      await waitingCoach();
      await seedUser(prisma, 'mia@x.com', 'MEMBER', 'Mia');
      const memberToken = (await login(app, 'mia@x.com')).body.accessToken as string;
      const res = await api(app).get('/people?kind=coaches').set(bearer(memberToken));
      expect(res.body.items.map((p: { name: string }) => p.name)).not.toContain('Carl Coach');
    });
  });

  describe('approval', () => {
    it('emails the coach, makes them visible, and lets them sign in', async () => {
      const { id } = await waitingCoach();
      mailer.outbox.length = 0;
      const res = await asAdmin('post', `/admin/coaches/${id}/approve`);
      expect(res.body).toEqual({ isApproved: true, changed: true });

      const mail = mailer.outbox.find((m) => m.to === 'carl@x.com');
      expect(mail?.subject).toBe('Your Coach Connect application is approved');
      expect(mail?.text).toContain('Carl Coach');
      expect(mail?.text).toMatch(/sign in/i);

      const signIn = await login(app, 'carl@x.com', 'device-coach-2');
      expect(signIn.status).toBe(200);
      expect(signIn.body.user.pendingApproval).toBe(false);
      expect((await api(app).get('/chats').set(bearer(signIn.body.accessToken))).status).toBe(200);

      await seedUser(prisma, 'mia@x.com', 'MEMBER', 'Mia');
      const memberToken = (await login(app, 'mia@x.com')).body.accessToken as string;
      const people = await api(app).get('/people?kind=coaches').set(bearer(memberToken));
      expect(people.body.items.map((p: { name: string }) => p.name)).toContain('Carl Coach');
    });

    it('the token the coach already held starts working the moment they are approved', async () => {
      const { id, token } = await waitingCoach();
      await asAdmin('post', `/admin/coaches/${id}/approve`);
      expect((await api(app).get('/chats').set(bearer(token))).status).toBe(200);
    });

    it('approving twice sends only one email', async () => {
      const { id } = await waitingCoach();
      const token = await adminToken();
      mailer.outbox.length = 0;
      await api(app).post(`/admin/coaches/${id}/approve`).set(bearer(token));
      await api(app).post(`/admin/coaches/${id}/approve`).set(bearer(token));
      expect(mailer.outbox.filter((m) => m.to === 'carl@x.com')).toHaveLength(1);
    });

    it('if the email cannot be sent the coach is still approved', async () => {
      const { id } = await waitingCoach();
      const send = vi.spyOn(mailer, 'send').mockRejectedValueOnce(new Error('smtp down'));
      const res = await asAdmin('post', `/admin/coaches/${id}/approve`);
      expect(res.status).toBe(200);
      expect((await prisma.coachProfile.findUniqueOrThrow({ where: { userId: id } })).approved).toBe(true);
      send.mockRestore();
    });
  });

  describe('what the admin sees', () => {
    it('the list shows the verification state, birth date, the coach details and, for ADMINs only, the phone', async () => {
      const { id } = await waitingCoach();
      await seedUser(prisma, 'support@x.com', 'SUPPORT', 'Sam Support');
      const adminView = await asAdmin('get', '/admin/users?role=COACH');
      expect(adminView.body.items[0]).toMatchObject({
        id,
        isApproved: false,
        emailVerified: true,
        phone: '+49 170 1234567',
        dateOfBirth: '1985-03-09',
        coach: { bio: APPLICATION.bio, specialties: ['Burnout', 'Salary talks'] },
      });
      const supportToken = (await login(app, 'support@x.com', 'support-device-1', '/admin/auth/login')).body.accessToken as string;
      const asSupport = await api(app).get('/admin/users?role=COACH').set(bearer(supportToken));
      expect(asSupport.body.items[0].phone).toBeNull(); // Support never sees the phone
      expect(asSupport.body.items[0].dateOfBirth).toBe('1985-03-09');
    });

    it('members and coaches never get anyone\'s phone or birth date from the People list', async () => {
      await waitingCoach();
      await prisma.coachProfile.update({ where: { userId: (await prisma.user.findFirstOrThrow({ where: { email: 'carl@x.com' } })).id }, data: { approved: true } });
      await seedUser(prisma, 'mia@x.com', 'MEMBER', 'Mia');
      const memberToken = (await login(app, 'mia@x.com')).body.accessToken as string;
      const text = JSON.stringify((await api(app).get('/people?kind=coaches').set(bearer(memberToken))).body);
      expect(text).not.toContain('1234567');
      expect(text).not.toContain('1985');
    });

    it('status=unverified lists only people who never typed their code; status=pending the unapproved coaches; status=banned the banned', async () => {
      await seedUser(prisma, 'admin@x.com', 'ADMIN', 'Alex Admin');
      const unverified = await api(app).post('/auth/register').send({ email: 'u@x.com', password: PASSWORD, name: 'Una Unverified', dateOfBirth: '1999-01-01', deviceId: 'device-aaaaaaaa' });
      await seedUser(prisma, 'ok@x.com', 'MEMBER', 'Olive Okay');
      await prisma.user.updateMany({ where: { email: 'ok@x.com' }, data: { emailVerifiedAt: new Date() } });
      await apply(); // pending AND unverified
      const banned = await seedUser(prisma, 'bad@x.com', 'MEMBER', 'Bo Banned');
      await prisma.user.update({ where: { id: banned.id }, data: { bannedAt: new Date() } });
      const token = await adminToken();
      const names = async (status: string) => ((await api(app).get(`/admin/users?status=${status}`).set(bearer(token))).body.items as { name: string }[]).map((u) => u.name).sort();

      expect(await names('unverified')).toEqual(expect.arrayContaining(['Carl Coach', 'Una Unverified']));
      expect(await names('unverified')).not.toContain('Olive Okay');
      expect(await names('pending')).toEqual(['Carl Coach']);
      expect(await names('banned')).toEqual(['Bo Banned']);
      expect(unverified.status).toBe(201);
    });
  });
});
