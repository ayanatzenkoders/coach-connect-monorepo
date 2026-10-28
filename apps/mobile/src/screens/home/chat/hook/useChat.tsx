import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { SOCKET_EVENTS } from '@coach-connect/shared/realtime';
import type { ChatReadPayload, MessageNewPayload } from '@coach-connect/shared/realtime';
import { chatApi, ChatMessage, ChatSummary } from '@/src/service/api/chat.api';
import { withAuth } from '@/src/service/setup/withAuth';
import { showApiError } from '@/src/service/setup/handleApiError';
import { getSocket } from '@/src/service/socket/socket';
import { useAuthStore } from '@/src/store/auth.store';
import { showToast } from '@/src/store/toast.store';

/** A message as the screen sees it: one that is saved, or one still on its way (or that failed). */
export interface ChatItem extends Omit<ChatMessage, 'id' | 'sequenceNumber'> {
  id?: string;
  sequenceNumber?: number;
  status: 'sent' | 'sending' | 'failed';
}

const toItem = (m: ChatMessage): ChatItem => ({ ...m, status: 'sent' });

/** Random id for a new message; the server uses it to recognise a retry of the same message. */
const newClientMessageId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Merge new saved messages into the list. A saved message replaces our "sending" copy of it
 * (same clientMessageId) and is never added twice. Saved messages are kept in sequenceNumber order, with the
 * unsent ones at the end.
 */
export function mergeMessages(current: ChatItem[], incoming: ChatMessage[]): ChatItem[] {
  const byClientId = new Map(current.map((m) => [m.clientMessageId, m]));
  for (const m of incoming) byClientId.set(m.clientMessageId, toItem(m));
  const all = [...byClientId.values()];
  const saved = all.filter((m) => m.sequenceNumber !== undefined).sort((a, b) => a.sequenceNumber! - b.sequenceNumber!);
  const unsent = all.filter((m) => m.sequenceNumber === undefined);
  return [...saved, ...unsent];
}

/** The messages of one chat: sending, "seen", older pages, and live updates pushed by the server (socket). */
function useChatMessages(chatId: string, meId: string) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [otherLastReadSequenceNumber, setOtherLastReadSequenceNumber] = useState(0);
  const newest = useRef(0); // highest saved message number we hold
  const oldest = useRef<number | null>(null);
  const markedRead = useRef(0);
  const catchingUp = useRef(false);

  const markRead = useCallback(
    (upTo: number) => {
      if (upTo <= markedRead.current) return;
      markedRead.current = upTo;
      // "Seen" is a nicety: if this fails the next message tries again.
      withAuth((t) => chatApi.markRead(t, chatId, upTo)).catch(() => {
        markedRead.current = 0;
      });
    },
    [chatId],
  );

  /** Take in saved messages that arrived (from the first load or a refresh). */
  const absorb = useCallback(
    (messages: ChatMessage[]) => {
      if (messages.length === 0) return;
      setItems((cur) => mergeMessages(cur, messages));
      newest.current = Math.max(newest.current, ...messages.map((m) => m.sequenceNumber));
      oldest.current = Math.min(oldest.current ?? Infinity, ...messages.map((m) => m.sequenceNumber));
      const fromOthers = messages.filter((m) => m.senderId !== meId);
      if (fromOthers.length) markRead(Math.max(...fromOthers.map((m) => m.sequenceNumber)));
    },
    [markRead, meId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await withAuth((t) => chatApi.messages(t, chatId));
        if (cancelled) return;
        absorb(page.items);
        setHasOlder(page.hasMore);
        setOtherLastReadSequenceNumber(page.otherLastReadSequenceNumber);
      } catch (e) {
        if (!cancelled) showApiError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, absorb]);

  /**
   * Catch up: ask the server for everything newer than the newest message we hold.
   * This is the safety net behind the socket. It runs when the socket (re)connects, when the app returns
   * to the foreground, and when a pushed message arrives with a gap before it (we missed one).
   */
  const catchUp = useCallback(async () => {
    if (catchingUp.current || loading) return;
    catchingUp.current = true;
    try {
      const page = await withAuth((t) => chatApi.messages(t, chatId, { after: newest.current }));
      absorb(page.items);
      setOtherLastReadSequenceNumber(page.otherLastReadSequenceNumber);
    } catch {
      // Quiet on purpose: the next reconnect or push tries again, and sending shows its own errors.
    } finally {
      catchingUp.current = false;
    }
  }, [chatId, loading, absorb]);

  // REAL-TIME: listen to what the server pushes while this chat is open. Replaces asking every 3 seconds.
  useEffect(() => {
    if (loading) return; // wait for the first page, so "newest" below is a real number
    const socket = getSocket();

    // A message was saved in some chat of mine (either person's, also my own from another phone).
    const onNew = ({ chatId: id, message }: MessageNewPayload) => {
      if (id !== chatId) return; // another chat: the Messages list handles that
      if (newest.current > 0 && message.sequenceNumber > newest.current + 1) catchUp(); // a number is missing: fetch the gap
      else absorb([message]); // normal case. absorb() also tells the server "read" for the other person's messages
    };

    // The other person read up to N: my messages up to N change from "Sent" to "Seen".
    const onRead = ({ chatId: id, userId, lastReadSequenceNumber }: ChatReadPayload) => {
      if (id !== chatId || userId === meId) return; // my own reads are not news to me
      setOtherLastReadSequenceNumber((n) => Math.max(n, lastReadSequenceNumber)); // never goes backwards
    };

    socket.on(SOCKET_EVENTS.messageNew, onNew);
    socket.on(SOCKET_EVENTS.chatRead, onRead);
    socket.on('connect', catchUp); // after any gap in the connection, fetch what was missed
    const appState = AppState.addEventListener('change', (s) => s === 'active' && catchUp());
    return () => {
      socket.off(SOCKET_EVENTS.messageNew, onNew);
      socket.off(SOCKET_EVENTS.chatRead, onRead);
      socket.off('connect', catchUp);
      appState.remove();
    };
  }, [loading, chatId, meId, absorb, catchUp]);

  const loadOlder = useCallback(async () => {
    if (!hasOlder || loadingOlder || oldest.current === null) return;
    setLoadingOlder(true);
    try {
      const page = await withAuth((t) => chatApi.messages(t, chatId, { before: oldest.current! }));
      absorb(page.items);
      setHasOlder(page.hasMore);
    } catch (e) {
      showApiError(e);
    } finally {
      setLoadingOlder(false);
    }
  }, [hasOlder, loadingOlder, chatId, absorb]);

  const deliver = useCallback(
    async (clientMessageId: string, body: string) => {
      try {
        const { message } = await withAuth((t) => chatApi.send(t, chatId, { clientMessageId, body }));
        absorb([message]);
      } catch (e) {
        setItems((cur) => cur.map((m) => (m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m)));
        showApiError(e);
      }
    },
    [chatId, absorb],
  );

  const send = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!body) return;
      const clientMessageId = newClientMessageId();
      setItems((cur) => [...cur, { clientMessageId, senderId: meId, body, createdAt: new Date().toISOString(), status: 'sending' }]);
      deliver(clientMessageId, body);
    },
    [meId, deliver],
  );

  /** Try a failed message again. Same clientMessageId, so it cannot be saved twice. */
  const retry = useCallback(
    (clientMessageId: string) => {
      const item = items.find((m) => m.clientMessageId === clientMessageId);
      if (!item || item.status !== 'failed') return;
      setItems((cur) => cur.map((m) => (m.clientMessageId === clientMessageId ? { ...m, status: 'sending' } : m)));
      deliver(clientMessageId, item.body);
    },
    [items, deliver],
  );

  return { items, loading, hasOlder, loadingOlder, otherLastReadSequenceNumber, send, retry, loadOlder };
}

/** Everything the Chat screen needs: the other person, the messages, sending, and the header buttons. */
export function useChat(chat: ChatSummary) {
  const navigation = useNavigation();
  const meId = useAuthStore((s) => s.user?.id ?? '');
  const messages = useChatMessages(chat.id, meId);

  return {
    ...messages,
    meId,
    other: chat.other,
    goBack: () => navigation.goBack(),
    call: () => showToast(`Calling ${chat.other.name} is coming soon.`, 'info'),
  };
}
