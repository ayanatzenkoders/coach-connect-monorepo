// REST contract shared by API clients and the server. Paths only: each app owns its HTTP client.
// Routes with a parameter use `:name`; fill it in with `withParams`.
export const API_ROUTES = {
  health: "/health",
  auth: {
    register: "/auth/register",
    registerCoach: "/auth/register-coach",
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
    me: "/auth/me",
    emailSendCode: "/auth/email/send-code",
    emailVerify: "/auth/email/verify",
    passwordForgot: "/auth/password/forgot",
    passwordVerifyCode: "/auth/password/verify-code",
    passwordReset: "/auth/password/reset",
  },
  admin: {
    login: "/admin/auth/login",
    users: "/admin/users",
    stats: "/admin/stats",
    user: "/admin/users/:id",
    coachApprove: "/admin/coaches/:id/approve",
    ban: "/admin/users/:id/ban",
    unban: "/admin/users/:id/unban",
  },
  /** A coach managing their own profile. */
  coaches: {
    /** POST { available } = switch "Available now" on or off. */
    availability: "/coaches/me/availability",
  },
  /** Voice/video calls. Intents go over REST; the answers are pushed over the socket (see realtime.ts). */
  calls: {
    /** POST { chatId, video } = start a call in a chat (or get the one already live). */
    start: "/calls",
    /** POST = join (answer, join late, or come back to a call you left). Answers with the LiveKit token. */
    join: "/calls/:id/join",
    /** POST = "no thanks" (only while it rings). */
    decline: "/calls/:id/decline",
    /** POST = the starter gives up before anyone answered. */
    cancel: "/calls/:id/cancel",
    /** POST = leave (hang up). */
    leave: "/calls/:id/leave",
    /** GET = the call that is live in this chat right now, or null (drives the "Call in progress" banner). */
    inChat: "/chats/:id/call",
  },
  people: "/people",
  chat: {
    chats: "/chats",
    groups: "/chats/groups",
    /** GET = the chat with its people; DELETE = delete a group (its creator only). */
    detail: "/chats/:id",
    /** POST = add people to a group (its creator only). */
    members: "/chats/:id/members",
    messages: "/chats/:id/messages",
    read: "/chats/:id/read",
  },
} as const;

/** `withParams(API_ROUTES.chat.messages, { id })` -> "/chats/<id>/messages" */
export function withParams(route: string, params: Record<string, string>): string {
  return route.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ""));
}

/** The shape of every error body the API sends. `code` is what the apps switch on. */
export type ApiError = {
  statusCode: number;
  code?: string;
  message: string | string[];
  errors?: Record<string, string[]>;
  [extra: string]: unknown;
};
