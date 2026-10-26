/** Emitted AFTER a ban is committed. Realtime parts (sockets, calls) listen and cut the user off. */
export const USER_BANNED = 'user.banned';

export class UserBannedEvent {
  constructor(
    public readonly userId: string,
    public readonly actorId: string,
    public readonly reason: string,
  ) {}
}
