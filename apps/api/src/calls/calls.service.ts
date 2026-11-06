import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CALL_RING_SECONDS, GROUP_MAX_MEMBERS, SOCKET_EVENTS } from '@coach-connect/shared';
import type { CallInfo, CallSession, ChatCall, StartCallInput, StartCallResult } from '@coach-connect/shared';
import { AppException } from '../common/errors/app.exception.js';
import type { CallEndReason, CallState, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { hasActiveAccess } from '../subscriptions/subscription-access.js';
import { callInclude, toCallInfo } from './call-view.js';
import { LiveKitService } from './livekit.service.js';

type Tx = Prisma.TransactionClient;

/** A call that has not ended yet. */
const LIVE: CallState[] = ['RINGING', 'ACTIVE'];

/**
 * All the call rules, in one place. Phones only send INTENTS (start, join, decline, cancel, leave);
 * this class decides what is allowed and what happens next.
 *
 * Two tools keep it safe when two people act at the same moment:
 *  1. An advisory lock per chat (`lockChat`): every change to a chat's call waits for the one before it, one at a time.
 *  2. Conditional updates ("... WHERE state = 'RINGING'"): the change only happens if the call is still in the
 *     state we expected. If someone else got there first, 0 rows change and we answer 409.
 * The push to the phones is always sent AFTER the database transaction has committed (like chat).
 */
@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly livekit: LiveKitService,
  ) {}

  // ───────────────────────── start ─────────────────────────

  /** Start a call in a chat. If the chat already has a live call, you are put into that one instead (`created: false`). */
  async start(me: string, input: StartCallInput): Promise<StartCallResult> {
    this.livekit.ensureConfigured(); // 503 now, instead of a half-made call later
    const plan = await this.prisma.$transaction(async (tx) => {
      await this.lockChat(tx, input.chatId);

      // Only members of the chat can call in it. A direct chat has exactly two members, so nobody else can ever join.
      const chat = await tx.chat.findFirst({
        where: { id: input.chatId, members: { some: { userId: me } } },
        include: {
          members: {
            include: {
              user: { select: { id: true, role: true, bannedAt: true, deletedAt: true, subscription: true, coachProfile: { select: { approved: true, available: true } } } },
            },
          },
        },
      });
      if (!chat) throw new AppException(404, 'CHAT_NOT_FOUND', 'Chat not found.');
      const self = chat.members.find((m) => m.userId === me)!.user;

      // Members need a subscription to START a call. (A coach can always call. Answering needs nothing.)
      if (self.role === 'MEMBER' && !hasActiveAccess(self.subscription)) {
        throw new AppException(403, 'SUBSCRIPTION_REQUIRED', 'Subscribe to start calls.');
      }

      // Already a live call in this chat? Then this is a "join", not a new call.
      const live = await tx.call.findFirst({ where: { chatId: input.chatId, state: { in: LIVE } }, select: { id: true } });
      if (live) return { callId: live.id, created: false, ring: [] as string[] };

      if (await this.isConnectedAnywhere(tx, [me]).then((ids) => ids.has(me))) {
        throw new AppException(409, 'ALREADY_IN_CALL', 'You are already in a call.');
      }

      // Who can we ring? Everybody else in the chat who is still a usable account.
      const others = chat.members.filter((m) => m.userId !== me && !m.user.bannedAt && !m.user.deletedAt && !(m.user.role === 'COACH' && !m.user.coachProfile?.approved));
      if (others.length === 0) throw new AppException(409, 'CANNOT_CALL', 'Nobody in this chat can take a call right now.');
      if (chat.type === 'DIRECT') {
        const other = others[0]!.user;
        if (other.role === 'COACH' && !other.coachProfile?.available) throw new AppException(409, 'COACH_UNAVAILABLE', 'This coach is not available for calls right now.');
      }

      // Anybody already in ANOTHER call is marked BUSY and is not rung.
      const busy = await this.isConnectedAnywhere(tx, others.map((m) => m.userId));
      const ringable = others.filter((m) => !busy.has(m.userId));
      if (ringable.length === 0) throw new AppException(409, 'CALLEE_BUSY', 'They are on another call. Try again in a moment.');

      const call = await tx.call.create({
        data: {
          chatId: input.chatId,
          startedById: me,
          video: input.video,
          roomName: `call_${randomUUID()}`,
          participants: {
            create: [
              { userId: me, status: 'JOINED', joinedAt: new Date() },
              ...ringable.map((m) => ({ userId: m.userId, status: 'INVITED' as const })),
              ...others.filter((m) => busy.has(m.userId)).map((m) => ({ userId: m.userId, status: 'BUSY' as const })),
            ],
          },
        },
        select: { id: true },
      });
      return { callId: call.id, created: true, ring: ringable.map((m) => m.userId) };
    });

    if (!plan.created) return { ...(await this.join(me, plan.callId)), created: false };

    const call = await this.load(plan.callId);
    // AFTER the commit: ring the phones that were invited, and tell everybody else in the chat (the "Call in progress" banner).
    this.realtime.emitToUsers(plan.ring, SOCKET_EVENTS.callIncoming, { call });
    this.realtime.emitToUsers(this.audience(call), SOCKET_EVENTS.callUpdated, { call });
    return { call, created: true, livekit: await this.livekit.joinPass(me, await this.nameOf(me), await this.roomOf(plan.callId)) };
  }

  // ───────────────────────── join ─────────────────────────

  /** Answer a ringing call, join one that is already running, or come back to a call you left. Answers with the LiveKit pass. */
  async join(me: string, callId: string): Promise<CallSession> {
    this.livekit.ensureConfigured();
    await this.inCallLock(callId, async (tx, call) => {
      // Fresh read under the lock: the call may have ended a moment ago (cancelled, timed out...).
      if (!LIVE.includes(call.state)) throw new AppException(409, 'CALL_ENDED', 'This call has ended.');

      // Only people in the chat may join, and never a banned account (the guard already stops banned tokens).
      const member = await tx.chatMember.findUnique({ where: { chatId_userId: { chatId: call.chatId, userId: me } }, select: { userId: true } });
      if (!member) throw new AppException(404, 'CALL_NOT_FOUND', 'Call not found.');

      const connectedElsewhere = await tx.callParticipant.count({ where: { userId: me, callId: { not: callId }, joinedAt: { not: null }, leftAt: null, call: { state: { in: LIVE } } } });
      if (connectedElsewhere > 0) throw new AppException(409, 'ALREADY_IN_CALL', 'You are already in another call.');

      const connected = await tx.callParticipant.count({ where: { callId, joinedAt: { not: null }, leftAt: null, userId: { not: me } } });
      if (connected >= GROUP_MAX_MEMBERS) throw new AppException(409, 'CALL_FULL', 'This call is full.');

      // One row per person per call: create it (late joiner) or reuse it (answering, coming back).
      const row = await tx.callParticipant.findUnique({ where: { callId_userId: { callId, userId: me } } });
      const now = new Date();
      if (row) {
        await tx.callParticipant.update({ where: { id: row.id }, data: { status: 'JOINED', joinedAt: row.joinedAt ?? now, leftAt: null } });
      } else {
        await tx.callParticipant.create({ data: { callId, userId: me, status: 'JOINED', joinedAt: now } });
      }

      // The first person besides the starter to join makes the call ACTIVE. Conditional update: only if it is still RINGING.
      if (call.state === 'RINGING' && call.startedById !== me) {
        await tx.call.updateMany({ where: { id: callId, state: 'RINGING' }, data: { state: 'ACTIVE', answeredAt: now } });
      }
    });

    const call = await this.afterChange(callId);
    return { call, livekit: await this.livekit.joinPass(me, await this.nameOf(me), await this.roomOf(callId)) };
  }

  // ───────────────────────── decline / cancel / leave ─────────────────────────

  /** "No thanks". Only for someone who is still being rung. In a group the call goes on without them. */
  async decline(me: string, callId: string): Promise<CallInfo> {
    await this.inCallLock(callId, async (tx) => {
      const changed = await tx.callParticipant.updateMany({
        where: { callId, userId: me, status: 'INVITED', call: { state: { in: LIVE } } },
        data: { status: 'DECLINED' },
      });
      if (changed.count === 0) throw new AppException(409, 'NOT_RINGING', 'This call is no longer ringing for you.');
      await this.settle(tx, callId);
    });
    return this.afterChange(callId);
  }

  /** The starter gives up before anyone answered. */
  async cancel(me: string, callId: string): Promise<CallInfo> {
    await this.inCallLock(callId, async (tx, call) => {
      if (call.startedById !== me) throw new AppException(403, 'NOT_CALL_STARTER', 'Only the person who started the call can cancel it.');
      // Conditional: only works while it is still RINGING. If someone answered a moment earlier, this finds nothing to change.
      const ended = await this.finish(tx, callId, 'CANCELED', ['RINGING']);
      if (!ended) throw new AppException(409, 'CALL_NOT_RINGING', 'Someone already answered.');
    });
    return this.afterChange(callId);
  }

  /** Hang up. Safe to repeat (a second "leave" changes nothing). */
  async leave(me: string, callId: string): Promise<CallInfo> {
    await this.inCallLock(callId, async (tx, call) => {
      const left = await tx.callParticipant.updateMany({
        where: { callId, userId: me, joinedAt: { not: null }, leftAt: null },
        data: { leftAt: new Date() },
      });
      if (left.count === 0 || call.state === 'ENDED') return;
      // The starter hanging up while it still rings = cancel. Otherwise see whether the call should end now.
      if (call.state === 'RINGING' && call.startedById === me) await this.finish(tx, callId, 'CANCELED', ['RINGING']);
      else await this.settle(tx, callId);
    });
    return this.afterChange(callId);
  }

  // ───────────────────────── reading ─────────────────────────

  /** The call that is live in a chat right now (for the "Call in progress" banner), or null. */
  async inChat(me: string, chatId: string): Promise<ChatCall> {
    const member = await this.prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: me } }, select: { userId: true } });
    if (!member) throw new AppException(404, 'CHAT_NOT_FOUND', 'Chat not found.');
    const row = await this.prisma.call.findFirst({ where: { chatId, state: { in: LIVE } }, include: callInclude });
    return { call: row ? toCallInfo(row) : null };
  }

  // ───────────────────────── bans, timeouts ─────────────────────────

  /** A banned person is taken out of every live call (and out of the LiveKit room). Called by BanService after the ban commits. */
  async removeBannedUser(userId: string): Promise<void> {
    const rows = await this.prisma.callParticipant.findMany({ where: { userId, call: { state: { in: LIVE } } }, select: { callId: true, call: { select: { roomName: true } } } });
    for (const { callId, call } of rows) {
      await this.inCallLock(callId, async (tx, fresh) => {
        const now = new Date();
        await tx.callParticipant.updateMany({ where: { callId, userId, joinedAt: { not: null }, leftAt: null }, data: { leftAt: now } });
        await tx.callParticipant.updateMany({ where: { callId, userId, status: 'INVITED' }, data: { status: 'MISSED' } });
        if (fresh.state === 'RINGING' && fresh.startedById === userId) await this.finish(tx, callId, 'BANNED', ['RINGING']);
        else await this.settle(tx, callId);
      });
      await this.livekit.kick(call.roomName, userId);
      await this.afterChange(callId);
    }
  }

  /**
   * Run every few seconds by RingSweeper.
   *  1. A call that has rung for 30 s with nobody answering ends (NO_ANSWER); everyone still INVITED becomes MISSED.
   *  2. In a call that is already running, people who were rung but did not answer in 30 s become MISSED.
   * Safe if two servers sweep at once: the lock and the conditional updates let only one of them change anything.
   */
  async sweep(now: Date = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - CALL_RING_SECONDS * 1000);

    const unanswered = await this.prisma.call.findMany({ where: { state: 'RINGING', createdAt: { lt: cutoff } }, select: { id: true }, take: 100 });
    for (const { id } of unanswered) {
      await this.inCallLock(id, async (tx) => {
        await this.finish(tx, id, 'NO_ANSWER', ['RINGING']); // does nothing if someone answered a moment ago
      });
      await this.afterChange(id);
    }

    const stillRinging = await this.prisma.callParticipant.findMany({
      where: { status: 'INVITED', call: { state: 'ACTIVE', createdAt: { lt: cutoff } } },
      select: { callId: true },
      distinct: ['callId'],
      take: 100,
    });
    for (const { callId } of stillRinging) {
      await this.inCallLock(callId, async (tx) => {
        await tx.callParticipant.updateMany({ where: { callId, status: 'INVITED', call: { state: 'ACTIVE' } }, data: { status: 'MISSED' } });
      });
      await this.afterChange(callId);
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  /**
   * One transaction that first takes the chat's lock. Everything that changes a call goes through here, so changes to
   * the same chat's call happen one after the other. `body` gets a fresh copy of the call, read AFTER the lock.
   */
  private async inCallLock(callId: string, body: (tx: Tx, call: { chatId: string; state: CallState; startedById: string }) => Promise<void>): Promise<void> {
    const first = await this.prisma.call.findUnique({ where: { id: callId }, select: { chatId: true } });
    if (!first) throw new AppException(404, 'CALL_NOT_FOUND', 'Call not found.');
    await this.prisma.$transaction(async (tx) => {
      await this.lockChat(tx, first.chatId);
      const call = await tx.call.findUniqueOrThrow({ where: { id: callId }, select: { chatId: true, state: true, startedById: true } });
      await body(tx, call);
    });
  }

  /** "Wait your turn": a lock on this chat's calls that is released automatically when the transaction ends. */
  private async lockChat(tx: Tx, chatId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`call:${chatId}`}))`;
  }

  /** Which of these people are connected to a live call right now? (The partial index makes this a tiny lookup.) */
  private async isConnectedAnywhere(tx: Tx, userIds: string[]): Promise<Set<string>> {
    const rows = await tx.callParticipant.findMany({
      where: { userId: { in: userIds }, joinedAt: { not: null }, leftAt: null, call: { state: { in: LIVE } } },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  }

  /**
   * End a call, but ONLY if it is still in one of the states in `onlyIf`. Returns false when it was not
   * (somebody else already changed it). On success everyone still INVITED becomes MISSED and everyone connected leaves.
   */
  private async finish(tx: Tx, callId: string, reason: CallEndReason, onlyIf: CallState[] = LIVE): Promise<boolean> {
    const now = new Date();
    const ended = await tx.call.updateMany({ where: { id: callId, state: { in: onlyIf } }, data: { state: 'ENDED', endReason: reason, endedAt: now } });
    if (ended.count === 0) return false;
    await tx.callParticipant.updateMany({ where: { callId, status: 'INVITED' }, data: { status: 'MISSED' } });
    await tx.callParticipant.updateMany({ where: { callId, joinedAt: { not: null }, leftAt: null }, data: { leftAt: now } });
    return true;
  }

  /** After a decline or a leave: should the call end now? */
  private async settle(tx: Tx, callId: string): Promise<void> {
    const call = await tx.call.findUniqueOrThrow({ where: { id: callId }, include: { chat: { select: { type: true } }, participants: true } });
    if (call.state === 'ENDED') return;
    const connected = call.participants.filter((p) => p.joinedAt && !p.leftAt).length;
    const invited = call.participants.filter((p) => p.status === 'INVITED').length;

    if (call.state === 'RINGING' && invited === 0) {
      // Nobody left to ring. If every person who was rung said no, it is DECLINED; otherwise NO_ANSWER.
      const rung = call.participants.filter((p) => p.userId !== call.startedById && p.status !== 'BUSY');
      await this.finish(tx, callId, rung.length > 0 && rung.every((p) => p.status === 'DECLINED') ? 'DECLINED' : 'NO_ANSWER', ['RINGING']);
    } else if (call.state === 'ACTIVE') {
      // A direct call is over when either person leaves. A group call goes on until the last person leaves.
      const over = call.chat.type === 'DIRECT' ? connected < 2 : connected === 0;
      if (over) await this.finish(tx, callId, 'COMPLETED', ['ACTIVE']);
    }
  }

  private async load(callId: string): Promise<CallInfo> {
    return toCallInfo(await this.prisma.call.findUniqueOrThrow({ where: { id: callId }, include: callInclude }));
  }

  /** After the commit: tell everybody in the call's chat what changed, and close the LiveKit room if the call is over. */
  private async afterChange(callId: string): Promise<CallInfo> {
    const call = await this.load(callId);
    this.realtime.emitToUsers(this.audience(call), SOCKET_EVENTS.callUpdated, { call });
    if (call.state === 'ENDED') await this.livekit.closeRoom(await this.roomOf(callId));
    return call;
  }

  /** Everybody who has a row in the call = everybody in the chat who was rung, was busy, or is in it. */
  private audience(call: CallInfo): string[] {
    return call.participants.map((p) => p.userId);
  }

  private async roomOf(callId: string): Promise<string> {
    return (await this.prisma.call.findUniqueOrThrow({ where: { id: callId }, select: { roomName: true } })).roomName;
  }

  private async nameOf(userId: string): Promise<string> {
    return (await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } })).name;
  }
}
