import { create } from 'zustand';

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
