// Response shapes of the API, as plain types (no runtime code: safe to import anywhere, mobile included).
// They mirror what apps/api returns.

export type Role = "MEMBER" | "COACH" | "SUPPORT" | "ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  /** A coach whose application an admin has not approved yet. Such an account can only verify its email and sign out. */
  pendingApproval?: boolean;
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
  type: "DIRECT" | "GROUP";
  /** What to show as the chat's name: the other person's name, or the group's title. */
  title: string;
  /** DIRECT chats: the other person. null for groups. */
  other: { id: string; name: string; role: "MEMBER" | "COACH" } | null;
  /** GROUP chats only. */
  description: string | null;
  /** Number of people in the chat (2 for a direct chat). */
  memberCount: number;
  /** Number of the newest message in this chat. */
  lastMessageSequenceNumber: number;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessage: { senderId: string; senderName: string; body: string; createdAt: string } | null;
  /**
   * false when you can read the history but not write: in a direct chat, the other person is banned or gone.
   * (It comes back to true if they are unbanned.)
   */
  canSend: boolean;
}

export interface ChatMemberInfo {
  id: string;
  name: string;
  role: "MEMBER" | "COACH";
  /** Banned people stay listed (their old messages stay), but cannot write. */
  isBanned: boolean;
}

/** Answer of GET /chats/:id: the summary plus the people in it. */
export interface ChatDetail extends ChatSummary {
  members: ChatMemberInfo[];
  createdById: string | null;
  /** true when I created this group, so I may add people and delete it. */
  canManage: boolean;
}

export interface ChatMessage {
  id: string;
  /** 1, 2, 3 ... inside the chat: the order everybody sees. */
  sequenceNumber: number;
  senderId: string;
  /** Shown above other people's messages in a group. */
  senderName: string;
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
  /**
   * How far the others have read, so my messages up to this number show "Seen".
   * Direct chat: the other person. Group: the person who has read LEAST among those still active ("seen by everyone").
   */
  otherLastReadSequenceNumber: number;
  canSend: boolean;
}

/** One row of the admin user list. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** When the account was banned; null = not banned. */
  bannedAt: string | null;
  /** Coaches only: an admin approved this coach, so members can find them. Null for everyone else. */
  isApproved: boolean | null;
  /** False until the person typed the code from the verification email. */
  emailVerified: boolean;
  /** Only admins ever see this (never members or other coaches). Null for accounts made before it was collected. */
  phone: string | null;
  /** "YYYY-MM-DD". Null for accounts made before it was collected. */
  dateOfBirth: string | null;
  /** Coaches only: what they wrote about themselves, so the admin can decide. */
  coach: { bio: string; specialties: string[] } | null;
  createdAt: string;
}

export interface AdminUsersPage {
  items: AdminUser[];
  /** Send back as `cursor` for the next page; null = this was the last page. */
  nextCursor: string | null;
}

/** Answer of approving a coach. `changed` is false when the coach already was approved. */
export interface CoachApprovalResult {
  isApproved: boolean;
  changed: boolean;
}

