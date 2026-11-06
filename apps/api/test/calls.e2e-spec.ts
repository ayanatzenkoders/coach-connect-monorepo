import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SOCKET_EVENTS } from '@coach-connect/shared';
import { afterEach, vi } from 'vitest';
import { createApp, resetDb, api, login, bearer, seedUser } from './helpers.js';
import { CallsService } from '../src/calls/calls.service.js';
import { LiveKitService } from '../src/calls/livekit.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RealtimeService } from '../src/realtime/realtime.service.js';

describe('calls: start, join, decline, cancel, leave, timeouts', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let calls: CallsService;
  let emit: ReturnType<typeof vi.spyOn>;
  let kick: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    // Fake LiveKit settings: signing a pass works offline with any key.
    process.env.LIVEKIT_URL = 'wss://test.livekit.invalid';
    process.env.LIVEKIT_API_KEY = 'devkey';
    process.env.LIVEKIT_API_SECRET = 'devsecret-devsecret-devsecret-devsecret';
    app = await createApp();
    prisma = app.get(PrismaService);
    calls = app.get(CallsService);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    emit = vi.spyOn(RealtimeService.prototype, 'emitToUsers');
    // Never talk to the real LiveKit from tests.
    vi.spyOn(LiveKitService.prototype, 'closeRoom').mockResolvedValue();
    kick = vi.spyOn(LiveKitService.prototype, 'kick').mockResolvedValue();
  });
  afterEach(() => vi.restoreAllMocks());

  // Tokens are fetched BEFORE the request object exists (supertest closes its test server after each request).
  const tokens = new Map<string, string>();
  const as = async (email: string) => {
    if (!tokens.has(email)) tokens.set(email, (await login(app, email)).body.accessToken as string);
    return bearer(tokens.get(email)!);
  };
  const post = async (email: string, path: string, body?: object) => {
    const auth = await as(email);
    return api(app).post(path).set(auth).send(body ?? {});
  };
  const get = async (email: string, path: string) => {
    const auth = await as(email);
    return api(app).get(path).set(auth);
  };
  beforeEach(() => tokens.clear());

  const startCall = (email: string, chatId: string, video = false) => post(email, '/calls', { chatId, video });
  const join = (email: string, id: string) => post(email, `/calls/${id}/join`);
  const decline = (email: string, id: string) => post(email, `/calls/${id}/decline`);
  const cancel = (email: string, id: string) => post(email, `/calls/${id}/cancel`);
  const leave = (email: string, id: string) => post(email, `/calls/${id}/leave`);
  const sweepAfter = async (seconds: number) => calls.sweep(new Date(Date.now() + seconds * 1000));
  const statusOf = async (callId: string) => Object.fromEntries((await prisma.callParticipant.findMany({ where: { callId }, include: { user: true } })).map((p) => [p.user.name, p.status]));
  const row = (callId: string) => prisma.call.findUniqueOrThrow({ where: { id: callId } });

  /** Members ann, ben, cara, dan (ann, ben and cara have a subscription), coaches amara (available) and lena (not). */
  async function people() {
    const [ann, ben, cara, dan] = await Promise.all(['Ann', 'Ben', 'Cara', 'Dan'].map((n) => seedUser(prisma, `${n.toLowerCase()}@x.com`, 'MEMBER', n)));
    for (const u of [ann!, ben!, cara!]) await prisma.subscription.create({ data: { userId: u.id, status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 86_400_000) } });
    const amara = await seedUser(prisma, 'amara@x.com', 'COACH', 'Amara');
    const lena = await seedUser(prisma, 'lena@x.com', 'COACH', 'Lena');
    await prisma.coachProfile.create({ data: { userId: amara.id, approved: true, available: true } });
    await prisma.coachProfile.create({ data: { userId: lena.id, approved: true, available: false } });
    return { ann: ann!, ben: ben!, cara: cara!, dan: dan!, amara, lena };
  }
  const directChat = async (email: string, otherId: string) => (await post(email, '/chats', { userId: otherId })).body.id as string;
  const groupChat = async (email: string, title: string, memberIds: string[]) => (await post(email, '/chats/groups', { title, memberIds })).body.id as string;

  /** Ann calls Ben in their direct chat. */
  async function ringing() {
    const p = await people();
    const chatId = await directChat('ann@x.com', p.ben.id);
    const res = await startCall('ann@x.com', chatId);
    return { ...p, chatId, callId: res.body.call.id as string, res };
  }
  /** A group of Ann, Ben, Cara, Dan where Ann has started a call. */
  async function groupRinging() {
    const p = await people();
    const chatId = await groupChat('ann@x.com', 'Team', [p.ben.id, p.cara.id, p.dan.id]);
    const res = await startCall('ann@x.com', chatId, true);
    return { ...p, chatId, callId: res.body.call.id as string, res };
  }

  describe('starting', () => {
    it('rings the other person: a RINGING call, the starter already in it, a LiveKit pass for this room only', async () => {
      const { ben, ann, chatId, res } = await ringing();
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(true);
      expect(res.body.call).toMatchObject({ chatId, state: 'RINGING', video: false, startedById: ann.id, endReason: null });
      expect(await statusOf(res.body.call.id)).toEqual({ Ann: 'JOINED', Ben: 'INVITED' });

      // The pass is a JWT: identity = my user id, allowed into THIS room only.
      const payload = JSON.parse(Buffer.from(res.body.livekit.token.split('.')[1], 'base64url').toString());
      expect(res.body.livekit.url).toBe(app.get(ConfigService).get('LIVEKIT_URL')); // whatever the server is configured with
      expect(payload.sub).toBe(ann.id);
      expect(payload.video).toMatchObject({ room: (await row(res.body.call.id)).roomName, roomJoin: true });
      expect(payload.exp - payload.nbf).toBe(120); // only 2 minutes: it is just used to connect, so an old pass is useless to someone removed or banned
      expect(JSON.stringify(res.body)).not.toContain('devsecret'); // the API secret never leaves the server

      // After the commit: Ben's phone rings, and everybody in the call is told.
      expect(emit).toHaveBeenCalledWith([ben.id], SOCKET_EVENTS.callIncoming, expect.objectContaining({ call: expect.objectContaining({ id: res.body.call.id }) }));
      expect(emit).toHaveBeenCalledWith(expect.arrayContaining([ann.id, ben.id]), SOCKET_EVENTS.callUpdated, expect.anything());
    });

    it('a group call rings everybody else in the group, and can be a video call', async () => {
      const { res, ben, cara, dan } = await groupRinging();
      expect(res.body.call.video).toBe(true);
      expect(await statusOf(res.body.call.id)).toEqual({ Ann: 'JOINED', Ben: 'INVITED', Cara: 'INVITED', Dan: 'INVITED' });
      expect(emit).toHaveBeenCalledWith(expect.arrayContaining([ben.id, cara.id, dan.id]), SOCKET_EVENTS.callIncoming, expect.anything());
    });

    it('only people in the chat can call in it', async () => {
      const { chatId } = await ringing();
      const res = await startCall('cara@x.com', chatId);
      expect([res.status, res.body.code]).toEqual([404, 'CHAT_NOT_FOUND']);
      expect((await startCall('ann@x.com', '0194f3a0-0000-7000-8000-000000000000')).status).toBe(404);
    });

    it('a member needs a subscription to start a call; a coach does not', async () => {
      const { dan, amara } = await people();
      const chatId = await directChat('dan@x.com', amara.id);
      const res = await startCall('dan@x.com', chatId);
      expect([res.status, res.body.code]).toEqual([403, 'SUBSCRIPTION_REQUIRED']);
      expect(await prisma.call.count()).toBe(0);
      const fromCoach = await startCall('amara@x.com', chatId);
      expect(fromCoach.status).toBe(201);
      expect(dan.id).toBeTruthy();
    });

    it('a direct call to a coach needs the coach to be available', async () => {
      const { lena, amara } = await people();
      const unavailable = await startCall('ann@x.com', await directChat('ann@x.com', lena.id));
      expect([unavailable.status, unavailable.body.code]).toEqual([409, 'COACH_UNAVAILABLE']);
      expect((await startCall('ann@x.com', await directChat('ann@x.com', amara.id))).status).toBe(201);
    });

    it('cannot call someone who was banned', async () => {
      const { ben, chatId } = await ringing();
      await prisma.call.deleteMany();
      await prisma.user.update({ where: { id: ben.id }, data: { bannedAt: new Date() } });
      const res = await startCall('ann@x.com', chatId);
      expect([res.status, res.body.code]).toEqual([409, 'CANNOT_CALL']);
    });

    it('two people pressing "call" at the same moment make ONE call; the other is put into it', async () => {
      const { ann, ben } = await people();
      const chatId = await directChat('ann@x.com', ben.id);
      await as('ann@x.com');
      await as('ben@x.com');
      const [a, b] = await Promise.all([startCall('ann@x.com', chatId), startCall('ben@x.com', chatId)]);
      expect([a.status, b.status]).toEqual([201, 201]); // both are answered fine; `created` says who made the call
      expect([a.body.created, b.body.created].toSorted((x, y) => Number(x) - Number(y))).toEqual([false, true]);
      expect(await prisma.call.count({ where: { chatId } })).toBe(1);
      expect(a.body.call.id).toBe(b.body.call.id);
      expect(ann.id).toBeTruthy();
    });

    it('starting again while a call is live puts you into that call (it is not a second call)', async () => {
      const { chatId, callId } = await ringing();
      const again = await startCall('ben@x.com', chatId);
      expect(again.body).toMatchObject({ created: false, call: { id: callId, state: 'ACTIVE' } });
      expect(await statusOf(callId)).toEqual({ Ann: 'JOINED', Ben: 'JOINED' });
      expect(await prisma.call.count()).toBe(1);
    });

    it('cannot start a call while already in another one', async () => {
      const { ann, cara } = await ringing();
      const other = await directChat('ann@x.com', cara.id);
      const res = await startCall('ann@x.com', other);
      expect([res.status, res.body.code]).toEqual([409, 'ALREADY_IN_CALL']);
      expect(ann.id).toBeTruthy();
    });

    it('calling someone who is in another call answers "busy" and creates nothing', async () => {
      const { ben, cara, callId } = await ringing(); // Ann is calling Ben
      await join('ben@x.com', callId); // Ben is now connected
      const res = await startCall('cara@x.com', await directChat('cara@x.com', ben.id));
      expect([res.status, res.body.code]).toEqual([409, 'CALLEE_BUSY']);
      expect(await prisma.call.count()).toBe(1);
      expect(cara.id).toBeTruthy();
    });

    it('in a group, someone already in another call is marked BUSY and not rung; the others are rung', async () => {
      const { ben, dan, cara } = await people();
      const first = await startCall('cara@x.com', await directChat('cara@x.com', ben.id));
      await join('ben@x.com', first.body.call.id); // Ben is in a call with Cara
      emit.mockClear();
      const chatId = await groupChat('ann@x.com', 'Team', [ben.id, dan.id, cara.id]);
      const res = await startCall('ann@x.com', chatId);
      expect(await statusOf(res.body.call.id)).toMatchObject({ Ann: 'JOINED', Ben: 'BUSY', Dan: 'INVITED' });
      const rung = emit.mock.calls.find((c: unknown[]) => c[1] === SOCKET_EVENTS.callIncoming)![0] as string[];
      expect(rung).toContain(dan.id);
      expect(rung).not.toContain(ben.id);
    });

    it('answers 503 and creates nothing when LiveKit is not set up', async () => {
      const { ben } = await people();
      const chatId = await directChat('ann@x.com', ben.id);
      const key = process.env.LIVEKIT_API_KEY;
      const config = app.get(LiveKitService)['config'] as { get: (k: string) => unknown };
      const get2 = vi.spyOn(config, 'get').mockImplementation((k: string) => (k === 'LIVEKIT_API_KEY' ? undefined : process.env[k]));
      const res = await startCall('ann@x.com', chatId);
      get2.mockRestore();
      expect([res.status, res.body.code]).toEqual([503, 'CALLS_NOT_CONFIGURED']);
      expect(await prisma.call.count()).toBe(0);
      expect(key).toBeTruthy();
    });
  });

  describe('joining', () => {
    it('answering makes the call ACTIVE, records who and when, and gives Ben his own pass', async () => {
      const { ben, callId } = await ringing();
      const res = await join('ben@x.com', callId);
      expect(res.status).toBe(200);
      expect(res.body.call.state).toBe('ACTIVE');
      expect(res.body.call.answeredAt).not.toBeNull();
      expect(JSON.parse(Buffer.from(res.body.livekit.token.split('.')[1], 'base64url').toString()).sub).toBe(ben.id);
      expect(await statusOf(callId)).toEqual({ Ann: 'JOINED', Ben: 'JOINED' });
    });

    it('joining twice is harmless', async () => {
      const { callId } = await ringing();
      await join('ben@x.com', callId);
      expect((await join('ben@x.com', callId)).status).toBe(200);
      expect(await prisma.callParticipant.count({ where: { callId } })).toBe(2);
    });

    it('somebody who is not in the chat cannot join (404, same as an unknown call)', async () => {
      const { callId } = await ringing();
      const res = await join('cara@x.com', callId);
      expect([res.status, res.body.code]).toEqual([404, 'CALL_NOT_FOUND']);
      expect(await prisma.callParticipant.count({ where: { callId } })).toBe(2);
    });

    it('cannot join a call that ended', async () => {
      const { callId } = await ringing();
      await cancel('ann@x.com', callId);
      const res = await join('ben@x.com', callId);
      expect([res.status, res.body.code]).toEqual([409, 'CALL_ENDED']);
    });

    it('cannot join a call while connected to a different one', async () => {
      const { ben, dan } = await people();
      const first = await startCall('ann@x.com', await directChat('ann@x.com', ben.id));
      await join('ben@x.com', first.body.call.id); // Ben is in a call with Ann
      const groupId = await groupChat('cara@x.com', 'Team', [ben.id, dan.id]);
      const second = await startCall('cara@x.com', groupId); // Ben is BUSY here, not rung
      const res = await join('ben@x.com', second.body.call.id);
      expect([res.status, res.body.code]).toEqual([409, 'ALREADY_IN_CALL']);
    });

    it('a group member who was not rung can still join late, and everyone is told', async () => {
      const { callId, dan } = await groupRinging();
      await join('ben@x.com', callId); // call is ACTIVE
      await prisma.callParticipant.updateMany({ where: { callId, userId: dan.id }, data: { status: 'MISSED' } }); // Dan missed the ring
      emit.mockClear();
      const res = await join('dan@x.com', callId);
      expect(res.body.call.state).toBe('ACTIVE');
      expect((await statusOf(callId)).Dan).toBe('JOINED');
      expect(emit).toHaveBeenCalledWith(expect.arrayContaining([dan.id]), SOCKET_EVENTS.callUpdated, expect.anything());
    });

    it('somebody who left can come back (same row, back in the call)', async () => {
      const { callId } = await groupRinging();
      await join('ben@x.com', callId);
      await join('cara@x.com', callId);
      await leave('ben@x.com', callId);
      const back = await join('ben@x.com', callId);
      expect(back.status).toBe(200);
      const benRow = (await prisma.callParticipant.findMany({ where: { callId }, include: { user: true } })).filter((p) => p.user.name === 'Ben');
      expect(benRow).toHaveLength(1);
      expect(benRow[0]).toMatchObject({ status: 'JOINED', leftAt: null });
    });
  });

  describe('declining', () => {
    it('in a direct call a decline ends it (DECLINED) and the starter is told', async () => {
      const { callId, ann } = await ringing();
      emit.mockClear();
      const res = await decline('ben@x.com', callId);
      expect(res.body).toMatchObject({ state: 'ENDED', endReason: 'DECLINED' });
      expect(await statusOf(callId)).toEqual({ Ann: 'JOINED', Ben: 'DECLINED' });
      expect(emit).toHaveBeenCalledWith(expect.arrayContaining([ann.id]), SOCKET_EVENTS.callUpdated, expect.anything());
    });

    it('in a group one decline does not end the call; when everybody declines it ends DECLINED', async () => {
      const { callId } = await groupRinging();
      expect((await decline('ben@x.com', callId)).body.state).toBe('RINGING');
      expect((await decline('cara@x.com', callId)).body.state).toBe('RINGING');
      const last = await decline('dan@x.com', callId);
      expect(last.body).toMatchObject({ state: 'ENDED', endReason: 'DECLINED' });
    });

    it('a mix of declined and unanswered ends as NO_ANSWER', async () => {
      const { callId } = await groupRinging();
      await decline('ben@x.com', callId);
      await decline('cara@x.com', callId);
      await sweepAfter(31);
      expect(await row(callId)).toMatchObject({ state: 'ENDED', endReason: 'NO_ANSWER' });
      expect(await statusOf(callId)).toMatchObject({ Ben: 'DECLINED', Cara: 'DECLINED', Dan: 'MISSED' });
    });

    it('cannot decline twice, after answering, or a call you were not rung for', async () => {
      const { callId } = await groupRinging();
      await decline('ben@x.com', callId);
      expect((await decline('ben@x.com', callId)).body.code).toBe('NOT_RINGING');
      await join('cara@x.com', callId);
      expect((await decline('cara@x.com', callId)).body.code).toBe('NOT_RINGING');
      expect((await decline('ann@x.com', callId)).body.code).toBe('NOT_RINGING'); // the starter is not "rung"
    });
  });

  describe('cancelling', () => {
    it('the starter cancels: CANCELED, the unanswered become MISSED, the starter has left', async () => {
      const { callId } = await groupRinging();
      const res = await cancel('ann@x.com', callId);
      expect(res.body).toMatchObject({ state: 'ENDED', endReason: 'CANCELED' });
      expect(await statusOf(callId)).toEqual({ Ann: 'JOINED', Ben: 'MISSED', Cara: 'MISSED', Dan: 'MISSED' });
      expect((await prisma.callParticipant.findFirstOrThrow({ where: { callId, userId: res.body.startedById } })).leftAt).not.toBeNull();
    });

    it('only the starter can cancel (403), and not after somebody answered (409)', async () => {
      const { callId } = await ringing();
      expect((await cancel('ben@x.com', callId)).body.code).toBe('NOT_CALL_STARTER');
      await join('ben@x.com', callId);
      const late = await cancel('ann@x.com', callId);
      expect([late.status, late.body.code]).toEqual([409, 'CALL_NOT_RINGING']);
      expect((await row(callId)).state).toBe('ACTIVE');
    });

    it('"cancel" and "answer" at the very same moment: exactly one wins and the call is consistent', async () => {
      const { callId } = await ringing();
      await as('ann@x.com');
      await as('ben@x.com');
      const [c, j] = await Promise.all([cancel('ann@x.com', callId), join('ben@x.com', callId)]);
      const final = await row(callId);
      if (final.state === 'ACTIVE') {
        expect([c.status, j.status]).toEqual([409, 200]); // the answer won, the cancel was refused
        expect(await statusOf(callId)).toEqual({ Ann: 'JOINED', Ben: 'JOINED' });
      } else {
        expect(final).toMatchObject({ state: 'ENDED', endReason: 'CANCELED' }); // the cancel won, the answer was refused
        expect([c.status, j.status]).toEqual([200, 409]);
        expect((await statusOf(callId)).Ben).toBe('MISSED');
      }
    });
  });

  describe('leaving (hanging up)', () => {
    it('a person who leaves stays JOINED with a left time (so we know they were in it)', async () => {
      const { callId } = await groupRinging();
      await join('ben@x.com', callId);
      await join('cara@x.com', callId);
      const res = await leave('ben@x.com', callId);
      expect(res.body.state).toBe('ACTIVE'); // the group goes on without him
      const ben = res.body.participants.find((p: { name: string }) => p.name === 'Ben');
      expect(ben).toMatchObject({ status: 'JOINED' });
      expect(ben.leftAt).not.toBeNull();
    });

    it('in a direct call, either person leaving ends it as COMPLETED', async () => {
      const { callId } = await ringing();
      await join('ben@x.com', callId);
      const res = await leave('ann@x.com', callId);
      expect(res.body).toMatchObject({ state: 'ENDED', endReason: 'COMPLETED' });
      expect((await prisma.callParticipant.findMany({ where: { callId } })).every((p) => p.leftAt !== null)).toBe(true);
    });

    it('in a group the call ends when the last person leaves', async () => {
      const { callId } = await groupRinging();
      await join('ben@x.com', callId);
      await leave('ann@x.com', callId);
      expect((await row(callId)).state).toBe('ACTIVE');
      const last = await leave('ben@x.com', callId);
      expect(last.body).toMatchObject({ state: 'ENDED', endReason: 'COMPLETED' });
    });

    it('the starter hanging up while it still rings is a cancel', async () => {
      const { callId } = await ringing();
      const res = await leave('ann@x.com', callId);
      expect(res.body).toMatchObject({ state: 'ENDED', endReason: 'CANCELED' });
    });

    it('leaving twice, or after the call ended, is harmless', async () => {
      const { callId } = await ringing();
      await join('ben@x.com', callId);
      await leave('ann@x.com', callId);
      expect((await leave('ann@x.com', callId)).status).toBe(200);
      expect((await leave('ben@x.com', callId)).status).toBe(200);
    });

    it('ending a call closes the LiveKit room', async () => {
      const closeRoom = vi.spyOn(LiveKitService.prototype, 'closeRoom');
      const { callId } = await ringing();
      await cancel('ann@x.com', callId);
      expect(closeRoom).toHaveBeenCalledWith((await row(callId)).roomName);
    });
  });

  describe('the 30-second timeout (sweeper)', () => {
    it('a call nobody answered ends NO_ANSWER and the invited become MISSED; a fresh call is left alone', async () => {
      const { callId, ben, ann } = await ringing();
      await sweepAfter(5);
      expect((await row(callId)).state).toBe('RINGING');
      emit.mockClear();
      await sweepAfter(31);
      expect(await row(callId)).toMatchObject({ state: 'ENDED', endReason: 'NO_ANSWER' });
      expect(await statusOf(callId)).toEqual({ Ann: 'JOINED', Ben: 'MISSED' });
      expect(emit).toHaveBeenCalledWith(expect.arrayContaining([ann.id, ben.id]), SOCKET_EVENTS.callUpdated, expect.anything());
    });

    it('sweeping twice changes nothing the second time', async () => {
      const { callId } = await ringing();
      await sweepAfter(31);
      emit.mockClear();
      await sweepAfter(31);
      expect(emit).not.toHaveBeenCalled();
      expect((await row(callId)).endReason).toBe('NO_ANSWER');
    });

    it('answered just before the timeout: the call stays ACTIVE', async () => {
      const { callId } = await ringing();
      await join('ben@x.com', callId);
      await sweepAfter(31);
      expect((await row(callId)).state).toBe('ACTIVE');
    });

    it('in a running group call, people who never answered the ring become MISSED while the call continues', async () => {
      const { callId } = await groupRinging();
      await join('ben@x.com', callId);
      await sweepAfter(31);
      expect((await row(callId)).state).toBe('ACTIVE');
      expect(await statusOf(callId)).toEqual({ Ann: 'JOINED', Ben: 'JOINED', Cara: 'MISSED', Dan: 'MISSED' });
    });

    it('the real timer is switched off in tests (it only runs in development and production)', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });
  });

  describe('the "Call in progress" lookup', () => {
    it('members of the chat get the live call; after it ends they get null; outsiders get 404', async () => {
      const { chatId, callId } = await ringing();
      expect((await get('ben@x.com', `/chats/${chatId}/call`)).body.call).toMatchObject({ id: callId, state: 'RINGING' });
      expect((await get('cara@x.com', `/chats/${chatId}/call`)).status).toBe(404);
      await cancel('ann@x.com', callId);
      expect((await get('ben@x.com', `/chats/${chatId}/call`)).body).toEqual({ call: null });
    });
  });

  describe('bans', () => {
    it('banning someone in a call takes them out of the room and, in a direct call, ends it', async () => {
      const { ben, callId } = await ringing();
      await join('ben@x.com', callId);
      await seedUser(prisma, 'admin@x.com', 'ADMIN', 'Alex Admin');
      const adminToken = (await login(app, 'admin@x.com', 'admin-device-1', '/admin/auth/login')).body.accessToken as string;
      const res = await api(app).post(`/admin/users/${ben.id}/ban`).set(bearer(adminToken)).send({ reason: 'Other' });
      expect(res.status).toBeLessThan(300);
      expect(kick).toHaveBeenCalledWith((await row(callId)).roomName, ben.id);
      expect(await row(callId)).toMatchObject({ state: 'ENDED', endReason: 'COMPLETED' });
    });

    it('a banned person who was only being rung is dropped from the ring', async () => {
      const { cara, callId } = await groupRinging();
      await calls.removeBannedUser(cara.id);
      expect((await statusOf(callId)).Cara).toBe('MISSED');
      expect((await row(callId)).state).toBe('RINGING'); // the others are still being rung
    });
  });
});
