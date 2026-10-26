import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, login, bearer, seedUser, PASSWORD } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { REFRESH_GRACE_MS } from '../src/auth/auth.service.js';

describe('Auth: register, login, token lifecycle', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(prisma));

  const register = (email = 'ana@example.com', deviceId = 'device-aaaaaaaa') =>
    api(app).post('/auth/register').send({ email, password: PASSWORD, name: 'Ana', deviceId });

  it('registers a MEMBER, returns tokens, and /auth/me works', async () => {
    const res = await register('Ana@Example.com'); // mixed case on purpose
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'ana@example.com', role: 'MEMBER' });
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toContain('.');
    expect(res.body).not.toHaveProperty('user.passwordHash');

    const me = await api(app).get('/auth/me').set(bearer(res.body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'ana@example.com', canCall: false, subscription: null });
  });

  it('never stores the password or the refresh secret in plain text', async () => {
    const res = await register();
    const user = await prisma.user.findFirstOrThrow({ where: { email: 'ana@example.com' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    const secret = res.body.refreshToken.split('.')[1];
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.refreshHash).not.toContain(secret);
    expect(session.refreshHash).toHaveLength(64); // sha256 hex
  });

  it('rejects duplicate email regardless of case, and bad input', async () => {
    await register('ana@example.com');
    expect((await register('ANA@example.com')).status).toBe(409);
    const bad = await api(app).post('/auth/register').send({ email: 'nope', password: '123', name: '', deviceId: 'x' });
    expect(bad.status).toBe(400);
    const extra = await api(app).post('/auth/register').send({ email: 'b@example.com', password: PASSWORD, name: 'B', deviceId: 'device-bbbbbbbb', role: 'ADMIN' });
    expect(extra.status).toBe(400); // cannot sneak in a role field
  });

  it('gives the same error for wrong password and unknown email', async () => {
    await register();
    const wrong = await api(app).post('/auth/login').send({ email: 'ana@example.com', password: 'Wrong-pass-1', deviceId: 'device-aaaaaaaa' });
    const unknown = await api(app).post('/auth/login').send({ email: 'ghost@example.com', password: 'Wrong-pass-1', deviceId: 'device-aaaaaaaa' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body).toEqual(wrong.body);
  });

  it('rotates the refresh token on every use', async () => {
    const first = (await register()).body;
    const second = await api(app).post('/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(second.status).toBe(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);
    const me = await api(app).get('/auth/me').set(bearer(second.body.accessToken));
    expect(me.status).toBe(200);
  });

  it('tolerates a retry of the previous token inside the grace window (lost response)', async () => {
    const first = (await register()).body;
    await api(app).post('/auth/refresh').send({ refreshToken: first.refreshToken });
    const retry = await api(app).post('/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(retry.status).toBe(200);
  });

  it('treats an old token used AFTER the grace window as theft and kills the whole session', async () => {
    const first = (await register()).body;
    const second = (await api(app).post('/auth/refresh').send({ refreshToken: first.refreshToken })).body;
    // pretend the rotation happened a minute ago
    await prisma.session.updateMany({ data: { rotatedAt: new Date(Date.now() - REFRESH_GRACE_MS - 5_000) } });

    const replay = await api(app).post('/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_REUSED');

    // even the legitimate newest token is now dead, and so is its access token
    const legit = await api(app).post('/auth/refresh').send({ refreshToken: second.refreshToken });
    expect(legit.status).toBe(401);
    expect((await api(app).get('/auth/me').set(bearer(second.accessToken))).status).toBe(401);
    expect((await prisma.session.findFirstOrThrow()).revokedReason).toBe('REUSE_DETECTED');
    expect(await prisma.auditLog.count({ where: { action: 'session.reuse_detected' } })).toBe(1);
  });

  it('rejects a refresh token with a wrong secret without killing the session', async () => {
    const first = (await register()).body;
    const sessionId = first.refreshToken.split('.')[0];
    const bad = await api(app).post('/auth/refresh').send({ refreshToken: `${sessionId}.not-the-secret` });
    expect(bad.status).toBe(401);
    expect((await api(app).post('/auth/refresh').send({ refreshToken: first.refreshToken })).status).toBe(200);
  });

  it('logout cuts the access token off immediately', async () => {
    const t = (await register()).body;
    expect((await api(app).post('/auth/logout').set(bearer(t.accessToken))).status).toBe(204);
    const after = await api(app).get('/auth/me').set(bearer(t.accessToken));
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('SESSION_REVOKED');
    expect((await api(app).post('/auth/refresh').send({ refreshToken: t.refreshToken })).status).toBe(401);
  });

  it('signing in again on the same device replaces the old session', async () => {
    await register('ana@example.com', 'device-aaaaaaaa');
    const a = (await login(app, 'ana@example.com', 'device-aaaaaaaa')).body;
    const live = await prisma.session.count({ where: { revokedAt: null } });
    expect(live).toBe(1);
    expect((await api(app).get('/auth/me').set(bearer(a.accessToken))).status).toBe(200);
    expect(await prisma.session.count({ where: { revokedReason: 'REPLACED' } })).toBe(1);
  });

  it('rejects missing, garbage and tampered tokens', async () => {
    expect((await api(app).get('/auth/me')).body.code).toBe('MISSING_TOKEN');
    expect((await api(app).get('/auth/me').set(bearer('garbage'))).body.code).toBe('INVALID_TOKEN');
    const t = (await register()).body;
    const [h, p, s] = t.accessToken.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), role: 'ADMIN' })).toString('base64url');
    expect((await api(app).get('/auth/me').set(bearer(`${h}.${forged}.${s}`))).body.code).toBe('INVALID_TOKEN');
  });

  it('keeps /health public', async () => {
    expect((await api(app).get('/health')).status).toBe(200);
  });

  it('login works for a seeded user created outside the API', async () => {
    await seedUser(prisma, 'coach@example.com', 'COACH');
    const res = await login(app, 'coach@example.com');
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('COACH');
  });
});
