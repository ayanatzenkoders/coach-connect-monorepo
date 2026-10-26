import { hasActiveAccess } from './subscription-access.js';

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('hasActiveAccess', () => {
  it('blocks users who never subscribed', () => {
    expect(hasActiveAccess(null)).toBe(false);
    expect(hasActiveAccess(undefined)).toBe(false);
  });
  it.each(['TRIAL', 'ACTIVE', 'GRACE_PERIOD'] as const)('allows %s', (status) => {
    expect(hasActiveAccess({ status, expiresAt: future })).toBe(true);
  });
  it('allows CANCELLED_ACTIVE only until it expires', () => {
    expect(hasActiveAccess({ status: 'CANCELLED_ACTIVE', expiresAt: future })).toBe(true);
    expect(hasActiveAccess({ status: 'CANCELLED_ACTIVE', expiresAt: past })).toBe(false);
    expect(hasActiveAccess({ status: 'CANCELLED_ACTIVE', expiresAt: null })).toBe(false);
  });
  it('blocks EXPIRED', () => {
    expect(hasActiveAccess({ status: 'EXPIRED', expiresAt: past })).toBe(false);
  });
});
