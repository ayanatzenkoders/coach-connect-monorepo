import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import type { AuthUser } from '../common/auth-user.js';
import type { RouteAudience } from '../common/decorators/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from './token.service.js';

/**
 * "Is this access token still good RIGHT NOW?" in one place.
 * Used by JwtAuthGuard (every HTTP request) and by RealtimeGateway (every socket connection),
 * so a ban or logout is judged by the very same rules on both doors.
 *
 * Checking the token signature alone is not enough: a valid 15-minute token would keep working
 * after a ban. So after verifying the token we also read the session and user rows from the
 * database (one primary-key query) and reject if anything changed.
 */
@Injectable()
export class SessionAuthService {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  /** Returns who is asking, or throws an AppException whose `code` the app can switch on. */
  async authenticate(token: string, routeAudience: RouteAudience, options: { allowPending?: boolean } = {}): Promise<AuthUser> {
    let payload;
    try {
      payload = await this.tokens.verifyAccess(token);
    } catch {
      // Covers bad signature, expired, wrong issuer. The app reacts by refreshing its token.
      throw new AppException(401, 'INVALID_TOKEN', 'Session expired.');
    }

    // A mobile token must not open admin routes, and vice versa.
    if (routeAudience !== 'any' && payload.aud !== routeAudience) {
      throw new AppException(403, 'WRONG_AUDIENCE', 'This token cannot be used here.');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: {
        userId: true,
        audience: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { id: true, role: true, bannedAt: true, deletedAt: true, coachProfile: { select: { approved: true } } } },
      },
    });
    if (!session || session.userId !== payload.sub || session.revokedAt) {
      throw new AppException(401, 'SESSION_REVOKED', 'Session ended. Please sign in again.');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppException(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');
    }
    if (session.user.deletedAt) throw new AppException(401, 'SESSION_REVOKED', 'Session ended. Please sign in again.');
    if (session.user.bannedAt) throw new AppException(403, 'ACCOUNT_BANNED', 'This account has been suspended.');

    // A coach waits for an admin: until then they may only verify their email and sign out (see @AllowPendingCoach),
    // and they never get the live connection. Judged from the database row, so approval (or a ban) applies at once.
    if (session.user.role === 'COACH' && !session.user.coachProfile?.approved && !options.allowPending) {
      throw new AppException(403, 'COACH_PENDING_APPROVAL', 'Your application is waiting for approval.');
    }

    // Role comes from the database row, NOT from the token, so a role change applies at once.
    return { id: session.user.id, role: session.user.role, sessionId: payload.sid, audience: session.audience };
  }
}
