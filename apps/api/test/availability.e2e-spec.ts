import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, login, bearer, seedUser } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('coach availability ("Available now")', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(prisma));

  // Tokens are fetched BEFORE the request object exists (supertest closes its test server after each request).
  const token = async (email: string) => (await login(app, email)).body.accessToken as string;
  const setAvailable = async (email: string, body: unknown) => {
    const t = await token(email);
    return api(app).post('/coaches/me/availability').set(bearer(t)).send(body as object);
  };
  const me = async (email: string) => {
    const t = await token(email);
    return api(app).get('/auth/me').set(bearer(t));
  };
  const coach = async (email: string, over: { approved?: boolean; available?: boolean } = {}) => {
    const u = await seedUser(prisma, email, 'COACH', 'Carl Coach');
    await prisma.coachProfile.create({ data: { userId: u.id, approved: over.approved ?? true, available: over.available ?? false } });
    return u;
  };

  it('a coach switches it on and off, and /auth/me says which it is', async () => {
    const carl = await coach('carl@x.com');
    expect((await me('carl@x.com')).body.isAvailable).toBe(false);

    const on = await setAvailable('carl@x.com', { available: true });
    expect([on.status, on.body]).toEqual([200, { available: true }]);
    expect((await prisma.coachProfile.findUniqueOrThrow({ where: { userId: carl.id } })).available).toBe(true);
    expect((await me('carl@x.com')).body.isAvailable).toBe(true);

    expect((await setAvailable('carl@x.com', { available: false })).body).toEqual({ available: false });
    expect((await me('carl@x.com')).body.isAvailable).toBe(false);
  });

  it('saying the same thing twice is harmless', async () => {
    await coach('carl@x.com', { available: true });
    expect((await setAvailable('carl@x.com', { available: true })).status).toBe(200);
    expect((await setAvailable('carl@x.com', { available: true })).status).toBe(200);
  });

  it('members get 403 and nothing changes; /auth/me has no availability for them', async () => {
    await seedUser(prisma, 'mia@x.com', 'MEMBER', 'Mia');
    const res = await setAvailable('mia@x.com', { available: true });
    expect(res.status).toBe(403);
    expect((await me('mia@x.com')).body.isAvailable).toBeNull();
  });

  it('needs a login', async () => {
    expect((await api(app).post('/coaches/me/availability').send({ available: true })).status).toBe(401);
  });

  it('only the answer "true" or "false" is accepted, and no other field (400)', async () => {
    await coach('carl@x.com');
    for (const bad of [{}, { available: 'yes' }, { available: 1 }, { available: true, userId: 'someone-else' }]) {
      expect((await setAvailable('carl@x.com', bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('changes only MY profile: another coach stays as they were', async () => {
    await coach('carl@x.com');
    const other = await coach('lena@x.com', { available: true });
    await setAvailable('carl@x.com', { available: true });
    await setAvailable('carl@x.com', { available: false });
    expect((await prisma.coachProfile.findUniqueOrThrow({ where: { userId: other.id } })).available).toBe(true);
  });

  it('a coach still waiting for approval cannot use it (the gate answers 403)', async () => {
    await coach('pat@x.com', { approved: false });
    const res = await setAvailable('pat@x.com', { available: true });
    expect([res.status, res.body.code]).toEqual([403, 'COACH_PENDING_APPROVAL']);
  });

  it('People shows the change to members straight away, in the list and under "available now"', async () => {
    await seedUser(prisma, 'mia@x.com', 'MEMBER', 'Mia');
    await coach('carl@x.com');
    const view = async (query: string) => {
      const t = await token('mia@x.com');
      return api(app).get(`/people?kind=coaches${query}`).set(bearer(t));
    };
    expect((await view('&available=true')).body.items).toHaveLength(0);
    await setAvailable('carl@x.com', { available: true });
    const on = await view('&available=true');
    expect(on.body.items.map((c: { name: string }) => c.name)).toEqual(['Carl Coach']);
    await setAvailable('carl@x.com', { available: false });
    expect((await view('&available=true')).body.items).toHaveLength(0);
    expect((await view('')).body.items[0]).toMatchObject({ name: 'Carl Coach', available: false }); // still listed, call button off
  });
});
