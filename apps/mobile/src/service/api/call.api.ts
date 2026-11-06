import { API_ROUTES, withParams } from '@/src/constants';
import { apiRequest } from '@/src/service/setup/apiClient';
import type { CallInfo, CallSession, ChatCall, StartCallResult } from '@coach-connect/shared/types';

export type { CallInfo, CallParticipantInfo, CallSession, ChatCall, StartCallResult } from '@coach-connect/shared/types';

/**
 * Plain request functions for calls (no React). These only send INTENTS ("I want to start / join / leave");
 * what actually happens comes back in the answer and is pushed to everybody over the socket (call:incoming, call:updated).
 */
export const callApi = {
  /** Start a call in a chat. If the chat already has a live call you are put into it (`created: false`). */
  start: (accessToken: string, body: { chatId: string; video: boolean }) => apiRequest<StartCallResult>(API_ROUTES.calls.start, { method: 'POST', body, accessToken }),

  /** Answer, join late, or come back. The answer carries the LiveKit address and pass for the room. */
  join: (accessToken: string, callId: string) => apiRequest<CallSession>(withParams(API_ROUTES.calls.join, { id: callId }), { method: 'POST', accessToken }),

  decline: (accessToken: string, callId: string) => apiRequest<CallInfo>(withParams(API_ROUTES.calls.decline, { id: callId }), { method: 'POST', accessToken }),

  /** The starter gives up before anyone answered. */
  cancel: (accessToken: string, callId: string) => apiRequest<CallInfo>(withParams(API_ROUTES.calls.cancel, { id: callId }), { method: 'POST', accessToken }),

  /** Hang up. Safe to send twice. */
  leave: (accessToken: string, callId: string) => apiRequest<CallInfo>(withParams(API_ROUTES.calls.leave, { id: callId }), { method: 'POST', accessToken }),

  /** The call that is live in a chat right now, or `{call: null}`. */
  inChat: (accessToken: string, chatId: string) => apiRequest<ChatCall>(withParams(API_ROUTES.calls.inChat, { id: chatId }), { accessToken }),
};
