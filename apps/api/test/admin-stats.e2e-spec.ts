import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, login, bearer, seedUser } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('admin: dashboard numbers (GET /admin/stats)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(prisma));

  // The token is fetched BEFORE the request object exists (supertest closes its test server after each request).
  const staffToken = async (email: string) => (await login(app, email, 'admin-device-1', '/admin/auth/login')).body.accessToken as string;
  const stats = async (email = 'admin@x.com') => {
    const token = await staffToken(email);
    return api(app).get('/admin/stats').set(bearer(token));
  };
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const age = (email: string, days: number) => prisma.user.updateMany({ where: { email }, data: { createdAt: daysAgo(days) } });

  async function staff() {
    await seedUser(prisma, 'admin@x.com', 'ADMIN', 'Alex Admin');
    await seedUser(prisma, 'support@x.com', 'SUPPORT', 'Sam Support');
  }

  it('needs a staff token: none 401, a member 403; Support may read', async () => {
    await staff();
    await seedUser(prisma, 'mia@x.com', 'MEMBER', 'Mia');
    expect((await api(app).get('/admin/stats')).status).toBe(401);
    const memberToken = (await login(app, 'mia@x.com')).body.accessToken as string;
    expect((await api(app).get('/admin/stats').set(bearer(memberToken))).status).toBe(403);
    expect((await stats('support@x.com')).status).toBe(200);
  });

  it('an empty system is all zeros, with 14 chart days', async () => {
    await staff();
    const res = await stats();
    expect(res.body.users).toEqual({ members: 0, approvedCoaches: 0, pendingCoaches: 0, unverified: 0, banned: 0 });
    expect(res.body.chats).toEqual({ direct: 0, group: 0, active7Days: 0 });
    expect(res.body.messages).toEqual({ last24Hours: 0, last7Days: 0 });
    expect(res.body.awaitingApproval).toEqual([]);
    expect(res.body.signups.daily).toHaveLength(14);
    expect(res.body.signups.daily.every((d: { count: number }) => d.count === 0)).toBe(true);
  });

  it('counts members and coaches, never staff or deleted accounts', async () => {
    await staff();
    await seedUser(prisma, 'm1@x.com', 'MEMBER', 'M1');
    await seedUser(prisma, 'm2@x.com', 'MEMBER', 'M2');
    const gone = await seedUser(prisma, 'gone@x.com', 'MEMBER', 'Gone');
    await prisma.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    const res = await stats();
    expect(res.body.users.members).toBe(2);
    expect(res.body.signups.last7Days).toBe(2);
  });

  it('splits coaches into approved and pending (a coach with no profile row is pending), and counts unverified and banned', async () => {
    await staff();
    const approved = await seedUser(prisma, 'c1@x.com', 'COACH', 'Approved Coach');
    await prisma.coachProfile.create({ data: { userId: approved.id, approved: true } });
    const waiting = await seedUser(prisma, 'c2@x.com', 'COACH', 'Waiting Coach');
    await prisma.coachProfile.create({ data: { userId: waiting.id, approved: false } });
    await seedUser(prisma, 'c3@x.com', 'COACH', 'No Profile Coach');
    const verified = await seedUser(prisma, 'm1@x.com', 'MEMBER', 'Verified');
    await prisma.user.update({ where: { id: verified.id }, data: { emailVerifiedAt: new Date() } });
    await prisma.user.updateMany({ where: { email: { in: ['c1@x.com', 'c2@x.com', 'c3@x.com'] } }, data: { emailVerifiedAt: new Date() } });
    const banned = await seedUser(prisma, 'm2@x.com', 'MEMBER', 'Banned');
    await prisma.user.update({ where: { id: banned.id }, data: { bannedAt: new Date() } });

    const { users } = (await stats()).body;
    expect(users).toEqual({ members: 2, approvedCoaches: 1, pendingCoaches: 2, unverified: 1, banned: 1 }); // only m2 (banned) never verified
  });

  it('signups: last 7 days excludes older accounts, and the chart has a bar per day, today included', async () => {
    await staff();
    await seedUser(prisma, 'new@x.com', 'MEMBER', 'New');
    await seedUser(prisma, 'mid@x.com', 'MEMBER', 'Mid');
    await seedUser(prisma, 'old@x.com', 'MEMBER', 'Old');
    await age('mid@x.com', 3);
    await age('old@x.com', 10);
    const { signups } = (await stats()).body;
    expect(signups.last7Days).toBe(2);
    const byDate = Object.fromEntries(signups.daily.map((d: { date: string; count: number }) => [d.date, d.count]));
    const dayOf = (n: number) => daysAgo(n).toISOString().slice(0, 10);
    expect(byDate[dayOf(0)]).toBe(1);
    expect(byDate[dayOf(3)]).toBe(1);
    expect(byDate[dayOf(10)]).toBe(1); // inside the 14-day chart, outside the 7-day number
    const dates: string[] = signups.daily.map((d: { date: string }) => d.date);
    expect(dates).toEqual(dates.toSorted((a, b) => a.localeCompare(b))); // oldest first
    expect(signups.daily[13].date).toBe(dayOf(0));
  });

  it('chats and messages: direct vs group, active in the last 7 days, messages in 24 hours and 7 days', async () => {
    await staff();
    await seedUser(prisma, 'ann@x.com', 'MEMBER', 'Ann');
    const ben = await seedUser(prisma, 'ben@x.com', 'MEMBER', 'Ben');
    const cara = await seedUser(prisma, 'cara@x.com', 'MEMBER', 'Cara');
    const dan = await seedUser(prisma, 'dan@x.com', 'MEMBER', 'Dan');
    const annToken = (await login(app, 'ann@x.com')).body.accessToken as string;
    const annChat = await api(app).post('/chats').set(bearer(annToken)).send({ userId: ben.id });
    const quiet = await api(app).post('/chats').set(bearer(annToken)).send({ userId: cara.id });
    await api(app).post('/chats/groups').set(bearer(annToken)).send({ title: 'Team', memberIds: [ben.id, dan.id] });
    for (const body of ['one', 'two', 'three']) {
      await api(app).post(`/chats/${annChat.body.id}/messages`).set(bearer(annToken)).send({ clientMessageId: `client-${body}-12345`, body });
    }
    await api(app).post(`/chats/${quiet.body.id}/messages`).set(bearer(annToken)).send({ clientMessageId: 'client-old-12345', body: 'old one' });
    // Age: "three" to 3 days ago (inside 7d, outside 24h); the quiet chat's only message to 9 days ago.
    await prisma.message.updateMany({ where: { body: 'three' }, data: { createdAt: daysAgo(3) } });
    await prisma.message.updateMany({ where: { body: 'old one' }, data: { createdAt: daysAgo(9) } });

    const { chats, messages } = (await stats()).body;
    expect(chats).toEqual({ direct: 2, group: 1, active7Days: 1 });
    expect(messages).toEqual({ last24Hours: 2, last7Days: 3 });
  });

  it('awaiting approval: oldest application first, at most 5, never approved or banned coaches', async () => {
    await staff();
    for (let i = 1; i <= 7; i++) {
      const c = await seedUser(prisma, `w${i}@x.com`, 'COACH', `Waiting ${i}`);
      await prisma.coachProfile.create({ data: { userId: c.id, approved: false } });
    }
    const done = await seedUser(prisma, 'done@x.com', 'COACH', 'Done');
    await prisma.coachProfile.create({ data: { userId: done.id, approved: true } });
    const banned = await seedUser(prisma, 'bad@x.com', 'COACH', 'Banned Waiting');
    await prisma.coachProfile.create({ data: { userId: banned.id, approved: false } });
    await prisma.user.update({ where: { id: banned.id }, data: { bannedAt: new Date() } });

    const res = await stats();
    expect(res.body.users.pendingCoaches).toBe(8); // the banned one is still a pending coach in the number...
    expect(res.body.awaitingApproval.map((c: { name: string }) => c.name)).toEqual(['Waiting 1', 'Waiting 2', 'Waiting 3', 'Waiting 4', 'Waiting 5']); // ...but not in the to-do list
    expect(res.body.awaitingApproval[0]).toMatchObject({ email: 'w1@x.com' });
  });
});
