// Response shapes of the API, as plain types (no runtime code: safe to import anywhere, mobile included).
// They mirror what apps/api returns.

export type Role = "MEMBER" | "COACH" | "SUPPORT" | "ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
}

/** Answer of login, register and refresh. */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token stops working (900 = 15 minutes). */
  expiresIn: number;
  user: User;
}

export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "GRACE_PERIOD" | "CANCELLED_ACTIVE" | "EXPIRED";

/** Answer of GET /auth/me. */
export interface Me extends User {
  subscription: { status: SubscriptionStatus; expiresAt: string | null } | null;
  /** True when this person may start calls right now (coaches always can). */
  canCall: boolean;
}

/** Answer of "send me a code". */
export interface CodeSent {
  expiresInSeconds: number;
  /** The app must wait this long before asking for another code. */
  resendAfterSeconds: number;
}

export interface Person {
  id: string;
  name: string;
  role: "MEMBER" | "COACH";
  /** Coaches only: */
  bio?: string;
  specialties?: string[];
  available?: boolean;
}

export interface PeoplePage {
  items: Person[];
  /** Everyone matching the filters, not just this page. */
  total: number;
  /** Send back as `cursor` for the next page; null = this was the last page. */
  nextCursor: string | null;
  /** Coaches tab only: every specialty on offer (the filter chips). */
  specialties?: string[];
}

export interface ChatSummary {
  id: string;
  other: { id: string; name: string; role: "MEMBER" | "COACH" };
  /** Number of the newest message in this chat. */
  lastMessageSequenceNumber: number;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessage: { senderId: string; body: string; createdAt: string } | null;
}

export interface ChatMessage {
  id: string;
  /** 1, 2, 3 ... inside the chat: the order everybody sees. */
  sequenceNumber: number;
  senderId: string;
  body: string;
  /** Made by the sending app; lets it recognise its own message when it comes back. */
  clientMessageId: string;
  createdAt: string;
}

export interface MessagesPage {
  /** Oldest first. */
  items: ChatMessage[];
  hasMore: boolean;
  lastMessageSequenceNumber: number;
  /** The other person has read up to this message number ("Seen"). */
  otherLastReadSequenceNumber: number;
}
