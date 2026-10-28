import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SOCKET_EVENTS } from '@coach-connect/shared';
import type { ChatReadPayload, MessageNewPayload, MessagesQueryParsed, SendMessageInput } from '@coach-connect/shared';
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

const messageSelect = { id: true, sequenceNumber: true, senderId: true, body: true, clientMessageId: true, createdAt: true } as const;

/**
 * Chats are DIRECT (two members) for now; the "other person" helpers below rely on that.
 * A group chat needs the same tables, only different rules in `open`, `send` and `summary`.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService, // pushes events to the members' phones (see realtime/)
  ) {}

  /** Start (or reopen) the chat with someone. Always the same chat for the same two people. */
  async open(me: string, otherId: string) {
    if (otherId === me) throw new AppException(400, 'CANNOT_CHAT_WITH_SELF', 'You cannot chat with yourself.');
    const other = await this.prisma.user.findFirst({ where: reachable(otherId), select: { id: true } });
    // A blocked person looks exactly like a missing one, so blocking cannot be probed.
    if (!other || (await this.isBlocked(me, otherId))) throw new AppException(404, 'USER_NOT_FOUND', 'That person is not available.');

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

  /** The Messages tab: my chats that have at least one message, newest first. */
  async list(me: string) {
    const rows = await this.prisma.chat.findMany({
      where: { lastMessageAt: { not: null }, members: { some: { userId: me } } },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: chatInclude,
    });
    const blocked = await this.blockedWith(me);
    const visible = rows.filter((c) => {
      const other = otherMember(c, me);
      return !other.user.bannedAt && !other.user.deletedAt && !blocked.has(other.userId);
    });
    const lastMessages = await this.prisma.message.findMany({
      where: { OR: visible.map((c) => ({ chatId: c.id, sequenceNumber: c.lastMessageSequenceNumber })) },
      select: { chatId: true, senderId: true, body: true, createdAt: true },
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
    const page = more ? rows.slice(0, query.limit) : rows;
    if (!catchingUp) page.reverse();
    return {
      items: page,
      /** There are older messages (when scrolling up) or newer ones (when catching up). */
      hasMore: more,
      lastMessageSequenceNumber: chat.lastMessageSequenceNumber,
      /** How far the OTHER person has read: our messages up to this number show "Seen". */
      otherLastReadSequenceNumber: otherMember(chat, me).lastReadSequenceNumber,
    };
  }

  /** Save a message. Safe to retry: the same clientMessageId always gives back the same message. */
  async send(me: string, chatId: string, dto: SendMessageInput) {
    const chat = await this.mine(me, chatId);

    const existing = await this.prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: me, clientMessageId: dto.clientMessageId } } });
    if (existing) return this.duplicate(existing, chatId);

    const other = otherMember(chat, me);
    if (other.user.bannedAt || other.user.deletedAt || (await this.isBlocked(me, other.userId))) {
      throw new AppException(403, 'CANNOT_MESSAGE', 'You cannot message this person.');
    }

    try {
      const message = await this.prisma.$transaction(async (tx) => {
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
        const winner = await this.prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: me, clientMessageId: dto.clientMessageId } } });
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
    // The other member's app turns this into the "Seen" tick; their Messages list updates the unread badge.
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

  private duplicate(existing: { chatId: string } & Prisma.MessageGetPayload<{ select: typeof messageSelect }>, chatId: string) {
    // Same clientMessageId used for a different chat: a bug in the caller, never silently accepted.
    if (existing.chatId !== chatId) throw new AppException(409, 'CLIENT_MESSAGE_ID_REUSED', 'This message id was already used.');
    const { chatId: _ignored, ...message } = existing;
    return { message, duplicate: true };
  }

  private summary(chat: ChatRow, me: string, last: { senderId: string; body: string; createdAt: Date } | null) {
    const { user } = otherMember(chat, me);
    const myRead = chat.members.find((m) => m.userId === me)?.lastReadSequenceNumber ?? 0;
    return {
      id: chat.id,
      other: { id: user.id, name: user.name, role: user.role },
      lastMessageSequenceNumber: chat.lastMessageSequenceNumber,
      // I read my own messages the moment I send them, so "unread" is just the gap to the newest message.
      unreadCount: chat.lastMessageSequenceNumber - myRead,
      lastMessageAt: chat.lastMessageAt,
      lastMessage: last && { senderId: last.senderId, body: last.body, createdAt: last.createdAt },
    };
  }

  /** Blocked in either direction. */
  private async isBlocked(a: string, b: string) {
    const count = await this.prisma.block.count({
      where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    });
    return count > 0;
  }

  private async blockedWith(me: string) {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: me }, { blockedId: me }] },
      select: { blockerId: true, blockedId: true },
    });
    return new Set(rows.map((r) => (r.blockerId === me ? r.blockedId : r.blockerId)));
  }
}

/** DIRECT chats only: the one member who is not me. */
const otherMember = (chat: ChatRow, me: string) => {
  const other = chat.members.find((m) => m.userId !== me);
  if (!other) throw new AppException(404, 'CHAT_NOT_FOUND', 'Chat not found.');
  return other;
};

/** "<smaller id>:<larger id>": the same for A-opens-B and B-opens-A (lowercase hex sorts like the uuid bytes). */
const directKeyOf = (x: string, y: string) => (x < y ? `${x}:${y}` : `${y}:${x}`);
