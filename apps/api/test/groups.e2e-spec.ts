import type { INestApplication } from '@nestjs/common';
import { createApp, resetDb, api, login, bearer, seedUser } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('group chats', () => {
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
  const get = async (email: string, path: string) => {
    const auth = await as(email);
    return api(app).get(path).set(auth);
  };
  const post = async (email: string, path: string, body: object) => {
    const auth = await as(email);
    return api(app).post(path).set(auth).send(body);
  };
  let n = 0;
  const say = (email: string, chatId: string, body: string) => post(email, `/chats/${chatId}/messages`, { clientMessageId: `group-msg-${++n}-${Date.now()}`, body });
  const createGroup = (email: string, memberIds: string[], extra: object = {}) => post(email, '/chats/groups', { title: 'Team Alpha', memberIds, ...extra });

  /** Four members (ann, ben, cara, dan), two approved coaches (amara, lena), one pending coach (pat). */
  const people = async () => {
    const make = (email: string, name: string) => seedUser(prisma, email, 'MEMBER', name);
    const [ann, ben, cara, dan] = await Promise.all([make('ann@x.com', 'Ann'), make('ben@x.com', 'Ben'), make('cara@x.com', 'Cara'), make('dan@x.com', 'Dan')]);
    const coach = async (email: string, name: string, approved: boolean) => {
      const user = await seedUser(prisma, email, 'COACH', name);
      await prisma.coachProfile.create({ data: { userId: user.id, approved } });
      return user;
    };
    return { ann, ben, cara, dan, amara: await coach('amara@x.com', 'Amara', true), lena: await coach('lena@x.com', 'Lena', true), pat: await coach('pat@x.com', 'Pat', false) };
  };

  describe('creating a group', () => {
    it('creates it with a name and description, adds the creator, and returns what the app needs', async () => {
      const { ben, cara } = await people();
      const res = await createGroup('ann@x.com', [ben.id, cara.id], { description: 'Weekly check-in' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ type: 'GROUP', title: 'Team Alpha', description: 'Weekly check-in', other: null, memberCount: 3, lastMessageSequenceNumber: 0, unreadCount: 0, lastMessage: null, canSend: true });
      const members = await prisma.chatMember.findMany({ where: { chatId: res.body.id } });
      expect(members).toHaveLength(3);
      const chat = await prisma.chat.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(chat).toMatchObject({ type: 'GROUP', directKey: null, title: 'Team Alpha' });
      expect(chat.createdById).toBeTruthy();
    });

    it('shows in every member\'s Messages list straight away, before any message', async () => {
      const { ben, cara } = await people();
      const { body } = await createGroup('ann@x.com', [ben.id, cara.id]);
      for (const email of ['ann@x.com', 'ben@x.com', 'cara@x.com']) {
        const items = (await get(email, '/chats')).body.items;
        expect(items.map((c: { id: string }) => c.id)).toEqual([body.id]);
      }
      expect((await get('dan@x.com', '/chats')).body.items).toEqual([]); // not a member
    });

    it('a name is required and the description is optional (blank means none)', async () => {
      const { ben, cara } = await people();
      expect((await createGroup('ann@x.com', [ben.id, cara.id], { title: '   ' })).status).toBe(400);
      const res = await createGroup('ann@x.com', [ben.id, cara.id], { description: '   ' });
      expect(res.body.description).toBeNull();
    });

    it('takes 3 to 6 people in total, no repeats, and not myself', async () => {
      const { ann, ben, cara, dan, amara } = await people();
      expect((await createGroup('ann@x.com', [ben.id])).status).toBe(400); // only 2 people
      expect((await createGroup('ann@x.com', [ben.id, ben.id])).status).toBe(400); // the same person twice
      expect((await createGroup('ann@x.com', [ben.id, cara.id, dan.id, amara.id, ann.id])).body.code).toBe('CANNOT_ADD_SELF');
      expect((await createGroup('ann@x.com', [ben.id, cara.id])).status).toBe(200); // 3 people
      const extra = await seedUser(prisma, 'eve@x.com', 'MEMBER', 'Eve');
      const six = await createGroup('ann@x.com', [ben.id, cara.id, dan.id, extra.id, amara.id]);
      expect([six.status, six.body.memberCount]).toEqual([200, 6]);
      const seven = await seedUser(prisma, 'fay@x.com', 'MEMBER', 'Fay');
      expect((await createGroup('ann@x.com', [ben.id, cara.id, dan.id, extra.id, amara.id, seven.id])).status).toBe(400); // 7 people
    });

    describe('ONE coach per group', () => {
      it('a member can add one coach', async () => {
        const { ben, amara } = await people();
        expect((await createGroup('ann@x.com', [ben.id, amara.id])).status).toBe(200);
      });

      it('two coaches are refused', async () => {
        const { ben, amara, lena } = await people();
        const res = await createGroup('ann@x.com', [ben.id, amara.id, lena.id]);
        expect([res.status, res.body.code]).toEqual([400, 'GROUP_ONE_COACH_ONLY']);
        expect(await prisma.chat.count({ where: { type: 'GROUP' } })).toBe(0);
      });

      it('a coach who creates the group counts as THE coach: they cannot add another one', async () => {
        const { ben, cara, lena } = await people();
        expect((await createGroup('amara@x.com', [ben.id, cara.id])).status).toBe(200);
        const res = await createGroup('amara@x.com', [ben.id, lena.id]);
        expect([res.status, res.body.code]).toEqual([400, 'GROUP_ONE_COACH_ONLY']);
      });

      it('a group of only members is fine too', async () => {
        const { ben, cara } = await people();
        expect((await createGroup('ann@x.com', [ben.id, cara.id])).status).toBe(200);
      });
    });

    it('only people you could chat with: not banned, not an unapproved coach, not unknown', async () => {
      const { ben, cara, pat } = await people();
      await prisma.user.update({ where: { id: cara.id }, data: { bannedAt: new Date() } });
      for (const bad of [cara.id, pat.id, '0194f3a0-0000-7000-8000-000000000000']) {
        const res = await createGroup('ann@x.com', [ben.id, bad]);
        expect([res.status, res.body.code]).toEqual([404, 'USER_NOT_FOUND']);
      }
    });

    it('the database also refuses a group without a name', async () => {
      await expect(prisma.chat.create({ data: { type: 'GROUP' } })).rejects.toThrow();
      await expect(prisma.chat.create({ data: { type: 'DIRECT', directKey: 'a:b', title: null, description: 'x'.repeat(301) } })).rejects.toThrow();
    });
  });

  describe('talking in a group', () => {
    const start = async () => {
      const p = await people();
      const { body } = await createGroup('ann@x.com', [p.ben.id, p.cara.id, p.amara.id], { description: 'Career group' });
      return { ...p, id: body.id as string };
    };

    it('everyone can write; messages carry the sender\'s name; others see it as unread, the sender does not', async () => {
      const { id } = await start();
      const sent = await say('ben@x.com', id, 'hello team');
      expect(sent.body.message).toMatchObject({ senderName: 'Ben', body: 'hello team', sequenceNumber: 1 });
      await say('amara@x.com', id, 'welcome');
      const unread = async (email: string) => (await get(email, '/chats')).body.items[0].unreadCount;
      expect([await unread('ann@x.com'), await unread('ben@x.com'), await unread('cara@x.com'), await unread('amara@x.com')]).toEqual([2, 1, 2, 0]);
      const page = (await get('cara@x.com', `/chats/${id}/messages`)).body;
      expect(page.items.map((m: { senderName: string }) => m.senderName)).toEqual(['Ben', 'Amara']);
      const preview = (await get('cara@x.com', '/chats')).body.items[0].lastMessage;
      expect(preview).toMatchObject({ senderName: 'Amara', body: 'welcome' });
    });

    it('"Seen" for a group is how far the member who has read LEAST has read', async () => {
      const { id } = await start();
      await say('ann@x.com', id, 'one');
      await say('ann@x.com', id, 'two');
      const seenBy = async () => (await get('ann@x.com', `/chats/${id}/messages`)).body.otherLastReadSequenceNumber;
      expect(await seenBy()).toBe(0);
      await post('ben@x.com', `/chats/${id}/read`, { upToSequenceNumber: 2 });
      await post('cara@x.com', `/chats/${id}/read`, { upToSequenceNumber: 2 });
      expect(await seenBy()).toBe(0); // Amara has not read yet
      await post('amara@x.com', `/chats/${id}/read`, { upToSequenceNumber: 1 });
      expect(await seenBy()).toBe(1);
      await post('amara@x.com', `/chats/${id}/read`, { upToSequenceNumber: 2 });
      expect(await seenBy()).toBe(2);
    });

    it('a banned member cannot freeze "Seen" for everyone: banned members are ignored', async () => {
      const { id, cara } = await start();
      await say('ann@x.com', id, 'one');
      await post('ben@x.com', `/chats/${id}/read`, { upToSequenceNumber: 1 });
      await post('amara@x.com', `/chats/${id}/read`, { upToSequenceNumber: 1 });
      await prisma.user.update({ where: { id: cara.id }, data: { bannedAt: new Date() } });
      expect((await get('ann@x.com', `/chats/${id}/messages`)).body.otherLastReadSequenceNumber).toBe(1);
    });

    it('when a member is banned the group goes on for the others, and the banned person\'s old messages stay', async () => {
      const { id, ben } = await start();
      await say('ben@x.com', id, 'my last words');
      await prisma.user.update({ where: { id: ben.id }, data: { bannedAt: new Date() } });
      expect((await say('ann@x.com', id, 'carry on')).status).toBe(200);
      const page = (await get('ann@x.com', `/chats/${id}/messages`)).body;
      expect(page.canSend).toBe(true);
      expect(page.items.map((m: { body: string }) => m.body)).toEqual(['my last words', 'carry on']);
      const detail = (await get('ann@x.com', `/chats/${id}`)).body;
      expect(detail.members.find((m: { id: string }) => m.id === ben.id)).toMatchObject({ isBanned: true });
    });

    it('detail lists the people with their role and who created it', async () => {
      const { id, ann } = await start();
      const detail = (await get('ben@x.com', `/chats/${id}`)).body;
      expect(detail).toMatchObject({ id, type: 'GROUP', title: 'Team Alpha', description: 'Career group', memberCount: 4, createdById: ann.id });
      expect(detail.members.map((m: { name: string; role: string }) => [m.name, m.role]).sort()).toEqual([['Amara', 'COACH'], ['Ann', 'MEMBER'], ['Ben', 'MEMBER'], ['Cara', 'MEMBER']]);
    });

    it('outsiders get "not found" for everything about the group', async () => {
      const { id } = await start();
      for (const res of [await get('dan@x.com', `/chats/${id}`), await get('dan@x.com', `/chats/${id}/messages`), await say('dan@x.com', id, 'hi'), await post('dan@x.com', `/chats/${id}/read`, { upToSequenceNumber: 1 })]) {
        expect([res.status, res.body.code]).toEqual([404, 'CHAT_NOT_FOUND']);
      }
    });

    it('a retried message is saved once in a group too', async () => {
      const { id } = await start();
      const send = () => post('ben@x.com', `/chats/${id}/messages`, { clientMessageId: 'same-id-12345678', body: 'once' });
      expect((await send()).body.duplicate).toBe(false);
      expect((await send()).body.duplicate).toBe(true);
      expect(await prisma.message.count()).toBe(1);
    });
  });

  const makeGroup = async (creator: string, memberIds: string[]) => (await createGroup(creator, memberIds)).body.id as string;
  const addPeople = (email: string, chatId: string, memberIds: string[]) => post(email, `/chats/${chatId}/members`, { memberIds });
  const del = async (email: string, chatId: string) => {
    const auth = await as(email);
    return api(app).delete(`/chats/${chatId}`).set(auth);
  };
  const extra = (name: string) => seedUser(prisma, `${name.toLowerCase()}@x.com`, 'MEMBER', name);

  describe('adding people to a group', () => {
    it('the creator adds someone: the head count grows, and the new person sees the group', async () => {
      const { ben, cara, dan } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      const res = await addPeople('ann@x.com', id, [dan.id]);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, memberCount: 4, canManage: true });
      expect(res.body.members.map((m: { name: string }) => m.name).sort()).toEqual(['Ann', 'Ben', 'Cara', 'Dan']);
      expect((await get('dan@x.com', '/chats')).body.items.map((c: { id: string }) => c.id)).toEqual([id]);
    });

    it('what was said before is not "unread" for the new person, but they can read it', async () => {
      const { ben, cara, dan } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      for (const t of ['one', 'two', 'three']) await say('ann@x.com', id, t);
      await addPeople('ann@x.com', id, [dan.id]);
      expect((await get('dan@x.com', '/chats')).body.items[0].unreadCount).toBe(0);
      expect(await prisma.chatMember.findUniqueOrThrow({ where: { chatId_userId: { chatId: id, userId: dan.id } } })).toMatchObject({ lastReadSequenceNumber: 3 });
      expect((await get('dan@x.com', `/chats/${id}/messages`)).body.items.map((m: { body: string }) => m.body)).toEqual(['one', 'two', 'three']);
      await say('ann@x.com', id, 'four');
      expect((await get('dan@x.com', '/chats')).body.items[0].unreadCount).toBe(1); // new messages count again
    });

    it('only the creator can add: a member gets 403, an outsider 404, and nothing changes', async () => {
      const { ben, cara, dan } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      const asMember = await addPeople('ben@x.com', id, [dan.id]);
      expect([asMember.status, asMember.body.code]).toEqual([403, 'NOT_GROUP_CREATOR']);
      const outsider = await addPeople('dan@x.com', id, [cara.id]); // not himself: that check comes first
      expect([outsider.status, outsider.body.code]).toEqual([404, 'CHAT_NOT_FOUND']);
      expect(await prisma.chatMember.count({ where: { chatId: id } })).toBe(3);
    });

    it('detail says who may manage the group', async () => {
      const { ben, cara } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      expect((await get('ann@x.com', `/chats/${id}`)).body.canManage).toBe(true);
      expect((await get('ben@x.com', `/chats/${id}`)).body.canManage).toBe(false);
    });

    it('a direct chat cannot be changed', async () => {
      const { ben, dan } = await people();
      const direct = (await post('ann@x.com', '/chats', { userId: ben.id })).body.id;
      const res = await addPeople('ann@x.com', direct, [dan.id]);
      expect([res.status, res.body.code]).toEqual([400, 'NOT_A_GROUP']);
    });

    it('refuses someone already in it, yourself, a banned person, a pending coach and an unknown id', async () => {
      const { ann, ben, cara, dan, pat } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      expect((await addPeople('ann@x.com', id, [ben.id])).body.code).toBe('ALREADY_IN_GROUP');
      expect((await addPeople('ann@x.com', id, [ann.id])).body.code).toBe('CANNOT_ADD_SELF');
      await prisma.user.update({ where: { id: dan.id }, data: { bannedAt: new Date() } });
      for (const bad of [dan.id, pat.id, '0194f3a0-0000-7000-8000-000000000000']) {
        const res = await addPeople('ann@x.com', id, [bad]);
        expect([res.status, res.body.code]).toEqual([404, 'USER_NOT_FOUND']);
      }
      expect((await addPeople('ann@x.com', id, [])).status).toBe(400);
    });

    it('stops at 6 people', async () => {
      const { ben, cara, dan } = await people();
      const [eve, fay, gus] = await Promise.all([extra('Eve'), extra('Fay'), extra('Gus')]);
      const id = await makeGroup('ann@x.com', [ben.id, cara.id, dan.id]); // 4 people
      expect((await addPeople('ann@x.com', id, [eve.id, fay.id, gus.id])).body.code).toBe('GROUP_FULL'); // would be 7
      expect((await addPeople('ann@x.com', id, [eve.id, fay.id])).status).toBe(200); // exactly 6
      const full = await addPeople('ann@x.com', id, [gus.id]);
      expect([full.status, full.body.code]).toEqual([400, 'GROUP_FULL']);
      expect(await prisma.chatMember.count({ where: { chatId: id } })).toBe(6);
    });

    describe('one coach only', () => {
      it('a group without a coach can get one, but not a second', async () => {
        const { ben, cara, amara, lena } = await people();
        const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
        expect((await addPeople('ann@x.com', id, [amara.id])).status).toBe(200);
        const second = await addPeople('ann@x.com', id, [lena.id]);
        expect([second.status, second.body.code]).toEqual([400, 'GROUP_ONE_COACH_ONLY']);
      });

      it('two coaches in the same request are refused', async () => {
        const { ben, cara, amara, lena } = await people();
        const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
        expect((await addPeople('ann@x.com', id, [amara.id, lena.id])).body.code).toBe('GROUP_ONE_COACH_ONLY');
        expect(await prisma.chatMember.count({ where: { chatId: id } })).toBe(3);
      });

      it('a coach who created the group is its coach: no other coach can be added', async () => {
        const { ben, cara, lena } = await people();
        const id = await makeGroup('amara@x.com', [ben.id, cara.id]);
        expect((await addPeople('amara@x.com', id, [lena.id])).body.code).toBe('GROUP_ONE_COACH_ONLY');
      });

      it('a banned coach still counts (they are still in the group)', async () => {
        const { ben, cara, amara, lena } = await people();
        const id = await makeGroup('ann@x.com', [ben.id, cara.id, amara.id]);
        await prisma.user.update({ where: { id: amara.id }, data: { bannedAt: new Date() } });
        expect((await addPeople('ann@x.com', id, [lena.id])).body.code).toBe('GROUP_ONE_COACH_ONLY');
      });
    });

    describe('two people adding at the same time cannot break the rules (the chat is locked)', () => {
      it('size: two requests that together would exceed 6, exactly one wins', async () => {
        const { ben, cara, amara } = await people();
        const [eve, fay, gus, hal] = await Promise.all([extra('Eve'), extra('Fay'), extra('Gus'), extra('Hal')]);
        const id = await makeGroup('ann@x.com', [ben.id, cara.id, amara.id]); // 4 people, room for 2
        await as('ann@x.com');
        const results = await Promise.all([addPeople('ann@x.com', id, [eve.id, fay.id]), addPeople('ann@x.com', id, [gus.id, hal.id])]);
        expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 400]);
        expect(await prisma.chatMember.count({ where: { chatId: id } })).toBe(6);
      });

      it('coach: two requests each adding a different coach, exactly one wins', async () => {
        const { ben, cara, amara, lena } = await people();
        const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
        await as('ann@x.com');
        const results = await Promise.all([addPeople('ann@x.com', id, [amara.id]), addPeople('ann@x.com', id, [lena.id])]);
        expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 400]);
        expect(await prisma.chatMember.count({ where: { chatId: id, user: { role: 'COACH' } } })).toBe(1);
      });
    });
  });

  describe('deleting a group', () => {
    it('the creator deletes it: the chat, its people and ALL its messages are gone, and everybody else gets "not found"', async () => {
      const { ben, cara } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      await say('ben@x.com', id, 'a message');
      const res = await del('ann@x.com', id);
      expect([res.status, res.body]).toEqual([200, { deleted: true }]);
      expect(await prisma.chat.count({ where: { id } })).toBe(0);
      expect(await prisma.chatMember.count({ where: { chatId: id } })).toBe(0);
      expect(await prisma.message.count({ where: { chatId: id } })).toBe(0);
      for (const email of ['ann@x.com', 'ben@x.com', 'cara@x.com']) {
        expect((await get(email, `/chats/${id}/messages`)).body.code).toBe('CHAT_NOT_FOUND');
        expect((await get(email, '/chats')).body.items).toEqual([]);
      }
    });

    it('leaves an audit entry: who deleted which group, with how many people', async () => {
      const { ann, ben, cara } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      await del('ann@x.com', id);
      const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: 'chat.delete_group', targetId: id } });
      expect(entry).toMatchObject({ actorId: ann.id, targetType: 'chat', metadata: { title: 'Team Alpha', memberCount: 3 } });
    });

    it('only the creator: a member gets 403 and the group is untouched', async () => {
      const { ben, cara } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      const res = await del('ben@x.com', id);
      expect([res.status, res.body.code]).toEqual([403, 'NOT_GROUP_CREATOR']);
      expect(await prisma.chat.count({ where: { id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { action: 'chat.delete_group' } })).toBe(0);
    });

    it('an outsider gets 404, a direct chat cannot be deleted, a second delete is 404, a bad id is 400', async () => {
      const { ben, cara, dan } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      expect((await del('dan@x.com', id)).body.code).toBe('CHAT_NOT_FOUND');
      const direct = (await post('ann@x.com', '/chats', { userId: dan.id })).body.id;
      expect((await del('ann@x.com', direct)).body.code).toBe('NOT_A_GROUP');
      expect(await prisma.chat.count({ where: { id: direct } })).toBe(1);
      await del('ann@x.com', id);
      expect((await del('ann@x.com', id)).status).toBe(404);
      expect((await del('ann@x.com', 'not-an-id')).status).toBe(400);
    });

    it('unread counts of the other members drop with it (nothing left to count)', async () => {
      const { ben, cara } = await people();
      const id = await makeGroup('ann@x.com', [ben.id, cara.id]);
      await say('ann@x.com', id, 'hi');
      expect((await get('ben@x.com', '/chats')).body.items[0].unreadCount).toBe(1);
      await del('ann@x.com', id);
      expect((await get('ben@x.com', '/chats')).body.items).toEqual([]);
    });
  });
});

