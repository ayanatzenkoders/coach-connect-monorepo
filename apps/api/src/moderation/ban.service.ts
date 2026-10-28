import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

@Injectable()
export class BanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Ban = ONE database transaction (all-or-nothing), then an event.
   *  1. set users.banned_at             -> JwtAuthGuard now rejects every request (403)
   *  2. revoke all their sessions       -> refresh tokens stop working, no new access tokens
   *  3. write the audit entry           -> who banned whom and why (the only place the reason is kept)
   * After commit we emit `user.banned` so realtime code (Socket.io chat, calls, LiveKit
   * rooms; added in later phases) can disconnect the user within seconds.
   */
  async ban(actorId: string, targetId: string, reason: string, note?: string) {
    if (actorId === targetId) throw new AppException(400, 'CANNOT_BAN_SELF', 'You cannot ban yourself.');

    const target = await this.prisma.user.findFirst({ where: { id: targetId, deletedAt: null } });
    if (!target) throw new AppException(404, 'USER_NOT_FOUND', 'User not found.');
    if (target.role === 'ADMIN' || target.role === 'SUPPORT') {
      throw new AppException(403, 'CANNOT_BAN_STAFF', 'Staff accounts cannot be banned here.');
    }
    if (target.bannedAt) return { alreadyBanned: true, revokedSessions: 0 };

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: { bannedAt: now },
      });
      const sessions = await tx.session.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'BANNED' },
      });
      await this.audit.record(
        {
          actorId,
          action: 'user.ban',
          targetType: 'user',
          targetId,
          metadata: { reason, note: note ?? null, revokedSessions: sessions.count },
        },
        tx,
      );
      return { alreadyBanned: false, revokedSessions: sessions.count };
    });

    // REAL-TIME: sessions are revoked, so close the banned user's open sockets now instead of leaving them
    // connected until the next reconnect. Done after the commit so a failed ban never kicks anyone.
    this.realtime.disconnectUser(targetId);
    return result;
  }

  async unban(actorId: string, targetId: string) {
    const target = await this.prisma.user.findFirst({ where: { id: targetId, deletedAt: null } });
    if (!target) throw new AppException(404, 'USER_NOT_FOUND', 'User not found.');
    if (!target.bannedAt) return { wasBanned: false };

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: { bannedAt: null },
      });
      await this.audit.record({ actorId, action: 'user.unban', targetType: 'user', targetId }, tx);
    });
    // Sessions stay revoked: the user must sign in again.
    return { wasBanned: true };
  }
}
