import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/src/constants/general';
import { useAuthStore } from '@/src/store/auth.store';
import { useConnectionStore } from '@/src/store/connection.store';

/** Server answers (the text of the connect error) that mean "this login is finished", same idea as withAuth. */
const SESSION_ENDED = new Set(['SESSION_REVOKED', 'SESSION_EXPIRED', 'ACCOUNT_BANNED']);

let socket: Socket | undefined;

/**
 * The ONE live connection to the server (created on first use, shared by every screen).
 * The server uses it to PUSH events ("new message", "read up to N"); sending and reading still use
 * normal REST calls. See packages/shared/src/realtime.ts for the event list.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(API_BASE_URL, {
    autoConnect: false, // connectSocket() decides when (only while signed in)
    transports: ['websocket'], // straight to WebSocket, no HTTP long-polling warm-up
    // Asked again on EVERY (re)connect, so after a token refresh the new token is used automatically.
    // The server checks it in the handshake, exactly like an HTTP request (RealtimeGateway.afterInit).
    auth: (send) => send({ token: useAuthStore.getState().accessToken }),
  });

  // Tell the screens whether the live connection is up (the chat shows a banner when it is not).
  const setConnection = useConnectionStore.getState().set;
  socket.on('connect', () => setConnection('connected'));
  // Socket.IO's automatic retries announce each attempt here (these events live on the Manager, `socket.io`).
  socket.io.on('reconnect_attempt', () => setConnection('connecting'));

  // The server refused the handshake. Its error text is the same `code` the HTTP API uses.
  socket.on('connect_error', async (error) => {
    setConnection('disconnected');
    const store = useAuthStore.getState();
    // The user is signing out (or already signed out): the server closing our socket is expected, not news.
    if (store.status !== 'signedIn' || store.signingOut) return;
    if (error.message === 'INVALID_TOKEN') {
      // The 15-minute access token ran out: get a new one, then try again.
      try {
        await store.refreshSession();
        socket?.connect();
      } catch {
        // Offline or refresh failed: the next foreground (see RootStack) tries again.
      }
    } else if (SESSION_ENDED.has(error.message)) {
      // Banned or signed out elsewhere: end the login here too (the same thing withAuth does).
      await store.expireSession(error.message === 'ACCOUNT_BANNED' ? 'banned' : 'expired');
    }
    // Any other error is a network problem: Socket.IO retries by itself.
  });

  // "io server disconnect" = the SERVER hung up on purpose (ban, password reset). Socket.IO does not
  // reconnect after that by itself, so we knock again: the handshake then tells us why (banned? signed out?).
  socket.on('disconnect', (reason) => {
    // "io client disconnect" = WE closed it (sign out): that is not a lost connection.
    setConnection(reason === 'io client disconnect' ? 'idle' : 'disconnected');
    const { status, signingOut } = useAuthStore.getState();
    // Not while the user is signing out: the server hangs up on logout, and knocking again would only be refused.
    if (reason === 'io server disconnect' && status === 'signedIn' && !signingOut) socket?.connect();
  });

  return socket;
}

/** Open the connection (does nothing if it is already open). Called while the user is signed in. */
export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) useConnectionStore.getState().set('connecting');
  return s.connect();
};

/** Close it (sign out). No event reaches a signed-out phone. */
export const disconnectSocket = () => {
  useConnectionStore.getState().set('idle'); // closed on purpose, not "lost": no banner
  return socket?.disconnect();
};
