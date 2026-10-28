// Real-time (Socket.IO) contract shared by the API and the mobile app.
// The server PUSHES these events; sending and reading still go through REST (see API_ROUTES.chat).
// An event only says "something changed". The app can always fetch the truth over REST.
import type { ChatMessage } from "./types";

export const SOCKET_EVENTS = {
  /** A message was saved in a chat I am a member of (I may be the sender, on another device). */
  messageNew: "message:new",
  /** Someone in one of my chats read up to a message number (drives "Seen" and unread badges). */
  chatRead: "chat:read",
  /** I was added to a new chat (a group someone created): reload the chat list. */
  chatCreated: "chat:created",
  /** The people in one of my groups changed (someone was added): reload its info and the list. */
  chatUpdated: "chat:updated",
  /** A group I was in was deleted by its creator. */
  chatDeleted: "chat:deleted",
} as const;

export interface MessageNewPayload {
  chatId: string;
  message: ChatMessage;
}

export interface ChatReadPayload {
  chatId: string;
  /** Who read. The app ignores its own reads. */
  userId: string;
  lastReadSequenceNumber: number;
}

export interface ChatCreatedPayload {
  chatId: string;
}

export interface ChatUpdatedPayload {
  chatId: string;
}

export interface ChatDeletedPayload {
  chatId: string;
}

