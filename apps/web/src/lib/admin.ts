import { API_ROUTES, withParams } from '@coach-connect/shared/api';
import type { AdminUser, AdminUsersPage, CoachApprovalResult } from '@coach-connect/shared/types';
import { authedRequest } from './session';

/**
 * Everything the "Users & coaches" page asks the backend. Plain functions, no React:
 * the page decides WHEN to call them, these decide WHAT to send.
 */

export interface UsersFilter {
  q: string;
  role: AdminUser['role'] | '';
  status: 'banned' | 'pending' | 'unverified' | '';
}

/** The query string for GET /admin/users. Empty filters are left out, and text is URL-encoded. */
export function usersQueryString(filter: UsersFilter, cursor?: string | null): string {
  const params = new URLSearchParams();
  const q = filter.q.trim();
  if (q) params.set('q', q);
  if (filter.role) params.set('role', filter.role);
  if (filter.status) params.set('status', filter.status);
  if (cursor) params.set('cursor', cursor);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const listUsers = (filter: UsersFilter, cursor?: string | null) => authedRequest<AdminUsersPage>(`${API_ROUTES.admin.users}${usersQueryString(filter, cursor)}`);

export const approveCoach = (id: string) => authedRequest<CoachApprovalResult>(withParams(API_ROUTES.admin.coachApprove, { id }), { method: 'POST' });

export const banUser = (id: string, reason: string, note?: string) =>
  authedRequest<{ alreadyBanned: boolean; revokedSessions: number }>(withParams(API_ROUTES.admin.ban, { id }), {
    method: 'POST',
    body: { reason, ...(note?.trim() ? { note: note.trim() } : {}) },
  });

export const unbanUser = (id: string) => authedRequest<{ wasBanned: boolean }>(withParams(API_ROUTES.admin.unban, { id }), { method: 'POST' });

// ───────────────────────── what the page shows ─────────────────────────

export type StatusTone = 'good' | 'warn' | 'bad' | 'neutral';

/**
 * The tags on a row. A person can have several at once (a coach who never verified AND waits for approval), so this is a
 * list, worst first: Banned, Pending approval, Unverified. Someone with nothing to flag is Approved (coach) or Active.
 */
export function describeTags(user: Pick<AdminUser, 'role' | 'bannedAt' | 'isApproved' | 'emailVerified'>): { label: string; tone: StatusTone }[] {
  const tags: { label: string; tone: StatusTone }[] = [];
  if (user.bannedAt) tags.push({ label: 'Banned', tone: 'bad' });
  if (user.role === 'COACH' && !user.isApproved) tags.push({ label: 'Pending approval', tone: 'warn' });
  if (!user.emailVerified) tags.push({ label: 'Unverified', tone: 'warn' });
  if (tags.length === 0) tags.push(user.role === 'COACH' ? { label: 'Approved', tone: 'good' } : { label: 'Active', tone: 'neutral' });
  return tags;
}

/** Staff accounts cannot be banned (the backend refuses it too), so they get no ban button. */
export const canBan = (user: Pick<AdminUser, 'role'>) => user.role === 'MEMBER' || user.role === 'COACH';

/**
 * Only a coach who is not approved yet gets an Approve button. There is no "remove approval": taking a coach
 * away is a ban (they leave the People list, their chats stay readable, nobody can write to them).
 */
export const canApprove = (user: Pick<AdminUser, 'role' | 'bannedAt' | 'isApproved'>) => user.role === 'COACH' && !user.isApproved && !user.bannedAt;

/** Only an Admin may change anything; Support is read-only. The backend enforces this too (403). */
export const canManage = (staffRole: string | undefined) => staffRole === 'ADMIN';

/** A birth date "1985-03-09" -> "9 Mar 1985" (no time zone shifting: it is a calendar day, not a moment). */
export function birthDate(day: string | null | undefined): string {
  if (!day) return 'Not given';
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return 'Not given';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "2026-10-26T..." -> "26 Oct 2026". Empty or invalid input gives "-". */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Replace one row of the list with a changed copy (everything else is left as it is). */
export const patchUser = (users: AdminUser[], id: string, change: Partial<AdminUser>): AdminUser[] =>
  users.map((u) => (u.id === id ? { ...u, ...change } : u));
