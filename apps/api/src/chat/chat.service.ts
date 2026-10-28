import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SOCKET_EVENTS } from '@coach-connect/shared';
import { GROUP_MAX_MEMBERS } from '@coach-connect/shared';
import type { AddGroupMembersInput, ChatCreatedPayload, ChatDeletedPayload, ChatDetail, ChatReadPayload, ChatSummary, ChatUpdatedPayload, CreateGroupInput, MessageNewPayload, MessagesQueryParsed, SendMessageInput } from '@coach-connect/shared';
import { AuditService } from '../audit/audit.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

/** Only these people can be chatted with: active members and approved coaches. */
const reachable = (id: string): Prisma.UserWhereInput => ({
  id,
  deletedAt: null,
  bannedAt: null,
  role: { in: ['MEMBER', 'COACH'] },
  OR: [{ role: 'MEMBER' }, { coachProfile: { is: { approved: true } } }],
});

const memberSelect = {
  userId: true,
  lastReadSequenceNumber: true,
  user: { select: { id: true, name: true, role: true, bannedAt: true, deletedAt: true } },
} as const;
const chatInclude = { members: { select: memberSelect } } as const;

type ChatRow = Prisma.ChatGetPayload<{ include: typeof chatInclude }>;

const messageSelect = { id: true, sequenceNumber: true, senderId: true, body: true, clientMessageId: true, createdAt: true, sender: { select: { name: true } } } as const;
type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

/** A message as the apps see it: the sender's name sits next to the id (a group shows it above the bubble). */
const toMessage = ({ sender, ...message }: MessageRow) => ({ ...message, senderName: sender.name });

/**
 * Two kinds of chat share the same tables:
 *  - DIRECT: two people. Opened from the People list; only starts to show in Messages after the first message.
 *  - GROUP: 3 to 6 people with ONE coach at most, a title and an optional description. Shows up in everybody's
 *    Messages list as soon as it is created.
 *
 * What a BAN means for chats: the banned person disappears from People (so nobody can start a new chat with them),
 * but every chat they were in stays in the list and its history stays readable. Nobody can write to them in a
 * direct chat (`canSend` is false) until they are unbanned, and the banned person is signed out anyway.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService, // pushes events to the members' phones (see realtime/)
    private readonly audit: AuditService,
  ) {}

  /** Start (or reopen) the chat with someone. Always the same chat for the same two people. */
  async open(me: string, otherId: string) {
    if (otherId === me) throw new AppException(400, 'CANNOT_CHAT_WITH_SELF', 'You cannot chat with yourself.');
    const other = await this.prisma.user.findFirst({ where: reachable(otherId), select: { id: true } });
    if (!other) throw new AppException(404, 'USER_NOT_FOUND', 'That person is not available.');

    const directKey = directKeyOf(me, otherId);
    let chat = await this.prisma.chat.findUnique({ where: { directKey }, include: chatInclude });
    if (!chat) {
      try {
        chat = await this.prisma.chat.create({
          data: { type: 'DIRECT', directKey, members: { create: [{ userId: me }, { userId: otherId }] } },
          include: chatInclude,
        });
      } catch (e) {
        // Both people opened the chat in the same instant: the other request created it first.
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        chat = await this.prisma.chat.findUniqueOrThrow({ where: { directKey }, include: chatInclude });
      }
    }
    return this.summary(chat, me, null);
  }

  /**
   * Create a group chat. Rules (the same ones `addMembers` re-checks later, under a lock):
   *  - 3 to 6 people including me (the shared schema checks the count)
   *  - at most ONE coach among them, me included: a group call is "one coach and the members"
   *  - everybody must be someone I can chat with (active members, approved coaches)
   */
  async createGroup(me: string, dto: CreateGroupInput) {
    if (dto.memberIds.includes(me)) throw new AppException(400, 'CANNOT_ADD_SELF', 'You are added to the group automatically.');

    const people = await this.prisma.user.findMany({
      where: { OR: [reachable(me), ...dto.memberIds.map(reachable)] },
      select: { id: true, role: true },
    });
    if (people.length !== dto.memberIds.length + 1) throw new AppException(404, 'USER_NOT_FOUND', 'One or more people are not available.');
    if (people.filter((p) => p.role === 'COACH').length > 1) throw new AppException(400, 'GROUP_ONE_COACH_ONLY', 'A group can have only one coach.');

    const chat = await this.prisma.chat.create({
      data: {
        type: 'GROUP',
        title: dto.title,
        description: dto.description ?? null,
        createdById: me,
        // Set now so the group shows in everybody's Messages list straight away, newest first (direct chats wait for a first message).
        lastMessageAt: new Date(),
        members: { create: [me, ...dto.memberIds].map((userId) => ({ userId })) },
      },
      include: chatInclude,
    });

    // REAL-TIME: tell every member's phone there is a new chat, so it appears in their list without a reload.
    const payload: ChatCreatedPayload = { chatId: chat.id };
    this.realtime.emitToUsers(chat.members.map((m) => m.userId), SOCKET_EVENTS.chatCreated, payload);
    return this.summary(chat, me, null);
  }

  /**
   * Add people to a group. Only the person who created it may. The rules are the same as when creating it:
   * 6 people at most, ONE coach at most (a coach already in the group counts, even a banned one), and everybody
   * must be someone you could chat with.
   *
   * Two people adding at once must not push the group over 6 or give it two coaches, so the chat row is LOCKED first
   * (`FOR UPDATE`) and the rules are checked on what is in the group AFTER getting the lock.
   * New members start with everything already said marked as read (it is not "unread" for them), and can read the history.
   */
  async addMembers(me: string, chatId: string, dto: AddGroupMembersInput): Promise<ChatDetail> {
    if (dto.memberIds.includes(me)) throw new AppException(400, 'CANNOT_ADD_SELF', 'You are already in the group.');

    const { existingIds } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM chats WHERE id = ${chatId}::uuid FOR UPDATE`;
      const chat = await tx.chat.findFirst({ where: { id: chatId, members: { some: { userId: me } } }, include: chatInclude });
      if (!chat) throw new AppException(404, 'CHAT_NOT_FOUND', 'Chat not found.');
      assertCreatorOfGroup(chat, me);

      const existingIds = chat.members.map((m) => m.userId);
      if (dto.memberIds.some((id) => existingIds.includes(id))) throw new AppException(400, 'ALREADY_IN_GROUP', 'One or more of these people are already in the group.');

      const people = await tx.user.findMany({ where: { OR: dto.memberIds.map(reachable) }, select: { id: true, role: true } });
      if (people.length !== dto.memberIds.length) throw new AppException(404, 'USER_NOT_FOUND', 'One or more people are not available.');

      if (existingIds.length + people.length > GROUP_MAX_MEMBERS) throw new AppException(400, 'GROUP_FULL', `A group can have at most ${GROUP_MAX_MEMBERS} people.`);
      const coaches = chat.members.filter((m) => m.user.role === 'COACH').length + people.filter((p) => p.role === 'COACH').length;
      if (coaches > 1) throw new AppException(400, 'GROUP_ONE_COACH_ONLY', 'A group can have only one coach.');

      await tx.chatMember.createMany({ data: dto.memberIds.map((userId) => ({ userId, chatId, lastReadSequenceNumber: chat.lastMessageSequenceNumber })) });
      await tx.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
      return { existingIds };
    });

    // REAL-TIME (after the commit): the new people get the group in their list, the old members see the new head count.
    const created: ChatCreatedPayload = { chatId };
    const updated: ChatUpdatedPayload = { chatId };
    this.realtime.emitToUsers(dto.memberIds, SOCKET_EVENTS.chatCreated, created);
    this.realtime.emitToUsers(existingIds, SOCKET_EVENTS.chatUpdated, updated);
    return this.detail(me, chatId);
  }

  /**
   * Delete a group for everybody: the chat, its members and ALL its messages (they cascade). Only the creator may.
   * It cannot be undone, so it leaves an audit entry (who, which group, how many people). Direct chats cannot be deleted.
   */
  async deleteGroup(me: string, chatId: string) {
    const chat = await this.mine(me, chatId);
    assertCreatorOfGroup(chat, me);
    await this.prisma.$transaction(async (tx) => {
      await tx.chat.delete({ where: { id: chatId } });
      await this.audit.record({ actorId: me, action: 'chat.delete_group', targetType: 'chat', targetId: chatId, metadata: { title: chat.title, memberCount: chat.members.length } }, tx);
    });
    // REAL-TIME (after the commit): every member's phone drops the group, and leaves it if it was open.
    const payload: ChatDeletedPayload = { chatId };
    this.realtime.emitToUsers(chat.members.map((m) => m.userId), SOCKET_EVENTS.chatDeleted, payload);
    return { deleted: true };
  }

  /** One chat with its people (the group info screen). Only for members. */
  async detail(me: string, chatId: string): Promise<ChatDetail> {
    const chat = await this.mine(me, chatId);
    const last = await this.prisma.message.findFirst({ where: { chatId, sequenceNumber: chat.lastMessageSequenceNumber }, select: messageSelect });
    return {
      ...this.summary(chat, me, last),
      createdById: chat.createdById,
      canManage: chat.type === 'GROUP' && chat.createdById === me,
      members: chat.members.map((m) => ({ id: m.user.id, name: m.user.name, role: m.user.role as 'MEMBER' | 'COACH', isBanned: m.user.bannedAt !== null })),
    };
  }

  /**
   * The Messages tab: my chats, newest first. A direct chat shows once it has a message; a group shows from the start.
   * Chats with a BANNED person stay (history stays readable); only chats with a deleted account are left out.
   */
  async list(me: string) {
    const rows = await this.prisma.chat.findMany({
      where: { lastMessageAt: { not: null }, members: { some: { userId: me } } },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: chatInclude,
    });
    const visible = rows.filter((c) => c.type === 'GROUP' || !otherMember(c, me).user.deletedAt);
    const lastMessages = await this.prisma.message.findMany({
      where: { OR: visible.map((c) => ({ chatId: c.id, sequenceNumber: c.lastMessageSequenceNumber })) },
      select: { chatId: true, ...messageSelect },
    });
    const byChat = new Map(lastMessages.map((m) => [m.chatId, m]));
    return { items: visible.map((c) => this.summary(c, me, byChat.get(c.id) ?? null)) };
  }

  /**
   * Messages of one chat.
   *  - no cursor: the newest `limit` messages
   *  - `before=N`: the `limit` messages just older than N (scroll up)
   *  - `after=N`: everything newer than N (catch up / poll)
   * Always returned oldest first.
   */
  async messages(me: string, chatId: string, query: MessagesQueryParsed) {
    const chat = await this.mine(me, chatId);
    const where: Prisma.MessageWhereInput = {
      chatId,
      ...(query.before !== undefined ? { sequenceNumber: { lt: query.before } } : {}),
      ...(query.after !== undefined ? { sequenceNumber: { gt: query.after } } : {}),
    };
    const catchingUp = query.after !== undefined && query.before === undefined;
    const rows = await this.prisma.message.findMany({
      where,
      orderBy: { sequenceNumber: catchingUp ? 'asc' : 'desc' },
      take: query.limit + 1,
      select: messageSelect,
    });
    const more = rows.length > query.limit;
    const page = (more ? rows.slice(0, query.limit) : rows).map(toMessage);
    if (!catchingUp) page.reverse();
    return {
      items: page,
      /** There are older messages (when scrolling up) or newer ones (when catching up). */
      hasMore: more,
      lastMessageSequenceNumber: chat.lastMessageSequenceNumber,
      /** How far the OTHERS have read: my messages up to this number show "Seen". */
      otherLastReadSequenceNumber: othersLastRead(chat, me),
      canSend: canSend(chat, me),
    };
  }

  /** Save a message. Safe to retry: the same clientMessageId always gives back the same message. */
  async send(me: string, chatId: string, dto: SendMessageInput) {
    const chat = await this.mine(me, chatId);

    const existing = await this.prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: me, clientMessageId: dto.clientMessageId } }, select: { chatId: true, ...messageSelect } });
    if (existing) return this.duplicate(existing, chatId);

    // History stays readable after a ban, but nobody can write to a banned person (until they are unbanned).
    if (!canSend(chat, me)) throw new AppException(403, 'CANNOT_MESSAGE', 'You cannot message this person.');

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        // One statement takes the next number. The chat row is locked until the transaction ends, so
        // two messages can never get the same number.
        const [{ last_message_sequence_number: sequenceNumber }] = await tx.$queryRaw<{ last_message_sequence_number: number }[]>`
          UPDATE chats
          SET last_message_sequence_number = last_message_sequence_number + 1, last_message_at = now(), updated_at = now()
          WHERE id = ${chatId}::uuid
          RETURNING last_message_sequence_number`;
        // Sending means I have seen everything before it: move MY read position to my own message.
        await tx.chatMember.update({
          where: { chatId_userId: { chatId, userId: me } },
          data: { lastReadSequenceNumber: sequenceNumber },
        });
        return tx.message.create({
          data: { chatId, senderId: me, clientMessageId: dto.clientMessageId, sequenceNumber, body: dto.body },
          select: messageSelect,
        });
      });
      const message = toMessage(row);
      // REAL-TIME: the message is committed, so tell every member's devices (the sender's other phone too).
      // This is AFTER the transaction on purpose: nobody is told about a message that failed to save.
      // Retries (duplicate: true, returned above) never reach this line, so nobody gets it twice.
      // Over a socket a Date becomes text anyway; spell it out so the payload matches the shared ChatMessage type.
      const payload: MessageNewPayload = { chatId, message: { ...message, createdAt: message.createdAt.toISOString() } };
      this.realtime.emitToUsers(chat.members.map((m) => m.userId), SOCKET_EVENTS.messageNew, payload);
      return { message, duplicate: false };
    } catch (e) {
      // Two identical requests raced: the loser finds the winner's message.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: me, clientMessageId: dto.clientMessageId } }, select: { chatId: true, ...messageSelect } });
        if (winner) return this.duplicate(winner, chatId);
      }
      throw e;
    }
  }

  /**
   * "I have seen everything up to this message." Only ever moves forward, and it is ONE row update
   * (my chat_members row), however many messages that covers.
   */
  async markRead(me: string, chatId: string, upToSequenceNumber: number) {
    const chat = await this.mine(me, chatId);
    const value = Math.min(upToSequenceNumber, chat.lastMessageSequenceNumber);
    // `lastReadSequenceNumber < value` makes a repeat or an older request write nothing at all.
    const moved = await this.prisma.chatMember.updateMany({
      where: { chatId, userId: me, lastReadSequenceNumber: { lt: value } },
      data: { lastReadSequenceNumber: value },
    });
    // REAL-TIME: only when my number really moved forward (a repeat read changes nothing, so it says nothing).
    // The other members' apps turn this into the "Seen" tick; my own other devices update their unread badge.
    if (moved.count > 0) {
      const payload: ChatReadPayload = { chatId, userId: me, lastReadSequenceNumber: value };
      this.realtime.emitToUsers(chat.members.map((m) => m.userId), SOCKET_EVENTS.chatRead, payload);
    }
    const before = chat.members.find((m) => m.userId === me)?.lastReadSequenceNumber ?? 0;
    return { lastReadSequenceNumber: Math.max(before, value) };
  }

  // ───────────────────────── helpers ─────────────────────────

  /** The chat, but only if I am a member. Anyone else gets "not found". */
  private async mine(me: string, chatId: string): Promise<ChatRow> {
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId, members: { some: { userId: me } } },
      include: chatInclude,
    });
    if (!chat) throw new AppException(404, 'CHAT_NOT_FOUND', 'Chat not found.');
    return chat;
  }

  private duplicate(existing: MessageRow & { chatId: string }, chatId: string) {
    // Same clientMessageId used for a different chat: a bug in the caller, never silently accepted.
    if (existing.chatId !== chatId) throw new AppException(409, 'CLIENT_MESSAGE_ID_REUSED', 'This message id was already used.');
    const { chatId: _ignored, ...row } = existing;
    return { message: toMessage(row), duplicate: true };
  }

  private summary(chat: ChatRow, me: string, last: MessageRow | null): ChatSummary {
    const myRead = chat.members.find((m) => m.userId === me)?.lastReadSequenceNumber ?? 0;
    const isGroup = chat.type === 'GROUP';
    const other = isGroup ? null : otherMember(chat, me).user;
    return {
      id: chat.id,
      type: chat.type,
      title: isGroup ? (chat.title ?? 'Group') : other!.name,
      other: other && { id: other.id, name: other.name, role: other.role as 'MEMBER' | 'COACH' },
      description: chat.description,
      memberCount: chat.members.length,
      lastMessageSequenceNumber: chat.lastMessageSequenceNumber,
      // I read my own messages the moment I send them, so "unread" is just the gap to the newest message.
      unreadCount: chat.lastMessageSequenceNumber - myRead,
      lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
      lastMessage: last && { senderId: last.senderId, senderName: last.sender.name, body: last.body, createdAt: last.createdAt.toISOString() },
      canSend: canSend(chat, me),
    };
  }
}

/** Only the person who created a GROUP may change or delete it. (A direct chat is never changed.) */
const assertCreatorOfGroup = (chat: ChatRow, me: string) => {
  if (chat.type !== 'GROUP') throw new AppException(400, 'NOT_A_GROUP', 'Only group chats can be changed.');
  if (chat.createdById !== me) throw new AppException(403, 'NOT_GROUP_CREATOR', 'Only the person who created the group can do this.');
};

/** DIRECT chats only: the one member who is not me. */
const otherMember = (chat: ChatRow, me: string) => {
  const other = chat.members.find((m) => m.userId !== me);
  if (!other) throw new AppException(404, 'CHAT_NOT_FOUND', 'Chat not found.');
  return other;
};

/** Can I write here? In a direct chat, only while the other person is neither banned nor gone. A group never closes. */
const canSend = (chat: ChatRow, me: string): boolean => {
  if (chat.type === 'GROUP') return true;
  const { user } = otherMember(chat, me);
  return user.bannedAt === null && user.deletedAt === null;
};

/**
 * How far the others have read. Direct: the other person. Group: the member who has read LEAST among those
 * still active ("seen by everyone"); banned or deleted members are ignored, or one banned person would freeze "Seen" forever.
 */
const othersLastRead = (chat: ChatRow, me: string): number => {
  const others = chat.members.filter((m) => m.userId !== me);
  if (chat.type === 'DIRECT') return others[0]?.lastReadSequenceNumber ?? 0;
  const active = others.filter((m) => !m.user.bannedAt && !m.user.deletedAt);
  return active.length ? Math.min(...active.map((m) => m.lastReadSequenceNumber)) : 0;
};

/** "<smaller id>:<larger id>": the same for A-opens-B and B-opens-A (lowercase hex sorts like the uuid bytes). */
const directKeyOf = (x: string, y: string) => (x < y ? `${x}:${y}` : `${y}:${x}`);
