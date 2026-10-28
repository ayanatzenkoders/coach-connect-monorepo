import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client.js';
import type { AuthedRequest, AuthUser } from '../auth-user.js';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const AUDIENCE = 'audience';
export const ALLOW_PENDING_COACH = 'allowPendingCoach';

/** Opt OUT of login. Everything is protected by default; only mark what must be open. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Only these roles may call the route. Checked against the database role, not the token. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Which kind of token the route accepts. Default is 'mobile'. */
export type RouteAudience = 'mobile' | 'admin' | 'any';
export const Audience = (aud: RouteAudience) => SetMetadata(AUDIENCE, aud);

/**
 * A coach whose application is not approved yet may call ONLY the routes marked with this: verify the email, read
 * "who am I" and sign out. Everything else answers 403 COACH_PENDING_APPROVAL.
 */
export const AllowPendingCoach = () => SetMetadata(ALLOW_PENDING_COACH, true);

/** Inject the authenticated user into a controller method. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
