import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { USER_BANNED, UserBannedEvent } from './user-banned.event.js';

/**
 * Placeholder for the "kick" step of a ban. Phase 3 (calls) and Phase 7 (chat) will replace
 * the log line with: disconnect the user's sockets, end their active calls, remove them from
 * their LiveKit room. Target from the plan: done within 5 seconds of the ban.
 */
@Injectable()
export class BanRealtimeListener {
  private readonly log = new Logger(BanRealtimeListener.name);

  @OnEvent(USER_BANNED)
  handle(event: UserBannedEvent) {
    this.log.warn(`user ${event.userId} banned by ${event.actorId}: realtime kick goes here (Phase 3/7)`);
  }
}
