import type { Me } from '@coach-connect/shared/types';
import { longDate } from '@/src/utils/helpers/time';

/** How a membership is shown: a short title, one line of explanation, and a tone that picks the colour of its pill. */
export interface Membership {
  title: string;
  detail: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}

/**
 * Turns the raw subscription (`ACTIVE`, `CANCELLED_ACTIVE`, ...) into words a person understands.
 * The rule for who may call is decided by the server (`canCall`); this only explains the state.
 */
export function describeMembership(me: Pick<Me, 'role' | 'subscription'>): Membership {
  if (me.role === 'COACH') return { title: 'Coach account', detail: 'Coaches never need a subscription.', tone: 'good' };

  const sub = me.subscription;
  if (!sub) return { title: 'No subscription', detail: 'Subscribe to start calls with coaches.', tone: 'neutral' };

  const until = longDate(sub.expiresAt);
  switch (sub.status) {
    case 'TRIAL':
      return { title: 'Free trial', detail: until ? `Your trial ends on ${until}.` : 'You are on a free trial.', tone: 'good' };
    case 'ACTIVE':
      return { title: 'Active', detail: until ? `Renews on ${until}.` : 'Your subscription is active.', tone: 'good' };
    case 'GRACE_PERIOD':
      return { title: 'Payment issue', detail: 'We could not renew your subscription. Update your payment method to keep your access.', tone: 'warn' };
    case 'CANCELLED_ACTIVE':
      return { title: 'Cancelled', detail: until ? `You can still call until ${until}.` : 'You can still call until the end of your paid period.', tone: 'warn' };
    case 'EXPIRED':
      return { title: 'Expired', detail: 'Renew your subscription to start calls again.', tone: 'bad' };
  }
}
