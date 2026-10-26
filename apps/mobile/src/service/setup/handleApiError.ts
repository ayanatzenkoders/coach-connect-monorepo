import { showToast } from '@/src/store/toast.store';
import { ApiError } from './apiClient';

/**
 * Turn anything that was thrown into a toast. Backend errors arrive as ApiError, whose message
 * is already written for people ("Email or password is incorrect."), so we show it as it is.
 */
export function showApiError(error: unknown) {
  if (error instanceof ApiError) {
    // The backend can add "attemptsLeft" to a wrong code: tell the user.
    const left = error.data.attemptsLeft;
    const extra = typeof left === 'number' ? ` ${left} ${left === 1 ? 'try' : 'tries'} left.` : '';
    showToast(`${error.message}${extra}`);
  } else {
    showToast(error instanceof Error ? error.message : 'Something went wrong.');
  }
}
