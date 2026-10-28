import type { ChatMessage, ChatSummary } from '@/src/service/api/chat.api';

/**
 * A chat summary for tests, with sensible defaults. Override only what the test is about:
 *    chatSummary({ id: 'a', unreadCount: 3 })
 *    groupSummary({ title: 'Team', memberCount: 4 })
 */
export const chatSummary = (over: Partial<ChatSummary> = {}): ChatSummary => {
  const id = over.id ?? 'chat-1';
  return {
    id,
    type: 'DIRECT',
    title: `Person ${id}`,
    other: { id: `other-${id}`, name: `Person ${id}`, role: 'COACH' },
    description: null,
    memberCount: 2,
    lastMessageSequenceNumber: 0,
    unreadCount: 0,
    lastMessageAt: null,
    lastMessage: null,
    canSend: true,
    ...over,
  };
};

export const groupSummary = (over: Partial<ChatSummary> = {}): ChatSummary =>
  chatSummary({ id: 'group-1', type: 'GROUP', title: 'Team Alpha', other: null, description: 'Weekly check-in', memberCount: 4, ...over });

/** A saved message for tests. */
export const chatMessage = (sequenceNumber: number, senderId: string, body: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `id-${sequenceNumber}`,
  sequenceNumber,
  senderId,
  senderName: senderId,
  body,
  clientMessageId: `cm-${sequenceNumber}-12345`,
  createdAt: '2026-10-27T10:00:00.000Z',
  ...over,
});
