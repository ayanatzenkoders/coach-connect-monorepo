import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@coach-connect/shared';
import { createApp, resetDb, api, login, bearer, seedUser } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('realtime (sockets)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url: string;
  const open: Socket[] = [];

  beforeAll(async () => {
    app = await createApp();
    // Sockets need a real port (supertest normally hides this). 0 = "any free port".
    await app.listen(0);
    url = await app.getUrl();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(prisma));
  afterEach(() => {
    open.splice(0).forEach((s) => s.disconnect());
  });

  /** Connect like the app does: the token travels in the handshake. Resolves when accepted, rejects with the server's code. */
  const connect = (token?: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
      open.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (e) => reject(e));
    });

  /** Remember every event of this name, so a test can also prove that something did NOT arrive. */
  const record = <T>(socket: Socket, event: string) => {
    const seen: T[] = [];
    socket.on(event, (payload: T) => seen.push(payload));
    return seen;
  };
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 60 && !check(); i++) await new Promise((r) => setTimeout(r, 25));
  };
  const settle = () => new Promise((r) => setTimeout(r, 200)); // "nothing else arrives" checks

  const tokenOf = async (email: string) => (await login(app, email)).body.accessToken as string;

  /** Ann and Ben with a chat, both connected. Cara is connected too but is NOT in the chat. */
  const setup = async () => {
    await seedUser(prisma, 'ann@x.com', 'MEMBER', 'Ann');
    const ben = await seedUser(prisma, 'ben@x.com', 'MEMBER', 'Ben');
    await seedUser(prisma, 'cara@x.com', 'MEMBER', 'Cara');
    const [annToken, benToken, caraToken] = await Promise.all([tokenOf('ann@x.com'), tokenOf('ben@x.com'), tokenOf('cara@x.com')]);
    const chat = await api(app).post('/chats').set(bearer(annToken)).send({ userId: ben.id });
    const [ann, benSocket, cara] = await Promise.all([connect(annToken), connect(benToken), connect(caraToken)]);
    return { chatId: chat.body.id as string, annToken, benToken, ann, ben: benSocket, cara };
  };
  const send = (token: string, chatId: string, body: string, clientMessageId = `client-${Math.random().toString(36).slice(2)}`) =>
    api(app).post(`/chats/${chatId}/messages`).set(bearer(token)).send({ clientMessageId, body });

  it('refuses a connection without a valid token, with a code the app can read', async () => {
    await seedUser(prisma, 'ann@x.com', 'MEMBER');
    await expect(connect()).rejects.toThrow('MISSING_TOKEN');
    await expect(connect('not-a-token')).rejects.toThrow('INVALID_TOKEN');
    const token = await tokenOf('ann@x.com');
    await prisma.session.updateMany({ data: { revokedAt: new Date(), revokedReason: 'LOGOUT' } });
    await expect(connect(token)).rejects.toThrow('SESSION_REVOKED');
  });

  it('pushes a new message to both members, but not to someone outside the chat', async () => {
    const { chatId, annToken, ann, ben, cara } = await setup();
    const forAnn = record<{ chatId: string; message: { body: string; sequenceNumber: number } }>(ann, SOCKET_EVENTS.messageNew);
    const forBen = record<{ chatId: string; message: { body: string; sequenceNumber: number } }>(ben, SOCKET_EVENTS.messageNew);
    const forCara = record(cara, SOCKET_EVENTS.messageNew);

    await send(annToken, chatId, 'hello Ben');
    await until(() => forAnn.length > 0 && forBen.length > 0);
    await settle();

    expect(forBen).toEqual([{ chatId, message: expect.objectContaining({ body: 'hello Ben', sequenceNumber: 1 }) }]);
    expect(forAnn).toHaveLength(1); // the sender's own devices are told too
    expect(forCara).toHaveLength(0); // privacy: only members get the event
  });

  it('does not push again when the same message is retried', async () => {
    const { chatId, annToken, ben } = await setup();
    const forBen = record(ben, SOCKET_EVENTS.messageNew);
    await send(annToken, chatId, 'once', 'retry-id-12345678');
    await send(annToken, chatId, 'once', 'retry-id-12345678');
    await settle();
    expect(forBen).toHaveLength(1);
  });

  it('pushes "read" to both members only when the number really moves forward', async () => {
    const { chatId, annToken, benToken, ann } = await setup();
    await send(annToken, chatId, 'a');
    await send(annToken, chatId, 'b');
    const forAnn = record<{ chatId: string; userId: string; lastReadSequenceNumber: number }>(ann, SOCKET_EVENTS.chatRead);
    const read = (n: number) => api(app).post(`/chats/${chatId}/read`).set(bearer(benToken)).send({ upToSequenceNumber: n });

    await read(2);
    await until(() => forAnn.length > 0);
    await read(2); // already there: nothing changed, nothing is pushed
    await read(1); // older: same
    await settle();

    const ben = await prisma.user.findFirstOrThrow({ where: { email: 'ben@x.com' } });
    expect(forAnn).toEqual([{ chatId, userId: ben.id, lastReadSequenceNumber: 2 }]);
  });

  it('closes only the socket of a device that signs out; the same user\'s other device stays connected', async () => {
    await seedUser(prisma, 'ann@x.com', 'MEMBER', 'Ann');
    const phone = (await login(app, 'ann@x.com', 'phone-device-1')).body.accessToken as string;
    const tablet = (await login(app, 'ann@x.com', 'tablet-device-1')).body.accessToken as string;
    const [phoneSocket, tabletSocket] = await Promise.all([connect(phone), connect(tablet)]);
    const phoneClosed = new Promise<string>((resolve) => phoneSocket.on('disconnect', resolve));

    await api(app).post('/auth/logout').set(bearer(phone)).send();

    expect(await phoneClosed).toBe('io server disconnect');
    await settle();
    expect(tabletSocket.connected).toBe(true);
    await expect(connect(phone)).rejects.toThrow('SESSION_REVOKED'); // and the revoked login cannot reconnect
  });

  it('closes the old socket when the same device signs in again (the old session is replaced)', async () => {
    await seedUser(prisma, 'ann@x.com', 'MEMBER', 'Ann');
    const first = (await login(app, 'ann@x.com', 'same-device-1')).body.accessToken as string;
    const oldSocket = await connect(first);
    const closed = new Promise<string>((resolve) => oldSocket.on('disconnect', resolve));

    await login(app, 'ann@x.com', 'same-device-1');

    expect(await closed).toBe('io server disconnect');
  });

  it('closes a banned user\'s open socket at once', async () => {
    const { ben } = await setup();
    const benUser = await prisma.user.findFirstOrThrow({ where: { email: 'ben@x.com' } });
    await seedUser(prisma, 'admin@x.com', 'ADMIN');
    const adminToken = (await api(app).post('/admin/auth/login').send({ email: 'admin@x.com', password: 'Password123!', deviceId: 'admin-device-1' })).body.accessToken as string;

    const closed = new Promise<string>((resolve) => ben.on('disconnect', resolve));
    await api(app).post(`/admin/users/${benUser.id}/ban`).set(bearer(adminToken)).send({ reason: 'Other' });
    expect(await closed).toBe('io server disconnect'); // the SERVER hung up
    await expect(connect((await login(app, 'ben@x.com')).body.accessToken)).rejects.toBeDefined(); // and cannot come back
  });
});
