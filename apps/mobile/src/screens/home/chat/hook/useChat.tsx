import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi, ChatMessage, ConversationSummary } from '@/src/service/api/chat.api';
import { withAuth } from '@/src/service/setup/withAuth';
import { showApiError } from '@/src/service/setup/handleApiError';
import { useAuthStore } from '@/src/store/auth.store';
import { showToast } from '@/src/store/toast.store';
import { useInterval } from '@/src/utils/hooks/useInterval';

/** How often the open chat asks "anything new?" (real-time sockets come in a later step). */
export const CHAT_POLL_MS = 3000;

/** A message as the screen sees it: one that is saved, or one still on its way (or that failed). */
export interface ChatItem extends Omit<ChatMessage, 'id' | 'seq'> {
  id?: string;
  seq?: number;
  status: 'sent' | 'sending' | 'failed';
}

const toItem = (m: ChatMessage): ChatItem => ({ ...m, status: 'sent' });

/** Random id for a new message; the server uses it to recognise a retry of the same message. */
const newClientMsgId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Merge new saved messages into the list. A saved message replaces our "sending" copy of it
 * (same clientMsgId) and is never added twice. Saved messages are kept in seq order, with the
 * unsent ones at the end.
 */
export function mergeMessages(current: ChatItem[], incoming: ChatMessage[]): ChatItem[] {
  const byClientId = new Map(current.map((m) => [m.clientMsgId, m]));
  for (const m of incoming) byClientId.set(m.clientMsgId, toItem(m));
  const all = [...byClientId.values()];
  const saved = all.filter((m) => m.seq !== undefined).sort((a, b) => a.seq! - b.seq!);
  const unsent = all.filter((m) => m.seq === undefined);
  return [...saved, ...unsent];
}

/** The messages of one chat: sending, "seen", older pages and the 3-second refresh. */
function useChatMessages(conversationId: string, meId: string) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [otherReadSeq, setOtherReadSeq] = useState(0);
  const newest = useRef(0); // highest saved message number we hold
  const oldest = useRef<number | null>(null);
  const markedRead = useRef(0);
  const polling = useRef(false);

  const markRead = useCallback(
    (upTo: number) => {
      if (upTo <= markedRead.current) return;
      markedRead.current = upTo;
      // "Seen" is a nicety: if this fails the next message tries again.
      withAuth((t) => chatApi.markRead(t, conversationId, upTo)).catch(() => {
        markedRead.current = 0;
      });
    },
    [conversationId],
  );

  /** Take in saved messages that arrived (from the first load or a refresh). */
  const absorb = useCallback(
    (messages: ChatMessage[]) => {
      if (messages.length === 0) return;
      setItems((cur) => mergeMessages(cur, messages));
      newest.current = Math.max(newest.current, ...messages.map((m) => m.seq));
      oldest.current = Math.min(oldest.current ?? Infinity, ...messages.map((m) => m.seq));
      const fromOthers = messages.filter((m) => m.senderId !== meId);
      if (fromOthers.length) markRead(Math.max(...fromOthers.map((m) => m.seq)));
    },
    [markRead, meId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await withAuth((t) => chatApi.messages(t, conversationId));
        if (cancelled) return;
        absorb(page.items);
        setHasOlder(page.hasMore);
        setOtherReadSeq(page.otherReadSeq);
      } catch (e) {
        if (!cancelled) showApiError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, absorb]);

  const refresh = useCallback(async () => {
    if (polling.current || loading) return;
    polling.current = true;
    try {
      const page = await withAuth((t) => chatApi.messages(t, conversationId, { after: newest.current }));
      absorb(page.items);
      setOtherReadSeq(page.otherReadSeq);
    } catch {
      // Quiet on purpose: the next tick tries again, and sending shows its own errors.
    } finally {
      polling.current = false;
    }
  }, [conversationId, loading, absorb]);
  useInterval(refresh, loading ? null : CHAT_POLL_MS);

  const loadOlder = useCallback(async () => {
    if (!hasOlder || loadingOlder || oldest.current === null) return;
    setLoadingOlder(true);
    try {
      const page = await withAuth((t) => chatApi.messages(t, conversationId, { before: oldest.current! }));
      absorb(page.items);
      setHasOlder(page.hasMore);
    } catch (e) {
      showApiError(e);
    } finally {
      setLoadingOlder(false);
    }
  }, [hasOlder, loadingOlder, conversationId, absorb]);

  const deliver = useCallback(
    async (clientMsgId: string, body: string) => {
      try {
        const { message } = await withAuth((t) => chatApi.send(t, conversationId, { clientMsgId, body }));
        absorb([message]);
      } catch (e) {
        setItems((cur) => cur.map((m) => (m.clientMsgId === clientMsgId ? { ...m, status: 'failed' } : m)));
        showApiError(e);
      }
    },
    [conversationId, absorb],
  );

  const send = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!body) return;
      const clientMsgId = newClientMsgId();
      setItems((cur) => [...cur, { clientMsgId, senderId: meId, body, createdAt: new Date().toISOString(), status: 'sending' }]);
      deliver(clientMsgId, body);
    },
    [meId, deliver],
  );

  /** Try a failed message again. Same clientMsgId, so it cannot be saved twice. */
  const retry = useCallback(
    (clientMsgId: string) => {
      const item = items.find((m) => m.clientMsgId === clientMsgId);
      if (!item || item.status !== 'failed') return;
      setItems((cur) => cur.map((m) => (m.clientMsgId === clientMsgId ? { ...m, status: 'sending' } : m)));
      deliver(clientMsgId, item.body);
    },
    [items, deliver],
  );

  return { items, loading, hasOlder, loadingOlder, otherReadSeq, send, retry, loadOlder };
}

/** Everything the Chat screen needs: the other person, the messages, sending, and the header buttons. */
export function useChat(conversation: ConversationSummary) {
  const navigation = useNavigation();
  const meId = useAuthStore((s) => s.user?.id ?? '');
  const messages = useChatMessages(conversation.id, meId);

  return {
    ...messages,
    meId,
    other: conversation.other,
    goBack: () => navigation.goBack(),
    call: () => showToast(`Calling ${conversation.other.name} is coming soon.`, 'info'),
  };
}
