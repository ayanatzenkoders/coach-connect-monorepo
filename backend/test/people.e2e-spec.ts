import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, login, bearer, seedUser } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('GET /people', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(prisma));

  const coach = async (email: string, name: string, approved = true) => {
    const u = await seedUser(prisma, email, 'COACH', name);
    await prisma.coachProfile.create({ data: { userId: u.id, specialties: ['Career'], approved, available: true } });
    return u;
  };
  const list = async (as: string, kind: string) => {
    const tok = (await login(app, as)).body.accessToken;
    return api(app).get(`/people?kind=${kind}`).set(bearer(tok));
  };
  const names = (res: { body: { items: { name: string }[] } }) => res.body.items.map((i) => i.name);

  it('requires login', async () => {
    expect((await api(app).get('/people?kind=coaches')).status).toBe(401);
  });

  it('lists approved coaches only, with their profile and no private data', async () => {
    await seedUser(prisma, 'me@x.com', 'MEMBER', 'Me');
    await coach('a@x.com', 'Amara');
    await coach('p@x.com', 'Pending Coach', false);
    const res = await list('me@x.com', 'coaches');
    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Amara']);
    expect(res.body.items[0]).toMatchObject({ role: 'COACH', specialties: ['Career'], available: true });
    expect(JSON.stringify(res.body)).not.toContain('@x.com'); // no emails
    expect(res.body.total).toBe(1);
  });

  it('lists members but never myself, coaches, staff, banned or deleted people', async () => {
    await seedUser(prisma, 'me@x.com', 'MEMBER', 'Me');
    await seedUser(prisma, 'b@x.com', 'MEMBER', 'Bob');
    await seedUser(prisma, 'c@x.com', 'MEMBER', 'Cara');
    await seedUser(prisma, 'banned@x.com', 'MEMBER', 'Banned');
    await seedUser(prisma, 'gone@x.com', 'MEMBER', 'Gone');
    await seedUser(prisma, 'staff@x.com', 'ADMIN', 'Staff');
    await coach('a@x.com', 'Amara');
    await prisma.user.updateMany({ where: { email: 'banned@x.com' }, data: { isBanned: true, bannedAt: new Date() } });
    await prisma.user.updateMany({ where: { email: 'gone@x.com' }, data: { deletedAt: new Date() } });
    expect(names(await list('me@x.com', 'members'))).toEqual(['Bob', 'Cara']);
  });

  it('hides blocked people in BOTH directions', async () => {
    const me = await seedUser(prisma, 'me@x.com', 'MEMBER', 'Me');
    const bob = await seedUser(prisma, 'b@x.com', 'MEMBER', 'Bob');
    const cara = await seedUser(prisma, 'c@x.com', 'MEMBER', 'Cara');
    await seedUser(prisma, 'd@x.com', 'MEMBER', 'Dan');
    await prisma.block.create({ data: { blockerId: me.id, blockedId: bob.id } }); // I blocked Bob
    await prisma.block.create({ data: { blockerId: cara.id, blockedId: me.id } }); // Cara blocked me
    expect(names(await list('me@x.com', 'members'))).toEqual(['Dan']);
    // and Bob/Cara do not see me either
    expect(names(await list('b@x.com', 'members'))).not.toContain('Me');
    expect(names(await list('c@x.com', 'members'))).not.toContain('Me');
  });

  it('a coach can open the People list too, and bad input is rejected', async () => {
    await coach('a@x.com', 'Amara');
    await seedUser(prisma, 'me@x.com', 'MEMBER', 'Me');
    expect((await list('a@x.com', 'members')).status).toBe(200);
    const tok = (await login(app, 'me@x.com')).body.accessToken;
    expect((await api(app).get('/people?kind=robots').set(bearer(tok))).status).toBe(400);
    expect((await api(app).get('/people?kind=coaches&limit=999').set(bearer(tok))).status).toBe(400);
  });

  it('respects limit but reports the full total', async () => {
    await seedUser(prisma, 'me@x.com', 'MEMBER', 'Me');
    for (const n of ['A', 'B', 'C']) await seedUser(prisma, `${n.toLowerCase()}@x.com`, 'MEMBER', n);
    const tok = (await login(app, 'me@x.com')).body.accessToken;
    const res = await api(app).get('/people?kind=members&limit=2').set(bearer(tok));
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });
});
