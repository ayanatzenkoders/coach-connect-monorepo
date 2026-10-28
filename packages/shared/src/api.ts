// REST contract shared by API clients and the server. Paths only: each app owns its HTTP client.
// Routes with a parameter use `:name`; fill it in with `withParams`.
export const API_ROUTES = {
  health: "/health",
  auth: {
    register: "/auth/register",
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
    user: "/admin/users/:id",
    ban: "/admin/users/:id/ban",
    unban: "/admin/users/:id/unban",
  },
  people: "/people",
  chat: {
    chats: "/chats",
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
