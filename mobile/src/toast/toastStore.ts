import { create } from 'zustand';
import { ApiError } from '../api/client';

export type ToastTone = 'error' | 'success' | 'info';

interface ToastState {
  /** Only one toast is shown at a time; a new one replaces the old. `id` changes every time, so the host restarts its timer. */
  toast: { id: number; message: string; tone: ToastTone } | null;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toast: null,
  show: (message, tone = 'error') => set({ toast: { id: nextId++, message, tone } }),
  hide: () => set({ toast: null }),
}));

/** Show a toast from anywhere (screens, helpers). */
export const showToast = (message: string, tone: ToastTone = 'error') => useToastStore.getState().show(message, tone);

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
