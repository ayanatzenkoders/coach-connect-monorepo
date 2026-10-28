import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, login, bearer, seedUser } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('chat', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens = new Map<string, string>();
  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    tokens.clear();
  });

  const as = async (email: string) => {
    if (!tokens.has(email)) tokens.set(email, (await login(app, email)).body.accessToken);
    return bearer(tokens.get(email)!);
  };
  // Get the token BEFORE building the request: supertest closes its server after the login request ends.
  const get = async (email: string, path: string) => {
    const auth = await as(email);
    return api(app).get(path).set(auth);
  };
  const post = async (email: string, path: string, body: object) => {
    const auth = await as(email);
    return api(app).post(path).set(auth).send(body);
  };

  /** Two members who already have a chat. */
  const pair = async () => {
    const ann = await seedUser(prisma, 'ann@x.com', 'MEMBER', 'Ann');
    const ben = await seedUser(prisma, 'ben@x.com', 'MEMBER', 'Ben');
    const res = await post('ann@x.com', '/chats', { userId: ben.id });
    return { ann, ben, id: res.body.id as string };
  };
  let n = 0;
  const say = (email: string, id: string, body: string, clientMessageId = `client-msg-${++n}-${Date.now()}`) =>
    post(email, `/chats/${id}/messages`, { clientMessageId, body });

  it('requires login', async () => {
    expect((await api(app).get('/chats')).status).toBe(401);
  });

  describe('opening a chat', () => {
    it('gives both people the SAME chat, however it is opened', async () => {
      const { ann, ben, id } = await pair();
      const again = await post('ann@x.com', '/chats', { userId: ben.id });
      const fromBen = await post('ben@x.com', '/chats', { userId: ann.id });
      expect(again.body.id).toBe(id);
      expect(fromBen.body.id).toBe(id);
      expect(fromBen.body.other).toMatchObject({ id: ann.id, name: 'Ann', role: 'MEMBER' });
      expect(await prisma.chat.count()).toBe(1);
    });

    it('survives both people opening it at the same moment', async () => {
      const ann = await seedUser(prisma, 'ann@x.com', 'MEMBER', 'Ann');
      const ben = await seedUser(prisma, 'ben@x.com', 'MEMBER', 'Ben');
      await as('ann@x.com');
      await as('ben@x.com');
      const [a, b] = await Promise.all([post('ann@x.com', '/chats', { userId: ben.id }), post('ben@x.com', '/chats', { userId: ann.id })]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.body.id).toBe(b.body.id);
    });

    it('stores one DIRECT chat with two chat_members rows, both starting at 0', async () => {
      const { ann, ben, id } = await pair();
      const chat = await prisma.chat.findUniqueOrThrow({ where: { id }, include: { members: true } });
      expect(chat).toMatchObject({ type: 'DIRECT', title: null, lastMessageSequenceNumber: 0 });
      expect(chat.directKey).toBe([ann.id, ben.id].sort((x, y) => x.localeCompare(y)).join(':'));
      expect(chat.members.map((m) => m.lastReadSequenceNumber)).toEqual([0, 0]);
      expect(chat.members.map((m) => m.userId).sort((x, y) => x.localeCompare(y))).toEqual([ann.id, ben.id].sort((x, y) => x.localeCompare(y)));
    });

    it('refuses yourself, strangers, banned, staff, pending coaches and blocked people', async () => {
      const ann = await seedUser(prisma, 'ann@x.com', 'MEMBER', 'Ann');
      const banned = await seedUser(prisma, 'banned@x.com', 'MEMBER');
      const staff = await seedUser(prisma, 'staff@x.com', 'ADMIN');
      const pending = await seedUser(prisma, 'pending@x.com', 'COACH');
      await prisma.coachProfile.create({ data: { userId: pending.id, approved: false } });
      const blocked = await seedUser(prisma, 'blocked@x.com', 'MEMBER');
      await prisma.user.update({ where: { id: banned.id }, data: { bannedAt: new Date() } });
      await prisma.block.create({ data: { blockerId: blocked.id, blockedId: ann.id } }); // they blocked me
      const open = (userId: string) => post('ann@x.com', '/chats', { userId });
      expect((await open(ann.id)).body.code).toBe('CANNOT_CHAT_WITH_SELF');
      for (const id of ['0194f3a0-0000-7000-8000-000000000000', banned.id, staff.id, pending.id, blocked.id]) {
        const res = await open(id);
        expect([res.status, res.body.code]).toEqual([404, 'USER_NOT_FOUND']);
      }
      expect((await open('not-a-uuid')).status).toBe(400);
    });

    it('lets members chat with approved coaches', async () => {
      await seedUser(prisma, 'ann@x.com', 'MEMBER', 'Ann');
      const coach = await seedUser(prisma, 'amara@x.com', 'COACH', 'Amara');
      await prisma.coachProfile.create({ data: { userId: coach.id, approved: true } });
      const res = await post('ann@x.com', '/chats', { userId: coach.id });
      expect(res.body.other).toMatchObject({ name: 'Amara', role: 'COACH' });
    });
  });

  describe('sending and reading', () => {
    it('numbers messages 1, 2, 3 and the recipient sees them as unread', async () => {
      const { ann, id } = await pair();
      expect((await say('ann@x.com', id, 'hi')).body.message.sequenceNumber).toBe(1);
      expect((await say('ann@x.com', id, 'are you there?')).body.message.sequenceNumber).toBe(2);
      const ben = (await get('ben@x.com', '/chats')).body.items;
      expect(ben).toHaveLength(1);
      expect(ben[0]).toMatchObject({ id, unreadCount: 2, lastMessageSequenceNumber: 2, other: { name: 'Ann' }, lastMessage: { senderId: ann.id, body: 'are you there?' } });
      expect((await get('ann@x.com', '/chats')).body.items[0].unreadCount).toBe(0); // my own messages are read
    });

    it('keeps empty chats out of the Messages list', async () => {
      await pair();
      expect((await get('ann@x.com', '/chats')).body.items).toEqual([]);
    });

    it('saves a retried message once (same clientMessageId)', async () => {
      const { id } = await pair();
      const first = await say('ann@x.com', id, 'hello', 'retry-me-12345');
      const retry = await say('ann@x.com', id, 'hello', 'retry-me-12345');
      expect(first.body.duplicate).toBe(false);
      expect(retry.body.duplicate).toBe(true);
      expect(retry.body.message.id).toBe(first.body.message.id);
      expect(await prisma.message.count()).toBe(1);
    });

    it('does not mix up a clientMessageId used in another chat', async () => {
      const { ann, id } = await pair();
      const cara = await seedUser(prisma, 'cara@x.com', 'MEMBER', 'Cara');
      const other = await post('ann@x.com', '/chats', { userId: cara.id });
      await say('ann@x.com', id, 'one', 'same-id-123456');
      const res = await say('ann@x.com', other.body.id, 'two', 'same-id-123456');
      expect([res.status, res.body.code]).toEqual([409, 'CLIENT_MESSAGE_ID_REUSED']);
      expect(ann.id).toBeTruthy();
    });

    it('gives parallel messages unique, gap-free numbers', async () => {
      const { id } = await pair();
      await as('ann@x.com');
      const results = await Promise.all(Array.from({ length: 9 }, (_, i) => say('ann@x.com', id, `m${i}`)));
      expect(results.every((r) => r.status === 200)).toBe(true);
      const seqs = results.map((r) => r.body.message.sequenceNumber).sort((a, b) => a - b);
      expect(seqs).toEqual(Array.from({ length: 9 }, (_, i) => i + 1));
    });

    it('rejects empty, blank and oversized messages', async () => {
      const { id } = await pair();
      expect((await say('ann@x.com', id, '')).status).toBe(400);
      expect((await say('ann@x.com', id, '   \n ')).status).toBe(400);
      expect((await say('ann@x.com', id, 'x'.repeat(2001))).status).toBe(400);
      expect((await say('ann@x.com', id, 'x'.repeat(2000))).status).toBe(200);
      expect((await say('ann@x.com', id, '  trimmed  ')).body.message.body).toBe('trimmed');
    });

    it('marks messages read, only forward, never past the newest, and the sender can see it', async () => {
      const { id } = await pair();
      for (const t of ['a', 'b', 'c']) await say('ann@x.com', id, t);
      expect((await post('ben@x.com', `/chats/${id}/read`, { upToSequenceNumber: 2 })).body.lastReadSequenceNumber).toBe(2);
      expect((await get('ben@x.com', '/chats')).body.items[0].unreadCount).toBe(1);
      expect((await post('ben@x.com', `/chats/${id}/read`, { upToSequenceNumber: 1 })).body.lastReadSequenceNumber).toBe(2); // never backwards
      expect((await post('ben@x.com', `/chats/${id}/read`, { upToSequenceNumber: 99 })).body.lastReadSequenceNumber).toBe(3); // capped
      expect((await get('ben@x.com', '/chats')).body.items[0].unreadCount).toBe(0);
      expect((await get('ann@x.com', `/chats/${id}/messages`)).body.otherLastReadSequenceNumber).toBe(3);
    });
  });

  describe('seen is one number per member', () => {
    it('reading many messages changes only the reader chat_members row', async () => {
      const { ann, ben, id } = await pair();
      for (let i = 1; i <= 50; i++) await say('ann@x.com', id, `m${i}`);
      const read = (userId: string) => prisma.chatMember.findUniqueOrThrow({ where: { chatId_userId: { chatId: id, userId } } }).then((m) => m.lastReadSequenceNumber);
      // Ann's own sending moved her marker; Ben has read nothing yet.
      expect([await read(ann.id), await read(ben.id)]).toEqual([50, 0]);
      expect((await get('ben@x.com', '/chats')).body.items[0].unreadCount).toBe(50);
      await post('ben@x.com', `/chats/${id}/read`, { upToSequenceNumber: 50 });
      expect([await read(ann.id), await read(ben.id)]).toEqual([50, 50]);
      expect(await prisma.message.count()).toBe(50); // no message row was touched
      expect((await get('ann@x.com', `/chats/${id}/messages`)).body.otherLastReadSequenceNumber).toBe(50);
    });
  });

  describe('reading the messages', () => {
    const fill = async (id: string, count: number) => {
      for (let i = 1; i <= count; i++) await say(i % 2 ? 'ann@x.com' : 'ben@x.com', id, `msg ${i}`);
    };
    const bodies = (res: { body: { items: { body: string }[] } }) => res.body.items.map((m) => m.body);

    it('returns the newest page first (oldest to newest), then older pages with before=', async () => {
      const { id } = await pair();
      await fill(id, 5);
      const newest = await get('ann@x.com', `/chats/${id}/messages?limit=2`);
      expect(bodies(newest)).toEqual(['msg 4', 'msg 5']);
      expect(newest.body).toMatchObject({ hasMore: true, lastMessageSequenceNumber: 5 });
      const older = await get('ann@x.com', `/chats/${id}/messages?limit=2&before=4`);
      expect(bodies(older)).toEqual(['msg 2', 'msg 3']);
      const oldest = await get('ann@x.com', `/chats/${id}/messages?limit=2&before=2`);
      expect(bodies(oldest)).toEqual(['msg 1']);
      expect(oldest.body.hasMore).toBe(false);
    });

    it('catches up with after=: only what is newer, oldest first', async () => {
      const { id } = await pair();
      await fill(id, 5);
      const res = await get('ben@x.com', `/chats/${id}/messages?after=3`);
      expect(bodies(res)).toEqual(['msg 4', 'msg 5']);
      expect((await get('ben@x.com', `/chats/${id}/messages?after=5`)).body.items).toEqual([]);
      const part = await get('ben@x.com', `/chats/${id}/messages?after=0&limit=2`);
      expect(bodies(part)).toEqual(['msg 1', 'msg 2']);
      expect(part.body.hasMore).toBe(true);
    });

    it('never shows a chat to someone outside it', async () => {
      const { id } = await pair();
      await seedUser(prisma, 'eve@x.com', 'MEMBER', 'Eve');
      await say('ann@x.com', id, 'secret');
      for (const res of [
        await get('eve@x.com', `/chats/${id}/messages`),
        await say('eve@x.com', id, 'hi'),
        await post('eve@x.com', `/chats/${id}/read`, { upToSequenceNumber: 1 }),
      ]) {
        expect([res.status, res.body.code]).toEqual([404, 'CHAT_NOT_FOUND']);
      }
      expect((await get('eve@x.com', '/chats')).body.items).toEqual([]);
    });
  });

  describe('blocks and bans', () => {
    it('stops sending after a block (either direction), and hides the chat from the list', async () => {
      const { ann, ben, id } = await pair();
      await say('ann@x.com', id, 'before the block');
      await prisma.block.create({ data: { blockerId: ben.id, blockedId: ann.id } });
      for (const who of ['ann@x.com', 'ben@x.com']) {
        const res = await say(who, id, 'after the block');
        expect([res.status, res.body.code]).toEqual([403, 'CANNOT_MESSAGE']);
        expect((await get(who, '/chats')).body.items).toEqual([]);
      }
    });

    it('stops sending to a banned person and hides the chat', async () => {
      const { ben, id } = await pair();
      await say('ann@x.com', id, 'hi');
      await prisma.user.update({ where: { id: ben.id }, data: { bannedAt: new Date() } });
      expect((await say('ann@x.com', id, 'still there?')).status).toBe(403);
      expect((await get('ann@x.com', '/chats')).body.items).toEqual([]);
    });

    it('a banned person cannot use chat at all (token no longer works)', async () => {
      const { ann, id } = await pair();
      await as('ann@x.com');
      await prisma.user.update({ where: { id: ann.id }, data: { bannedAt: new Date() } });
      expect((await say('ann@x.com', id, 'hi')).status).toBe(403);
    });
  });
});
