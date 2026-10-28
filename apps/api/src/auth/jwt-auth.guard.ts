import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/errors/app.exception.js';
import type { AuthedRequest } from '../common/auth-user.js';
import { AUDIENCE, IS_PUBLIC, type RouteAudience } from '../common/decorators/index.js';
import { SessionAuthService } from './session-auth.service.js';

/**
 * Runs before EVERY route (registered globally) unless the route is @Public().
 * It only finds the token in the request; the real checks (signature, audience, session and user
 * rows in the database) live in SessionAuthService, shared with the socket gateway.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionAuth: SessionAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const routeAudience = this.reflector.getAllAndOverride<RouteAudience>(AUDIENCE, targets) ?? 'mobile';

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppException(401, 'MISSING_TOKEN', 'Sign in required.');

    // Later code (@CurrentUser, RolesGuard) reads req.user.
    req.user = await this.sessionAuth.authenticate(header.slice(7), routeAudience);
    return true;
  }
}
