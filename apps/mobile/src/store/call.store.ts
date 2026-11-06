import { create } from 'zustand';
import type { CallInfo } from '@/src/service/api/call.api';

/**
 * Where my phone is with the LiveKit room:
 *  idle = not in a room, connecting = opening it, connected = audio/video flowing,
 *  reconnecting = the network dropped and LiveKit is trying again, lost = it gave up (the call may still be running: Rejoin)
 */
export type CallConnection = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'lost';

interface CallState {
  /** A call that is ringing ME right now (the ringing overlay). */
  incoming: CallInfo | null;
  /** The call I am in (even if I went back to the chat and minimized it). */
  active: CallInfo | null;
  connection: CallConnection;
  muted: boolean;
  cameraOn: boolean;
  speakerOn: boolean;
  /** Goes up whenever somebody joins, leaves, or switches their camera, so the call screen redraws its tiles. */
  roomVersion: number;

  setIncoming: (call: CallInfo | null) => void;
  setActive: (call: CallInfo | null) => void;
  setConnection: (connection: CallConnection) => void;
  setMuted: (muted: boolean) => void;
  setCameraOn: (on: boolean) => void;
  setSpeakerOn: (on: boolean) => void;
  bump: () => void;
  /** Forget everything (sign out). */
  reset: () => void;
}

const EMPTY = { incoming: null, active: null, connection: 'idle' as CallConnection, muted: false, cameraOn: false, speakerOn: false, roomVersion: 0 };

export const useCallStore = create<CallState>()((set) => ({
  ...EMPTY,
  setIncoming: (incoming) => set({ incoming }),
  setActive: (active) => set(active ? { active } : { active: null, connection: 'idle', muted: false, cameraOn: false, speakerOn: false }),
  setConnection: (connection) => set({ connection }),
  setMuted: (muted) => set({ muted }),
  setCameraOn: (cameraOn) => set({ cameraOn }),
  setSpeakerOn: (speakerOn) => set({ speakerOn }),
  bump: () => set((s) => ({ roomVersion: s.roomVersion + 1 })),
  reset: () => set(EMPTY),
}));
