import { create } from 'zustand';

/**
 * The live connection (socket) to the server, as the screens need to know it.
 *  - idle:         not started (nobody is signed in)
 *  - connecting:   trying to open it (app start, or Socket.IO's automatic retry)
 *  - connected:    open, events arrive live
 *  - disconnected: lost or refused. Socket.IO keeps retrying by itself.
 * Only service/socket/socket.ts writes it; screens only read it.
 */
type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

interface ConnectionState {
  status: ConnectionStatus;
  set: (status: ConnectionStatus) => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  status: 'idle',
  set: (status) => set({ status }),
}));
