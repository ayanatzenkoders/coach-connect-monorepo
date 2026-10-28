import { describeMembership } from '@/src/screens/home/profile/membership';
import type { Me } from '@coach-connect/shared/types';

const member = (subscription: Me['subscription']) => ({ role: 'MEMBER' as const, subscription });
const END = '2026-11-27T10:00:00.000Z';

describe('describeMembership', () => {
  it('ACTIVE: "Active" with the renewal date, green', () => {
    expect(describeMembership(member({ status: 'ACTIVE', expiresAt: END }))).toEqual({ title: 'Active', detail: 'Renews on Nov 27, 2026.', tone: 'good' });
  });

  it('TRIAL: says when the free trial ends', () => {
    expect(describeMembership(member({ status: 'TRIAL', expiresAt: END }))).toMatchObject({ title: 'Free trial', detail: 'Your trial ends on Nov 27, 2026.', tone: 'good' });
  });

  it('GRACE_PERIOD: a payment problem, amber, tells what to do', () => {
    const m = describeMembership(member({ status: 'GRACE_PERIOD', expiresAt: END }));
    expect(m).toMatchObject({ title: 'Payment issue', tone: 'warn' });
    expect(m.detail).toContain('Update your payment method');
  });

  it('CANCELLED_ACTIVE: cancelled but still paid until the end date', () => {
    expect(describeMembership(member({ status: 'CANCELLED_ACTIVE', expiresAt: END }))).toMatchObject({ title: 'Cancelled', detail: 'You can still call until Nov 27, 2026.', tone: 'warn' });
  });

  it('EXPIRED: red, says how to get back', () => {
    expect(describeMembership(member({ status: 'EXPIRED', expiresAt: END }))).toMatchObject({ title: 'Expired', tone: 'bad' });
  });

  it('no subscription row: "No subscription", neutral', () => {
    expect(describeMembership(member(null))).toMatchObject({ title: 'No subscription', tone: 'neutral' });
  });

  it('coaches never need a subscription, whatever the row says', () => {
    expect(describeMembership({ role: 'COACH', subscription: null })).toMatchObject({ title: 'Coach account', tone: 'good' });
    expect(describeMembership({ role: 'COACH', subscription: { status: 'EXPIRED', expiresAt: END } })).toMatchObject({ title: 'Coach account' });
  });

  it('a missing end date never prints "undefined" or "Invalid Date"', () => {
    for (const status of ['TRIAL', 'ACTIVE', 'CANCELLED_ACTIVE'] as const) {
      const { detail } = describeMembership(member({ status, expiresAt: null }));
      expect(detail).not.toMatch(/undefined|Invalid|NaN|null/);
    }
  });
});
