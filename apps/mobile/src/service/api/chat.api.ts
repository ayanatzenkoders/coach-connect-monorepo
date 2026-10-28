import { API_ROUTES, withParams } from '@/src/constants';
import { apiRequest } from '@/src/service/setup/apiClient';
import type { ChatMessage, ChatSummary, MessagesPage } from '@coach-connect/shared/types';

export type { ChatMessage, ChatSummary, MessagesPage } from '@coach-connect/shared/types';

/** Plain request functions (no React). The hooks in this folder and in the screens' hook/ folders call them. */
export const chatApi = {
  chats: (accessToken: string) => apiRequest<{ items: ChatSummary[] }>(API_ROUTES.chat.chats, { accessToken }),

  /** Start or reopen the chat with someone. Same chat every time. */
  open: (accessToken: string, userId: string) => apiRequest<ChatSummary>(API_ROUTES.chat.chats, { method: 'POST', body: { userId }, accessToken }),

  messages: (accessToken: string, chatId: string, query: { before?: number; after?: number; limit?: number } = {}) => {
    const params = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const path = withParams(API_ROUTES.chat.messages, { id: chatId });
    return apiRequest<MessagesPage>(`${path}${params ? `?${params}` : ''}`, { accessToken });
  },

  /** Safe to repeat with the same clientMessageId: the server saves it once. */
  send: (accessToken: string, chatId: string, body: { clientMessageId: string; body: string }) =>
    apiRequest<{ message: ChatMessage; duplicate: boolean }>(withParams(API_ROUTES.chat.messages, { id: chatId }), { method: 'POST', body, accessToken }),

  markRead: (accessToken: string, chatId: string, upToSequenceNumber: number) =>
    apiRequest<{ lastReadSequenceNumber: number }>(withParams(API_ROUTES.chat.read, { id: chatId }), { method: 'POST', body: { upToSequenceNumber }, accessToken }),
};
