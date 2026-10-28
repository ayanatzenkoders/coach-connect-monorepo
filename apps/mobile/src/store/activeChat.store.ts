import { create } from 'zustand';

/**
 * Which chat screen is open right now (null = none). The unread counter reads it: a message that arrives in
 * the chat you are looking at is read at once, so it must not flash up as "1 unread" on the tab bar.
 */
interface ActiveChatState {
  chatId: string | null;
  set: (chatId: string | null) => void;
}

export const useActiveChatStore = create<ActiveChatState>()((set) => ({
  chatId: null,
  set: (chatId) => set({ chatId }),
}));
