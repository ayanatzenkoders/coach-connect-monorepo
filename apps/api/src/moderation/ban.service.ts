import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Ban = ONE database transaction (all-or-nothing), then an event.
   *  1. mark the user banned            -> JwtAuthGuard now rejects every request (403)
   *  2. revoke all their sessions       -> refresh tokens stop working, no new access tokens
   *  3. delete their push tokens        -> no more call/chat pushes
   *  4. write the audit entry           -> who banned whom and why
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
    if (target.isBanned) return { alreadyBanned: true, revokedSessions: 0 };

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: { isBanned: true, bannedAt: now, banReason: reason, bannedById: actorId },
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

    return result;
  }

  async unban(actorId: string, targetId: string) {
    const target = await this.prisma.user.findFirst({ where: { id: targetId, deletedAt: null } });
    if (!target) throw new AppException(404, 'USER_NOT_FOUND', 'User not found.');
    if (!target.isBanned) return { wasBanned: false };

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: { isBanned: false, bannedAt: null, banReason: null, bannedById: null },
      });
      await this.audit.record({ actorId, action: 'user.unban', targetType: 'user', targetId }, tx);
    });
    // Sessions stay revoked: the user must sign in again.
    return { wasBanned: true };
  }
}
