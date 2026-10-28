import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Every connected device of a user sits in this room, so "send to Sara" = "send to room user:<Sara's id>". */
export const userRoom = (userId: string) => `user:${userId}`;

/** One room per login (session): lets the server close exactly the socket of a logged-out device, not the user's other phones. */
export const sessionRoom = (sessionId: string) => `session:${sessionId}`;

/**
 * The ONLY thing the rest of the API knows about sockets. Chat, ban and password reset call these two
 * methods; they never touch Socket.IO directly. That keeps the feature code simple and easy to test.
 */
@Injectable()
export class RealtimeService {
  /** Set once by RealtimeGateway when Socket.IO has started. Before that (or in tests without a server) calls are no-ops. */
  private server?: Server;
  private readonly logger = new Logger(RealtimeService.name);

  attach(server: Server) {
    this.server = server;
  }

  /**
   * Push an event to every device of every listed user.
   * `to([...rooms])` delivers ONCE per socket even if it matches two rooms, so a user with two phones gets it on both.
   */
  emitToUsers(userIds: string[], event: string, payload: unknown) {
    // The database change is already committed when this runs, so a failed PUSH must never turn the request
    // into an error (the app would retry something that already worked). Log it; the app catches up by REST.
    try {
      this.server?.to(userIds.map(userRoom)).emit(event, payload);
    } catch (e) {
      this.logger.error(`could not push "${event}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Cut every live socket of this user (ban, password reset). They can reconnect only with a valid session. */
  disconnectUser(userId: string) {
    this.server?.in(userRoom(userId)).disconnectSockets(true);
  }

  /** Cut the socket(s) of ONE login (logout, stolen-token detection, same-device re-login). Their other devices stay connected. */
  disconnectSession(sessionId: string) {
    this.server?.in(sessionRoom(sessionId)).disconnectSockets(true);
  }
}
