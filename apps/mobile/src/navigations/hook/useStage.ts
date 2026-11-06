import { useAuthStore } from '@/src/store/auth.store';
import { getStage, type Stage } from '../stage';

/** Which group of screens exists right now, from the sign-in state. */
export function useStage(): Stage {
  const status = useAuthStore(s => s.status);
  const emailVerified = useAuthStore(s => s.user?.emailVerified ?? false);
  // A coach an admin has not approved yet: the server refuses everything but "who am I", so show a waiting screen.
  const pendingApproval = useAuthStore(s => s.user?.pendingApproval ?? false);
  return getStage(status, emailVerified, pendingApproval);
}
