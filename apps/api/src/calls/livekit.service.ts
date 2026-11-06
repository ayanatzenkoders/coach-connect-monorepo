import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { AppException } from '../common/errors/app.exception.js';

/**
 * Everything we say to LiveKit, in one small class.
 * Our API never touches audio or video: it only (1) signs a "pass" that lets one person into one room and
 * (2) can throw people out of a room. The phones then talk to LiveKit directly.
 */
@Injectable()
export class LiveKitService {
  private readonly log = new Logger(LiveKitService.name);

  constructor(private readonly config: ConfigService) {}

  /** The three settings, or a clear error if the owner has not filled them in yet. */
  private get settings() {
    const url = this.config.get<string>('LIVEKIT_URL');
    const key = this.config.get<string>('LIVEKIT_API_KEY');
    const secret = this.config.get<string>('LIVEKIT_API_SECRET');
    if (!url || !key || !secret) {
      throw new AppException(503, 'CALLS_NOT_CONFIGURED', 'Calls are not set up on the server yet.');
    }
    return { url, key, secret };
  }

  /** Fail fast (503) before any call is created in the database if LiveKit is not set up. */
  ensureConfigured(): void {
    void this.settings;
  }

  /**
   * A pass for ONE person into ONE room, valid for only 2 minutes. It is used just to connect (LiveKit keeps people who are already in the room connected, and renews their pass itself), so a short life means that a person who is banned or removed cannot walk back in with an old pass.
   * It is a JWT signed with the API secret. LiveKit trusts it because only we know the secret.
   *  - identity = our user id, so we can find and remove the person later
   *  - room     = the call's room name; the pass is useless for any other room
   */
  async joinPass(userId: string, name: string, roomName: string): Promise<{ url: string; token: string }> {
    const { url, key, secret } = this.settings;
    const pass = new AccessToken(key, secret, { identity: userId, name, ttl: '2m' });
    pass.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return { url, token: await pass.toJwt() };
  }

  /** Throw one person out of a room (used when they are banned). Best effort: a LiveKit hiccup must not break the ban. */
  async kick(roomName: string, userId: string): Promise<void> {
    try {
      await this.rooms().removeParticipant(roomName, userId);
    } catch (e) {
      this.log.warn(`could not remove ${userId} from ${roomName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Close a room: everybody still in it is disconnected. Used when the call ends. Best effort too. */
  async closeRoom(roomName: string): Promise<void> {
    try {
      await this.rooms().deleteRoom(roomName);
    } catch (e) {
      this.log.warn(`could not close ${roomName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** The server-side client talks HTTPS, while phones use the wss:// address of the same server. */
  private rooms(): RoomServiceClient {
    const { url, key, secret } = this.settings;
    return new RoomServiceClient(url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), key, secret);
  }
}
