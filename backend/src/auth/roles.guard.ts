import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../generated/prisma/client.js';
import { AppException } from '../common/errors/app.exception.js';
import type { AuthedRequest } from '../common/auth-user.js';
import { ROLES } from '../common/decorators/index.js';

/**
 * RBAC (role-based access control). Runs after JwtAuthGuard.
 * Routes with @Roles(...) are allowed only for those roles; routes without it are open to
 * any logged-in user. Enforced on the SERVER, so hiding a button in the admin UI is never
 * the only protection.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = request.user;
    if (!user || !roles.includes(user.role)) {
      throw new AppException(403, 'FORBIDDEN_ROLE', 'You do not have permission to do this.');
    }
    return true;
  }
}
