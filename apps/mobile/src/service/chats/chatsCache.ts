import type { ChatSummary } from '@/src/service/api/chat.api';
import type { MessageNewPayload } from '@coach-connect/shared/realtime';

/**
 * Pure helpers that keep the cached list of chats (`['chats']`) up to date from socket events, so the
 * unread total on the tab bar changes at once and no request is needed. When a helper cannot be sure
 * (an unknown chat, a missing message number) it returns `null`: the caller then reloads the list from the server.
 */

/** Sum of the unread messages of every chat. This is the number on the Messages tab. */
export const totalUnread = (chats: ChatSummary[] | undefined): number => (chats ?? []).reduce((sum, chat) => sum + chat.unreadCount, 0);

/**
 * A message was saved in one of my chats.
 *  - newer than what we hold, and exactly the next number: update the preview, and count it as unread if it is
 *    from the other person and I am not looking at that chat (an open chat reads it immediately)
 *  - a number we already hold (the same push twice, or a catch-up that got there first): nothing changes
 *  - a gap, or a chat we do not have: null (reload)
 */
export function applyMessageNew(chats: ChatSummary[], payload: MessageNewPayload, meId: string, openChatId: string | null): ChatSummary[] | null {
  const chat = chats.find((c) => c.id === payload.chatId);
  if (!chat) return null;

  const { message } = payload;
  if (message.sequenceNumber <= chat.lastMessageSequenceNumber) return chats;
  if (message.sequenceNumber !== chat.lastMessageSequenceNumber + 1) return null;

  const mine = message.senderId === meId;
  const updated: ChatSummary = {
    ...chat,
    lastMessageSequenceNumber: message.sequenceNumber,
    lastMessageAt: message.createdAt,
    lastMessage: { senderId: message.senderId, senderName: message.senderName, body: message.body, createdAt: message.createdAt },
    // Sending a message also marks everything before it as read for the sender, so mine leaves 0 unread.
    unreadCount: mine ? 0 : payload.chatId === openChatId ? chat.unreadCount : chat.unreadCount + 1,
  };
  return [updated, ...chats.filter((c) => c.id !== chat.id)]; // newest chat first, like the server's list
}

/** I have read this chat up to `lastRead`: unread is what is left after it. Never goes below 0. */
export function applyMyRead(chats: ChatSummary[], chatId: string, lastRead: number): ChatSummary[] {
  let changed = false;
  const next = chats.map((chat) => {
    if (chat.id !== chatId) return chat;
    const unreadCount = Math.max(0, chat.lastMessageSequenceNumber - lastRead);
    if (unreadCount === chat.unreadCount) return chat;
    changed = true;
    return { ...chat, unreadCount };
  });
  return changed ? next : chats; // same array when nothing changed: no re-render
}

/** A group was deleted: take it out of the list (same array when we did not have it). */
export const removeChat = (chats: ChatSummary[], chatId: string): ChatSummary[] => (chats.some((c) => c.id === chatId) ? chats.filter((c) => c.id !== chatId) : chats);
