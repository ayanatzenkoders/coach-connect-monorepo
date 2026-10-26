import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '../generated/prisma/client.js';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MessagesQueryParsed, SendMessageInput } from '@coach-connect/shared';

/** Emitted after a message is saved. Sockets and push notifications will listen to it later. */
export const MESSAGE_CREATED = 'chat.message.created';

/** Only these people can be chatted with: active members and approved coaches. */
const reachable = (id: string): Prisma.UserWhereInput => ({
  id,
  deletedAt: null,
  isBanned: false,
  role: { in: ['MEMBER', 'COACH'] },
  OR: [{ role: 'MEMBER' }, { coachProfile: { is: { approved: true } } }],
});

const otherSelect = { id: true, name: true, role: true, isBanned: true, deletedAt: true } as const;

type ConversationRow = Prisma.ConversationGetPayload<{ include: { userA: { select: typeof otherSelect }; userB: { select: typeof otherSelect } } }>;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Start (or reopen) the chat with someone. Always the same conversation for the same two people. */
  async open(me: string, otherId: string) {
    if (otherId === me) throw new AppException(400, 'CANNOT_CHAT_WITH_SELF', 'You cannot chat with yourself.');
    const other = await this.prisma.user.findFirst({ where: reachable(otherId), select: { id: true } });
    // A blocked person looks exactly like a missing one, so blocking cannot be probed.
    if (!other || (await this.isBlocked(me, otherId))) throw new AppException(404, 'USER_NOT_FOUND', 'That person is not available.');

    const [userAId, userBId] = sortPair(me, otherId);
    const include = { userA: { select: otherSelect }, userB: { select: otherSelect } } as const;
    let conversation = await this.prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } }, include });
    if (!conversation) {
      try {
        conversation = await this.prisma.conversation.create({ data: { userAId, userBId }, include });
      } catch (e) {
        // Both people opened the chat in the same instant: the other request created it first.
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        conversation = await this.prisma.conversation.findUniqueOrThrow({ where: { userAId_userBId: { userAId, userBId } }, include });
      }
    }
    return this.summary(conversation, me, null);
  }

  /** The Messages tab: my conversations that have at least one message, newest first. */
  async list(me: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { lastMessageAt: { not: null }, OR: [{ userAId: me }, { userBId: me }] },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: { userA: { select: otherSelect }, userB: { select: otherSelect } },
    });
    const blocked = await this.blockedWith(me);
    const visible = rows.filter((c) => {
      const other = c.userAId === me ? c.userB : c.userA;
      return !other.isBanned && !other.deletedAt && !blocked.has(other.id);
    });
    const lastMessages = await this.prisma.message.findMany({
      where: { OR: visible.map((c) => ({ conversationId: c.id, seq: c.lastSeq })) },
      select: { conversationId: true, senderId: true, body: true, createdAt: true },
    });
    const byConversation = new Map(lastMessages.map((m) => [m.conversationId, m]));
    return { items: visible.map((c) => this.summary(c, me, byConversation.get(c.id) ?? null)) };
  }

  /**
   * Messages of one conversation.
   *  - no cursor: the newest `limit` messages
   *  - `before=N`: the `limit` messages just older than N (scroll up)
   *  - `after=N`: everything newer than N (catch up / poll)
   * Always returned oldest first.
   */
  async messages(me: string, conversationId: string, query: MessagesQueryParsed) {
    const c = await this.mine(me, conversationId);
    const where: Prisma.MessageWhereInput = {
      conversationId,
      ...(query.before !== undefined ? { seq: { lt: query.before } } : {}),
      ...(query.after !== undefined ? { seq: { gt: query.after } } : {}),
    };
    const catchingUp = query.after !== undefined && query.before === undefined;
    const rows = await this.prisma.message.findMany({
      where,
      orderBy: { seq: catchingUp ? 'asc' : 'desc' },
      take: query.limit + 1,
      select: { id: true, seq: true, senderId: true, body: true, clientMsgId: true, createdAt: true },
    });
    const more = rows.length > query.limit;
    const page = more ? rows.slice(0, query.limit) : rows;
    if (!catchingUp) page.reverse();
    return {
      items: page,
      /** There are older messages (when scrolling up) or newer ones (when catching up). */
      hasMore: more,
      lastSeq: c.lastSeq,
      /** How far the OTHER person has read: our messages up to this number show "Seen". */
      otherReadSeq: c.userAId === me ? c.bReadSeq : c.aReadSeq,
    };
  }

  /** Save a message. Safe to retry: the same clientMsgId always gives back the same message. */
  async send(me: string, conversationId: string, dto: SendMessageInput) {
    const c = await this.mine(me, conversationId);

    const existing = await this.prisma.message.findUnique({ where: { senderId_clientMsgId: { senderId: me, clientMsgId: dto.clientMsgId } } });
    if (existing) return this.duplicate(existing, conversationId);

    const other = c.userAId === me ? c.userB : c.userA;
    if (other.isBanned || other.deletedAt || (await this.isBlocked(me, other.id))) {
      throw new AppException(403, 'CANNOT_MESSAGE', 'You cannot message this person.');
    }

    try {
      const message = await this.prisma.$transaction(async (tx) => {
        // One statement takes the next number AND marks my side as "read up to it" (sending means I have
        // seen everything before). The row is locked until the transaction ends, so two messages can never
        // get the same number. In UPDATE, the right-hand sides see the OLD row, hence last_seq + 1 twice.
        const mineColumn = c.userAId === me ? Prisma.sql`a_read_seq` : Prisma.sql`b_read_seq`;
        const [{ last_seq: seq }] = await tx.$queryRaw<{ last_seq: number }[]>`
          UPDATE conversations
          SET last_seq = last_seq + 1, ${mineColumn} = last_seq + 1, last_message_at = now()
          WHERE id = ${conversationId}::uuid
          RETURNING last_seq`;
        return tx.message.create({
          data: { conversationId, senderId: me, clientMsgId: dto.clientMsgId, seq, body: dto.body },
          select: { id: true, seq: true, senderId: true, body: true, clientMsgId: true, createdAt: true },
        });
      });
      this.events.emit(MESSAGE_CREATED, { conversationId, recipientId: other.id, message });
      return { message, duplicate: false };
    } catch (e) {
      // Two identical requests raced: the loser finds the winner's message.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.prisma.message.findUnique({ where: { senderId_clientMsgId: { senderId: me, clientMsgId: dto.clientMsgId } } });
        if (winner) return this.duplicate(winner, conversationId);
      }
      throw e;
    }
  }

  /** "I have seen everything up to this message." Only ever moves forward. */
  async markRead(me: string, conversationId: string, upToSeq: number) {
    const c = await this.mine(me, conversationId);
    const value = Math.min(upToSeq, c.lastSeq);
    const column = c.userAId === me ? Prisma.sql`a_read_seq` : Prisma.sql`b_read_seq`;
    const [{ read_seq: readSeq }] = await this.prisma.$queryRaw<{ read_seq: number }[]>`
      UPDATE conversations SET ${column} = GREATEST(${column}, ${value})
      WHERE id = ${conversationId}::uuid
      RETURNING ${column} AS read_seq`;
    return { readSeq };
  }

  // ───────────────────────── helpers ─────────────────────────

  /** The conversation, but only if I am one of its two people. Anyone else gets "not found". */
  private async mine(me: string, conversationId: string): Promise<ConversationRow> {
    const c = await this.prisma.conversation.findFirst({
      where: { id: conversationId, OR: [{ userAId: me }, { userBId: me }] },
      include: { userA: { select: otherSelect }, userB: { select: otherSelect } },
    });
    if (!c) throw new AppException(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    return c;
  }

  private duplicate(existing: { conversationId: string } & Prisma.MessageGetPayload<{ select: typeof messageSelect }>, conversationId: string) {
    // Same clientMsgId used for a different chat: a bug in the caller, never silently accepted.
    if (existing.conversationId !== conversationId) throw new AppException(409, 'CLIENT_MSG_ID_REUSED', 'This message id was already used.');
    const { conversationId: _ignored, ...message } = existing;
    return { message, duplicate: true };
  }

  private summary(c: ConversationRow, me: string, last: { senderId: string; body: string; createdAt: Date } | null) {
    const isA = c.userAId === me;
    const other = isA ? c.userB : c.userA;
    return {
      id: c.id,
      other: { id: other.id, name: other.name, role: other.role },
      lastSeq: c.lastSeq,
      // I read my own messages the moment I send them, so "unread" is just the gap to the newest message.
      unreadCount: c.lastSeq - (isA ? c.aReadSeq : c.bReadSeq),
      lastMessageAt: c.lastMessageAt,
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

const messageSelect = { id: true, seq: true, senderId: true, body: true, clientMsgId: true, createdAt: true, conversationId: true } as const;

/** Smaller id first, the same order Postgres uses for uuids (lowercase hex sorts like the bytes). */
const sortPair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);
