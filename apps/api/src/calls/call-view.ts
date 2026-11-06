import type { CallInfo } from '@coach-connect/shared';
import type { Prisma } from '../generated/prisma/client.js';

/** What we load with a call to describe it to the phones: the starter's name and everybody's name. */
export const callInclude = {
  startedBy: { select: { name: true } },
  participants: { include: { user: { select: { name: true } } }, orderBy: { invitedAt: 'asc' } },
} satisfies Prisma.CallInclude;

export type CallRow = Prisma.CallGetPayload<{ include: typeof callInclude }>;

/** The shape sent to the phones (and pushed over the socket). */
export const toCallInfo = (call: CallRow): CallInfo => ({
  id: call.id,
  chatId: call.chatId,
  startedById: call.startedById,
  startedByName: call.startedBy.name,
  state: call.state,
  endReason: call.endReason,
  video: call.video,
  createdAt: call.createdAt.toISOString(),
  answeredAt: call.answeredAt?.toISOString() ?? null,
  endedAt: call.endedAt?.toISOString() ?? null,
  participants: call.participants.map((p) => ({
    userId: p.userId,
    name: p.user.name,
    status: p.status,
    joinedAt: p.joinedAt?.toISOString() ?? null,
    leftAt: p.leftAt?.toISOString() ?? null,
  })),
});
