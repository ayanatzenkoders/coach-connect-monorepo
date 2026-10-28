import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, login, bearer, seedUser, PASSWORD } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('RBAC and bans', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(prisma));

  const adminLogin = (email: string) => login(app, email, 'admin-device-1', '/admin/auth/login');

  async function setup() {
    const admin = await seedUser(prisma, 'admin@x.com', 'ADMIN');
    const support = await seedUser(prisma, 'support@x.com', 'SUPPORT');
    const member = await seedUser(prisma, 'member@x.com', 'MEMBER');
    const adminTok = (await adminLogin('admin@x.com')).body;
    const supportTok = (await adminLogin('support@x.com')).body;
    const memberTok = (await login(app, 'member@x.com')).body;
    return { admin, support, member, adminTok, supportTok, memberTok };
  }

  it('keeps the two worlds apart: staff cannot use the mobile login, members cannot use the admin login', async () => {
    await setup();
    expect((await login(app, 'admin@x.com')).status).toBe(401);
    expect((await adminLogin('member@x.com')).status).toBe(401);
  });

  it('a mobile token cannot open admin routes', async () => {
    const { member, memberTok } = await setup();
    const res = await api(app).get(`/admin/users/${member.id}`).set(bearer(memberTok.accessToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('WRONG_AUDIENCE');
  });

  it('routes marked audience "any" (me, logout) accept admin tokens too', async () => {
    const { adminTok } = await setup();
    expect((await api(app).get('/auth/me').set(bearer(adminTok.accessToken))).status).toBe(200);
  });

  it('Support can read a user but cannot ban (403 from the server, not just a hidden button)', async () => {
    const { member, supportTok } = await setup();
    expect((await api(app).get(`/admin/users/${member.id}`).set(bearer(supportTok.accessToken))).status).toBe(200);
    const ban = await api(app).post(`/admin/users/${member.id}/ban`).set(bearer(supportTok.accessToken)).send({ reason: 'Spam or scams' });
    expect(ban.status).toBe(403);
    expect(ban.body.code).toBe('FORBIDDEN_ROLE');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).bannedAt).toBeNull();
  });

  it('applies a role change immediately (role comes from the database, not the token)', async () => {
    const { admin, adminTok, member } = await setup();
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'SUPPORT' } }); // demoted
    const res = await api(app).post(`/admin/users/${member.id}/ban`).set(bearer(adminTok.accessToken)).send({ reason: 'Other' });
    expect(res.status).toBe(403);
  });

  it('BAN: takes effect on the very next request and shuts every door', async () => {
    const { admin, member, adminTok, memberTok } = await setup();
    // second device
    const second = (await login(app, 'member@x.com', 'device-bbbbbbbb')).body;

    // before the ban: works
    expect((await api(app).get('/auth/me').set(bearer(memberTok.accessToken))).status).toBe(200);

    const ban = await api(app).post(`/admin/users/${member.id}/ban`).set(bearer(adminTok.accessToken)).send({ reason: 'Harassment of a coach', note: 'report R-118' });
    expect(ban.status).toBe(200);
    expect(ban.body).toMatchObject({ alreadyBanned: false, revokedSessions: 2 });

    // 1) the still-unexpired access tokens stop working immediately, on both devices
    for (const tok of [memberTok, second]) {
      const me = await api(app).get('/auth/me').set(bearer(tok.accessToken));
      expect(me.status).toBe(401); // sessions were revoked in the same transaction
    }
    // 2) refresh tokens are dead
    expect((await api(app).post('/auth/refresh').send({ refreshToken: memberTok.refreshToken })).status).toBe(401);
    // 3) login says banned
    const again = await login(app, 'member@x.com');
    expect(again.status).toBe(403);
    expect(again.body.code).toBe('ACCOUNT_BANNED');
    // 4) side effects
    expect(await prisma.session.count({ where: { userId: member.id, revokedAt: null } })).toBe(0);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'user.ban' } });
    expect(audit).toMatchObject({ actorId: admin.id, targetId: member.id });
    // 5) banned_at is the only ban column; the reason lives in the audit entry and the admin detail reads it from there
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).bannedAt).not.toBeNull();
    expect(audit.metadata).toMatchObject({ reason: 'Harassment of a coach', note: 'report R-118' });
    const detail = await api(app).get(`/admin/users/${member.id}`).set(bearer(adminTok.accessToken));
    expect(detail.body).toMatchObject({ isBanned: true, banReason: 'Harassment of a coach', bannedById: admin.id });
  });

  it('BAN: reports ACCOUNT_BANNED even if the session was somehow still alive', async () => {
    const { member, memberTok } = await setup();
    // simulate a ban flag set without session revocation (defence in depth)
    await prisma.user.update({ where: { id: member.id }, data: { bannedAt: new Date() } });
    const me = await api(app).get('/auth/me').set(bearer(memberTok.accessToken));
    expect(me.status).toBe(403);
    expect(me.body.code).toBe('ACCOUNT_BANNED');
  });

  it('banning twice is harmless; unban lets the user sign in again with a NEW session', async () => {
    const { member, adminTok, memberTok } = await setup();
    const url = `/admin/users/${member.id}`;
    await api(app).post(`${url}/ban`).set(bearer(adminTok.accessToken)).send({ reason: 'Other' });
    const twice = await api(app).post(`${url}/ban`).set(bearer(adminTok.accessToken)).send({ reason: 'Other' });
    expect(twice.body.alreadyBanned).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: 'user.ban' } })).toBe(1);

    expect((await api(app).post(`${url}/unban`).set(bearer(adminTok.accessToken))).status).toBe(200);
    expect((await api(app).get('/auth/me').set(bearer(memberTok.accessToken))).status).toBe(401); // old session stays dead
    expect((await login(app, 'member@x.com')).status).toBe(200);
  });

  it('guards against banning yourself, other staff, or unknown users; validates the reason', async () => {
    const { admin, support, adminTok, member } = await setup();
    const ban = (id: string, body: object = { reason: 'Other' }) =>
      api(app).post(`/admin/users/${id}/ban`).set(bearer(adminTok.accessToken)).send(body);
    expect((await ban(admin.id)).body.code).toBe('CANNOT_BAN_SELF');
    expect((await ban(support.id)).body.code).toBe('CANNOT_BAN_STAFF');
    expect((await ban('3f1c2a9e-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await ban(member.id, { reason: 'because' })).status).toBe(400);
    expect((await ban('not-a-uuid')).status).toBe(400);
  });

  it('a banned user who has not logged in yet can never sign in', async () => {
    await seedUser(prisma, 'banned@x.com', 'MEMBER');
    await prisma.user.updateMany({ where: { email: 'banned@x.com' }, data: { bannedAt: new Date() } });
    const res = await api(app).post('/auth/login').send({ email: 'banned@x.com', password: PASSWORD, deviceId: 'device-aaaaaaaa' });
    expect(res.body.code).toBe('ACCOUNT_BANNED');
  });
});
