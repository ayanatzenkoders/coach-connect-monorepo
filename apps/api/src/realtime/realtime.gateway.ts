import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SessionAuthService } from '../auth/session-auth.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { RealtimeService, sessionRoom, userRoom } from './realtime.service.js';

/**
 * The door for real-time connections. Socket.IO shares the HTTP server (same port 3000), so there is
 * nothing extra to open or configure. A native app is not a browser, so CORS does not apply.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger('Realtime');

  constructor(
    private readonly sessionAuth: SessionAuthService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Runs once when Socket.IO starts. */
  afterInit(server: Server) {
    // Give the rest of the API a handle to push events through.
    this.realtime.attach(server);

    // Middleware = runs BEFORE a connection is accepted. A bad token never becomes a connected socket.
    server.use(async (socket, next) => {
      const token: unknown = socket.handshake.auth?.token; // the app sends { token } in the handshake
      try {
        if (typeof token !== 'string') throw new AppException(401, 'MISSING_TOKEN', 'Sign in required.');
        // The SAME check as every HTTP request: signature, session not revoked, user not banned or deleted.
        const user = await this.sessionAuth.authenticate(token, 'mobile');
        socket.data.userId = user.id; // remembered for handleConnection
        socket.data.sessionId = user.sessionId;
        next();
      } catch (e) {
        // The error text is the code, so the app can tell "token expired, refresh it" from "banned".
        next(new Error(e instanceof AppException ? e.code : 'UNAUTHORIZED'));
      }
    });
  }

  /** Runs for each accepted connection. */
  handleConnection(socket: Socket) {
    // Join my personal room. Chat events are sent to rooms of the chat's members, so this is what makes
    // "message for Amara" arrive on her phone, whichever screen she is on.
    void socket.join(userRoom(socket.data.userId as string));
    // ...and the room of THIS login, so ending this one session (logout, stolen token) can close exactly this socket.
    void socket.join(sessionRoom(socket.data.sessionId as string));
    this.logger.debug(`socket ${socket.id} connected for user ${socket.data.userId as string}`);
  }
}
