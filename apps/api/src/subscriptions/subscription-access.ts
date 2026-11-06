import type { SubscriptionStatus } from '../generated/prisma/client.js';

/**
 * May this member start calls? While subscriptions are switched off (`SUBSCRIPTION_ENFORCED=false`) everybody may;
 * once it is on, the subscription rules below decide. One place, so the calls API and /auth/me can never disagree.
 */
export function memberMayCall(
  sub: { status: SubscriptionStatus; expiresAt: Date | null } | null | undefined,
  enforced: boolean,
  now: Date = new Date(),
): boolean {
  return !enforced || hasActiveAccess(sub, now);
}

/**
 * Does this subscription currently grant access to calls? (Rule from the plan:
 * only EXPIRED and "never subscribed" are blocked.)
 * Pure function: no database, so it is trivial to unit test and reuse in every endpoint.
 */
export function hasActiveAccess(
  sub: { status: SubscriptionStatus; expiresAt: Date | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;
  switch (sub.status) {
    case 'TRIAL':
    case 'ACTIVE':
    case 'GRACE_PERIOD':
      return true;
    case 'CANCELLED_ACTIVE':
      // Renewal is off, but they paid until expiresAt.
      return sub.expiresAt !== null && sub.expiresAt.getTime() > now.getTime();
    case 'EXPIRED':
      return false;
  }
}
