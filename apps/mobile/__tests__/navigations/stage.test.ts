import { getStage } from '@/src/navigations/stage';

describe('getStage: which screens exist', () => {
  it('a saved login with no connection is "offline", whatever the user looks like', () => {
    expect(getStage('offline', true, false)).toBe('offline');
    expect(getStage('offline', false, true)).toBe('offline');
  });

  it('signed out is the sign-in group', () => {
    expect(getStage('signedOut', false, false)).toBe('signedOut');
    // leftovers of a previous login can never open a signed-in screen
    expect(getStage('signedOut', true, false)).toBe('signedOut');
    expect(getStage('signedOut', true, true)).toBe('signedOut');
  });

  it('while still starting up the safe answer is Sign in: an unknown person is never shown the app', () => {
    expect(getStage('booting', true, false)).toBe('signedOut');
    expect(getStage('booting', false, false)).toBe('signedOut');
  });

  it('signed in but the email code is still to be typed: Verify email (also for a coach who waits)', () => {
    expect(getStage('signedIn', false, false)).toBe('verifyEmail');
    expect(getStage('signedIn', false, true)).toBe('verifyEmail'); // the code comes first, then the waiting screen
  });

  it('a verified coach whom nobody approved yet waits', () => {
    expect(getStage('signedIn', true, true)).toBe('pendingApproval');
  });

  it('a verified, approved person is in the app', () => {
    expect(getStage('signedIn', true, false)).toBe('app');
  });
});
