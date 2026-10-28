import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, login, bearer, seedUser } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('admin: user list and coach approval', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(prisma));

  const adminLogin = async (email: string) => (await login(app, email, 'admin-device-1', '/admin/auth/login')).body.accessToken as string;
  const list = (token: string, query = '') => api(app).get(`/admin/users${query}`).set(bearer(token));
  const approve = (token: string, id: string) => api(app).post(`/admin/coaches/${id}/approve`).set(bearer(token));

  /** An admin, a support agent, a member, a coach with a profile (pending) and a coach with NO profile row. */
  async function setup() {
    const admin = await seedUser(prisma, 'admin@x.com', 'ADMIN', 'Alex Admin');
    const support = await seedUser(prisma, 'support@x.com', 'SUPPORT', 'Sam Support');
    const member = await seedUser(prisma, 'member@x.com', 'MEMBER', 'Mia Member');
    const coach = await seedUser(prisma, 'coach@x.com', 'COACH', 'Carl Coach');
    const bare = await seedUser(prisma, 'bare@x.com', 'COACH', 'Bea Bare');
    await prisma.coachProfile.create({ data: { userId: coach.id, approved: false } });
    return { admin, support, member, coach, bare, adminToken: await adminLogin('admin@x.com'), supportToken: await adminLogin('support@x.com') };
  }

  describe('GET /admin/users', () => {
    it('needs a staff token: no token 401, a mobile (member) token 403', async () => {
      await setup();
      expect((await api(app).get('/admin/users')).status).toBe(401);
      const memberToken = (await login(app, 'member@x.com')).body.accessToken as string;
      const res = await list(memberToken);
      expect([res.status, res.body.code]).toEqual([403, 'WRONG_AUDIENCE']);
    });

    it('Support can read the list (read-only access)', async () => {
      const { supportToken } = await setup();
      const res = await list(supportToken);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(5);
    });

    it('returns the fields the panel needs, newest first, and no secrets', async () => {
      const { adminToken, member, coach, bare } = await setup();
      const res = await list(adminToken);
      expect(res.body.items.map((u: { email: string }) => u.email)).toEqual(['bare@x.com', 'coach@x.com', 'member@x.com', 'support@x.com', 'admin@x.com']);
      const byEmail = Object.fromEntries(res.body.items.map((u: { email: string }) => [u.email, u]));
      expect(byEmail['member@x.com']).toMatchObject({ id: member.id, name: 'Mia Member', role: 'MEMBER', bannedAt: null, isApproved: null });
      expect(byEmail['coach@x.com']).toMatchObject({ id: coach.id, isApproved: false });
      expect(byEmail['bare@x.com']).toMatchObject({ id: bare.id, isApproved: false }); // no profile row = not approved
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$argon2/);
    });

    it('searches names and emails, any capitalisation, and treats % and _ as plain characters', async () => {
      const { adminToken } = await setup();
      expect((await list(adminToken, '?q=MIA')).body.items.map((u: { email: string }) => u.email)).toEqual(['member@x.com']);
      expect((await list(adminToken, '?q=support@')).body.items).toHaveLength(1);
      expect((await list(adminToken, '?q=%25')).body.items).toHaveLength(0); // "%" is not a wildcard
    });

    it('filters by role, by banned, and by "pending approval" (including a coach with no profile)', async () => {
      const { adminToken, member } = await setup();
      expect((await list(adminToken, '?role=COACH')).body.items).toHaveLength(2);
      await prisma.user.update({ where: { id: member.id }, data: { bannedAt: new Date() } });
      expect((await list(adminToken, '?status=banned')).body.items.map((u: { email: string }) => u.email)).toEqual(['member@x.com']);
      expect((await list(adminToken, '?status=pending')).body.items.map((u: { email: string }) => u.email).sort()).toEqual(['bare@x.com', 'coach@x.com']);
      expect((await list(adminToken, '?status=pending&role=MEMBER')).body.items).toEqual([]); // filters combine
    });

    it('leaves out deleted accounts', async () => {
      const { adminToken, member } = await setup();
      await prisma.user.update({ where: { id: member.id }, data: { deletedAt: new Date() } });
      expect((await list(adminToken)).body.items.map((u: { email: string }) => u.email)).not.toContain('member@x.com');
    });

    it('pages with a cursor: no repeats, no gaps, and the last page has nextCursor null', async () => {
      const { adminToken } = await setup();
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const res = await list(adminToken, `?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
        seen.push(...res.body.items.map((u: { email: string }) => u.email));
        cursor = res.body.nextCursor;
        pages++;
      } while (cursor);
      expect(pages).toBe(3);
      expect(new Set(seen).size).toBe(5);
      expect(seen).toHaveLength(5);
    });

    it('rejects a bad query: unknown role/status, an invalid cursor, a limit over 100', async () => {
      const { adminToken } = await setup();
      for (const q of ['?role=OWNER', '?status=deleted', '?cursor=not-an-id', '?limit=101', '?sort=name']) {
        expect((await list(adminToken, q)).status).toBe(400);
      }
    });
  });

  describe('POST /admin/coaches/:id/approve', () => {
    it('Admin approves a coach: the coach now appears in the mobile People list; banning them removes them again', async () => {
      const { adminToken, coach } = await setup();
      await seedUser(prisma, 'viewer@x.com', 'MEMBER', 'Vic Viewer');
      const viewer = (await login(app, 'viewer@x.com')).body.accessToken as string;
      const coachesSeenByMembers = async () => (await api(app).get('/people?kind=coaches').set(bearer(viewer))).body.items.map((c: { id: string }) => c.id);

      expect(await coachesSeenByMembers()).not.toContain(coach.id);
      const ok = await approve(adminToken, coach.id);
      expect([ok.status, ok.body]).toEqual([200, { isApproved: true, changed: true }]);
      expect(await coachesSeenByMembers()).toContain(coach.id);

      // There is no "un-approve": taking a coach away is a ban.
      expect((await api(app).post(`/admin/coaches/${coach.id}/unapprove`).set(bearer(adminToken))).status).toBe(404); // the route no longer exists
      await api(app).post(`/admin/users/${coach.id}/ban`).set(bearer(adminToken)).send({ reason: 'Other' });
      expect(await coachesSeenByMembers()).not.toContain(coach.id);
    });

    it('creates the profile when a coach had none, and shows "approved" in the list', async () => {
      const { adminToken, bare } = await setup();
      await approve(adminToken, bare.id);
      expect(await prisma.coachProfile.findUnique({ where: { userId: bare.id } })).toMatchObject({ approved: true });
      const row = (await list(adminToken, '?q=bare@')).body.items[0];
      expect(row.isApproved).toBe(true);
    });

    it('is safe to repeat: the second approve changes nothing and writes no second audit entry', async () => {
      const { adminToken, admin, coach } = await setup();
      await approve(adminToken, coach.id);
      const again = await approve(adminToken, coach.id);
      expect(again.body).toEqual({ isApproved: true, changed: false });
      const entries = await prisma.auditLog.findMany({ where: { action: 'coach.approve', targetId: coach.id } });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ actorId: admin.id, targetType: 'user' });
    });

    it('writes an audit entry for the approval and for the ban, with who did it', async () => {
      const { adminToken, admin, coach } = await setup();
      await approve(adminToken, coach.id);
      await api(app).post(`/admin/users/${coach.id}/ban`).set(bearer(adminToken)).send({ reason: 'Spam or scams' });
      const actions = (await prisma.auditLog.findMany({ where: { targetId: coach.id }, orderBy: { createdAt: 'asc' } })).map((a) => [a.action, a.actorId]);
      expect(actions).toEqual([['coach.approve', admin.id], ['user.ban', admin.id]]);
    });

    it('Support cannot approve (403 from the server, not just a hidden button); a member token cannot either', async () => {
      const { supportToken, coach } = await setup();
      expect((await approve(supportToken, coach.id)).status).toBe(403);
      const memberToken = (await login(app, 'member@x.com')).body.accessToken as string;
      expect((await approve(memberToken, coach.id)).status).toBe(403);
      expect(await prisma.coachProfile.findUnique({ where: { userId: coach.id } })).toMatchObject({ approved: false });
      expect(await prisma.auditLog.count({ where: { action: 'coach.approve' } })).toBe(0);
    });

    it('only coaches can be approved, and an unknown or deleted user is 404', async () => {
      const { adminToken, member, coach } = await setup();
      const notCoach = await approve(adminToken, member.id);
      expect([notCoach.status, notCoach.body.code]).toEqual([400, 'NOT_A_COACH']);
      const missing = await approve(adminToken, '0194f3a0-0000-7000-8000-000000000000');
      expect([missing.status, missing.body.code]).toEqual([404, 'USER_NOT_FOUND']);
      await prisma.user.update({ where: { id: coach.id }, data: { deletedAt: new Date() } });
      expect((await approve(adminToken, coach.id)).status).toBe(404);
      expect((await approve(adminToken, 'not-an-id')).status).toBe(400);
    });
  });
});
