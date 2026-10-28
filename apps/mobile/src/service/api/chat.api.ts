import { API_ROUTES, withParams } from '@/src/constants';
import { apiRequest } from '@/src/service/setup/apiClient';
import type { ChatDetail, ChatMessage, ChatSummary, MessagesPage } from '@coach-connect/shared/types';

export type { ChatDetail, ChatMemberInfo, ChatMessage, ChatSummary, MessagesPage } from '@coach-connect/shared/types';

/** What the New group screen sends. The server adds me to the group. */
export interface NewGroup {
  title: string;
  description?: string;
  memberIds: string[];
}

/** Plain request functions (no React). The hooks in this folder and in the screens' hook/ folders call them. */
export const chatApi = {
  chats: (accessToken: string) => apiRequest<{ items: ChatSummary[] }>(API_ROUTES.chat.chats, { accessToken }),

  /** Start or reopen the chat with someone. Same chat every time. */
  open: (accessToken: string, userId: string) => apiRequest<ChatSummary>(API_ROUTES.chat.chats, { method: 'POST', body: { userId }, accessToken }),

  /** Create a group chat (3 to 6 people including me, at most one coach). */
  createGroup: (accessToken: string, group: NewGroup) => apiRequest<ChatSummary>(API_ROUTES.chat.groups, { method: 'POST', body: group, accessToken }),

  /** Add people to a group (only its creator can; the server re-checks size and the one-coach rule). */
  addMembers: (accessToken: string, chatId: string, memberIds: string[]) =>
    apiRequest<ChatDetail>(withParams(API_ROUTES.chat.members, { id: chatId }), { method: 'POST', body: { memberIds }, accessToken }),

  /** Delete a group for everybody, messages included (only its creator can). */
  deleteGroup: (accessToken: string, chatId: string) => apiRequest<{ deleted: true }>(withParams(API_ROUTES.chat.detail, { id: chatId }), { method: 'DELETE', accessToken }),

  /** One chat with its people (the group info screen). */
  detail: (accessToken: string, chatId: string) => apiRequest<ChatDetail>(withParams(API_ROUTES.chat.detail, { id: chatId }), { accessToken }),

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
