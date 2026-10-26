import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client.js';
import type { AuthedRequest, AuthUser } from '../auth-user.js';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const AUDIENCE = 'audience';

/** Opt OUT of login. Everything is protected by default; only mark what must be open. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Only these roles may call the route. Checked against the database role, not the token. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Which kind of token the route accepts. Default is 'mobile'. */
export type RouteAudience = 'mobile' | 'admin' | 'any';
export const Audience = (aud: RouteAudience) => SetMetadata(AUDIENCE, aud);

/** Inject the authenticated user into a controller method. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
