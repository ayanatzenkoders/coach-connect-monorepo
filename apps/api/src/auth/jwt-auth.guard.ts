import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/errors/app.exception.js';
import type { AuthedRequest } from '../common/auth-user.js';
import { AUDIENCE, IS_PUBLIC, type RouteAudience } from '../common/decorators/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from './token.service.js';

/**
 * Runs before EVERY route (registered globally) unless the route is @Public().
 *
 * Checking the token signature alone is not enough: a valid 15-minute token would keep
 * working after a ban. So after verifying the token we also read the session and user
 * rows from the database (one primary-key query) and reject if anything changed:
 * session revoked/expired, user banned, user deleted. That is what makes a ban effective
 * on the very next request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const routeAudience = this.reflector.getAllAndOverride<RouteAudience>(AUDIENCE, targets) ?? 'mobile';

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw this.unauthorized('MISSING_TOKEN', 'Sign in required.');

    let payload;
    try {
      payload = await this.tokens.verifyAccess(header.slice(7));
    } catch {
      // Covers bad signature, expired, wrong issuer. The app reacts by calling /auth/refresh.
      throw this.unauthorized('INVALID_TOKEN', 'Session expired.');
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
        user: { select: { id: true, role: true, isBanned: true, deletedAt: true } },
      },
    });
    if (!session || session.userId !== payload.sub || session.revokedAt) {
      throw this.unauthorized('SESSION_REVOKED', 'Session ended. Please sign in again.');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw this.unauthorized('SESSION_EXPIRED', 'Session expired. Please sign in again.');
    }
    if (session.user.deletedAt) throw this.unauthorized('SESSION_REVOKED', 'Session ended. Please sign in again.');
    if (session.user.isBanned) throw new AppException(403, 'ACCOUNT_BANNED', 'This account has been suspended.');

    // Role comes from the database row, NOT from the token, so a role change applies at once.
    req.user = {
      id: session.user.id,
      role: session.user.role,
      sessionId: payload.sid,
      audience: session.audience,
    };
    return true;
  }

  private unauthorized(code: string, message: string) {
    return new AppException(401, code, message);
  }
}
