import { API_ROUTES, withParams } from '@/src/constants';
import { apiRequest } from '@/src/service/setup/apiClient';
import type { ChatMessage, ConversationSummary, MessagesPage } from '@coach-connect/shared/types';

export type { ChatMessage, ConversationSummary, MessagesPage } from '@coach-connect/shared/types';

/** Plain request functions (no React). The hooks in this folder and in the screens' hook/ folders call them. */
export const chatApi = {
  conversations: (accessToken: string) => apiRequest<{ items: ConversationSummary[] }>(API_ROUTES.chat.conversations, { accessToken }),

  /** Start or reopen the chat with someone. Same conversation every time. */
  open: (accessToken: string, userId: string) => apiRequest<ConversationSummary>(API_ROUTES.chat.conversations, { method: 'POST', body: { userId }, accessToken }),

  messages: (accessToken: string, conversationId: string, query: { before?: number; after?: number; limit?: number } = {}) => {
    const params = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const path = withParams(API_ROUTES.chat.messages, { id: conversationId });
    return apiRequest<MessagesPage>(`${path}${params ? `?${params}` : ''}`, { accessToken });
  },

  /** Safe to repeat with the same clientMsgId: the server saves it once. */
  send: (accessToken: string, conversationId: string, body: { clientMsgId: string; body: string }) =>
    apiRequest<{ message: ChatMessage; duplicate: boolean }>(withParams(API_ROUTES.chat.messages, { id: conversationId }), { method: 'POST', body, accessToken }),

  markRead: (accessToken: string, conversationId: string, upToSeq: number) =>
    apiRequest<{ readSeq: number }>(withParams(API_ROUTES.chat.read, { id: conversationId }), { method: 'POST', body: { upToSeq }, accessToken }),
};
