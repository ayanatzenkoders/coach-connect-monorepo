import { applyMessageNew, applyMyRead, removeChat, totalUnread } from '@/src/screens/home/messages/chatsCache';
import type { ChatSummary } from '@/src/service/api/chat.api';
import { chatSummary } from '../../test-utils/chat';
import type { MessageNewPayload } from '@coach-connect/shared/realtime';

const ME = 'me';
const chat = (id: string, last: number, unread: number, at: string | null = '2026-10-27T10:00:00.000Z'): ChatSummary =>
  chatSummary({ id, lastMessageSequenceNumber: last, unreadCount: unread, lastMessageAt: at, lastMessage: at ? { senderId: `other-${id}`, senderName: `Person ${id}`, body: 'old', createdAt: at } : null });
const pushed = (chatId: string, sequenceNumber: number, senderId: string, body = 'hello'): MessageNewPayload => ({
  chatId,
  message: { id: `m${sequenceNumber}`, sequenceNumber, senderId, senderName: `Name of ${senderId}`, body, clientMessageId: `client-${sequenceNumber}-12345`, createdAt: '2026-10-28T09:00:00.000Z' },
});

describe('totalUnread', () => {
  it('adds up every chat, and is 0 for nothing', () => {
    expect(totalUnread([chat('a', 5, 2), chat('b', 3, 0), chat('c', 9, 4)])).toBe(6);
    expect(totalUnread([])).toBe(0);
    expect(totalUnread(undefined)).toBe(0);
  });
});

describe('applyMessageNew', () => {
  it('counts the other person\'s next message as unread, updates the preview and moves the chat to the top', () => {
    const list = [chat('a', 5, 0, '2026-10-27T10:00:00.000Z'), chat('b', 3, 1, '2026-10-26T10:00:00.000Z')];
    const next = applyMessageNew(list, pushed('b', 4, 'other-b', 'brand new'), ME, null)!;
    expect(next.map((c) => c.id)).toEqual(['b', 'a']);
    expect(next[0]).toMatchObject({ lastMessageSequenceNumber: 4, unreadCount: 2, lastMessage: { body: 'brand new', senderId: 'other-b', senderName: 'Name of other-b' }, lastMessageAt: '2026-10-28T09:00:00.000Z' });
    expect(totalUnread(next)).toBe(2);
  });

  it('does not count a message in the chat that is open on screen (it is read at once)', () => {
    const next = applyMessageNew([chat('a', 5, 0)], pushed('a', 6, 'other-a'), ME, 'a')!;
    expect(next[0]).toMatchObject({ lastMessageSequenceNumber: 6, unreadCount: 0 });
  });

  it('my own message (sent from another device) leaves nothing unread in that chat', () => {
    const next = applyMessageNew([chat('a', 5, 3)], pushed('a', 6, ME), ME, null)!;
    expect(next[0]!.unreadCount).toBe(0);
  });

  it('ignores a message number it already has (the same push twice, or a catch-up that got there first)', () => {
    const list = [chat('a', 5, 1)];
    expect(applyMessageNew(list, pushed('a', 5, 'other-a'), ME, null)).toBe(list);
    expect(applyMessageNew(list, pushed('a', 3, 'other-a'), ME, null)).toBe(list);
  });

  it('asks for a reload (null) when it cannot be sure: a gap in the numbers, or a chat it does not know', () => {
    expect(applyMessageNew([chat('a', 5, 0)], pushed('a', 8, 'other-a'), ME, null)).toBeNull();
    expect(applyMessageNew([chat('a', 5, 0)], pushed('new-chat', 1, 'other-new'), ME, null)).toBeNull();
  });

  it('never changes the list it was given', () => {
    const list = [chat('a', 5, 0)];
    const copy = JSON.stringify(list);
    applyMessageNew(list, pushed('a', 6, 'other-a'), ME, null);
    expect(JSON.stringify(list)).toBe(copy);
  });
});

describe('applyMyRead', () => {
  it('unread is what is left after the number I read, and never below 0', () => {
    expect(applyMyRead([chat('a', 10, 6)], 'a', 7)[0]!.unreadCount).toBe(3);
    expect(applyMyRead([chat('a', 10, 6)], 'a', 10)[0]!.unreadCount).toBe(0);
    expect(applyMyRead([chat('a', 10, 6)], 'a', 99)[0]!.unreadCount).toBe(0);
  });

  it('returns the SAME list when nothing changes (no needless re-render), and leaves other chats alone', () => {
    const list = [chat('a', 10, 0), chat('b', 4, 4)];
    expect(applyMyRead(list, 'a', 10)).toBe(list);
    expect(applyMyRead(list, 'zzz', 3)).toBe(list);
    const next = applyMyRead(list, 'a', 10);
    expect(next[1]).toBe(list[1]);
  });
});

describe('removeChat', () => {
  it('takes the chat out, leaving the others', () => {
    expect(removeChat([chat('a', 1, 0), chat('b', 1, 0)], 'a').map((c) => c.id)).toEqual(['b']);
  });

  it('returns the SAME list when the chat is not there', () => {
    const list = [chat('a', 1, 0)];
    expect(removeChat(list, 'zzz')).toBe(list);
  });
});
